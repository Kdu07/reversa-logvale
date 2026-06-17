#!/usr/bin/env node
/**
 * Piloto descartável — Cobertura da "Consulta de Nota Fiscal de Produto" (V2) da NFE.io.
 *
 * Para cada chave de acesso (44 dígitos), consulta os dados na SEFAZ via NFE.io e,
 * quando disponível, tenta baixar o XML — classificando a cobertura:
 *   FULL_XML     → dados + XML original (o que precisamos para o backfill)
 *   DATA_ONLY    → dados retornados, mas sem XML (típico de destinatário com IE / B2B)
 *   NOT_FOUND    → NFE.io não localizou a nota (404)
 *   UNAUTHORIZED → key recusada (401) — provavelmente não é a Data/Consultas API key
 *   WAF_403      → bloqueado no edge da Cloudflare (IP/WAF) ou produto não habilitado
 *   QUOTA        → sem saldo/cota (402)
 *
 * Uso:
 *   node scripts/nfeio-pilot.mjs [arquivo-de-chaves.txt]
 *
 * Credencial: este produto usa a **Data/Consultas API key** (o SDK chama de
 * `dataApiKey` / `NFE_DATA_API_KEY`) — NÃO é a chave de emissão. Coloque-a no
 * ambiente ou no .env como NFE_DATA_API_KEY (também aceita NFEIO_API_KEY / NFE_API_KEY).
 *
 * Contrato (github.com/nfe/client-nodejs · src/core/resources/product-invoice-query.ts):
 *   host  nfe.api.nfe.io
 *   auth  Authorization: Bearer <Chave de Dados>   (gateway OAuth2; o header estático
 *         X-NFE-APIKEY do SDK é bloqueado no edge pela Cloudflare — ver headers abaixo)
 *   GET   /v2/productinvoices/{chave}        → JSON
 *   GET   /v2/productinvoices/{chave}.xml    → XML
 *
 * Não faz parte do app — é só validação manual.
 */

import { readFileSync, existsSync } from 'node:fs'

// .env loader mínimo (sem dependência) — lê na precedência do Next.js:
// process.env real > .env.local > .env (primeiro a definir vence).
function loadEnv() {
  for (const f of ['.env.local', '.env', '.env.development.local', '.env.development']) {
    if (!existsSync(f)) continue
    for (const line of readFileSync(f, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*(?:export\s+)?([A-Za-z0-9_]+)\s*=\s*(.*?)\s*$/)
      if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
    }
  }
}
loadEnv()

const HOST = 'https://nfe.api.nfe.io'
const apiKey =
  process.env.NFE_DATA_API_KEY ||
  process.env.NFEIO_DATA_API_KEY ||
  process.env.NFEIO_API_KEY ||
  process.env.NFE_API_KEY
if (!apiKey) {
  console.error('❌ Defina NFE_DATA_API_KEY (chave de Dados/Consultas) no .env ou no ambiente.')
  process.exit(1)
}

const file = process.argv[2] || 'scripts/chaves-b2c.txt'
const chaves = readFileSync(file, 'utf8')
  .split(/\r?\n/)
  .map((l) => l.trim())
  .filter((l) => /^\d{44}$/.test(l))
if (!chaves.length) {
  console.error(`❌ Nenhuma chave de 44 dígitos encontrada em ${file}`)
  process.exit(1)
}

// O gateway de produção (nfe.api.nfe.io) responde como resource server OAuth2
// (www-authenticate: Bearer) e BLOQUEIA no edge (403/Cloudflare) o header estático
// X-NFE-APIKEY do SDK — confirmado de dois IPs distintos. O único esquema que chega
// na origem é Authorization: Bearer, então usamos a Chave de Dados como Bearer token.
const headers = {
  Authorization: `Bearer ${apiKey}`,
  Accept: 'application/json',
  'User-Agent': `@nfe-io/sdk@3.0.0 node/${process.version} (${process.platform})`,
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function req(path) {
  const res = await fetch(`${HOST}${path}`, { headers })
  const buf = Buffer.from(await res.arrayBuffer())
  return {
    status: res.status,
    wwwAuth: res.headers.get('www-authenticate'),
    cfRay: res.headers.get('cf-ray'),
    server: res.headers.get('server'),
    text: buf.subarray(0, 400).toString('utf8'),
    bytes: buf.length,
  }
}

function classify(d, x) {
  if (d.status === 403) return 'WAF_403'
  if (d.status === 401) return 'UNAUTHORIZED'
  if (d.status === 402) return 'QUOTA'
  if (d.status === 200 && x && /<\?xml|<nfeProc|<NFe/i.test(x.text)) return 'FULL_XML'
  if (d.status === 200) return 'DATA_ONLY'
  if (d.status === 404) return 'NOT_FOUND'
  return `OTHER_${d.status}`
}

const tally = {}
let sample = null
console.log(`\nNFE.io · Consulta de NF-e de Produto — ${chaves.length} chave(s) de ${file}\n`)
console.log('   #  http  status      IE    itens  XML            classificação')
console.log('  ' + '─'.repeat(70))

for (let i = 0; i < chaves.length; i++) {
  const chave = chaves[i]
  try {
    const data = await req(`/v2/productinvoices/${chave}`)
    if (!sample) sample = data
    const xml = data.status === 200 ? await req(`/v2/productinvoices/${chave}.xml`) : null
    const cls = classify(data, xml)
    tally[cls] = (tally[cls] || 0) + 1

    let body = {}
    try {
      body = JSON.parse(data.text)
    } catch {
      /* corpo não-JSON (erro/edge) */
    }
    const ie = body.buyer?.stateTaxNumber || body.buyer?.address?.stateTaxNumber ? 'sim' : 'não'
    const itens = body.items?.length ?? '-'
    const xmlCol = xml ? (/<\?xml|<nfeProc|<NFe/i.test(xml.text) ? `ok ${xml.bytes}b` : `x(${xml.status})`) : '—'

    console.log(
      `  ${String(i + 1).padStart(2)}  ${String(data.status).padEnd(4)}  ` +
        `${String(body.currentStatus || '').padEnd(10)}  ${ie.padEnd(4)}  ${String(itens).padStart(4)}  ` +
        `${xmlCol.padEnd(13)}  ${cls}`,
    )
  } catch (e) {
    tally.EXCEPTION = (tally.EXCEPTION || 0) + 1
    console.log(`  ${String(i + 1).padStart(2)}  EXC   ${e.message}`)
  }
  await sleep(250)
}

console.log('\nResumo:')
for (const [k, v] of Object.entries(tally).sort((a, b) => b[1] - a[1])) console.log(`  ${k.padEnd(12)} ${v}`)
const full = tally.FULL_XML || 0
console.log(`\nCobertura de XML completo: ${full}/${chaves.length} (${Math.round((full / chaves.length) * 100)}%)`)

// Diagnóstico quando nada autentica.
if (!full && sample && sample.status !== 200) {
  console.log('\n⚠️  Nenhuma chave autenticou. Diagnóstico (1ª resposta):')
  console.log(`   HTTP ${sample.status}  server=${sample.server || '?'}  cf-ray=${sample.cfRay || '—'}`)
  if (sample.wwwAuth) console.log(`   www-authenticate: ${sample.wwwAuth}`)
  if (sample.status === 403)
    console.log('   → 403 + Cloudflare + corpo vazio = bloqueio no edge (IP de datacenter ou WAF),\n     ou o produto Consulta de NF-e não está habilitado na conta. Rode da sua máquina local.')
  if (sample.status === 401)
    console.log(
      '   → 401 invalid_token = a Chave de Dados não foi aceita. Ou o valor em NFE_DATA_API_KEY\n' +
        '     não é a Chave de Dados real (gere/copie no painel), ou ela precisa ser trocada por um\n' +
        '     access_token no endpoint OAuth da NFE.io. Confirme o método com o suporte.',
    )
}
console.log('Dica: rode também com um arquivo chaves-b2b.txt quando tiver chaves B2B.\n')
