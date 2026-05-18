import { createClient } from '@supabase/supabase-js'
import { env } from '@/lib/env'

export interface InvoiceData {
  accessKey:     string
  emitterCnpj:   string
  invoiceNumber: string | null
  emittedAt:     string | null
  xmlStoragePath: string
  depositorId:   string | null
}

interface WebmaniaRaw {
  status?: string
  nfe?: {
    chNFe?: string
    emit?: { CNPJ?: string }
    ide?: { nNF?: string; dhEmi?: string }
  }
  xml?: string
}

function adminClient() {
  return createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

async function withRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  const delays = [300, 600, 1200]
  let lastError: unknown
  for (let i = 0; i < attempts; i++) {
    try { return await fn() } catch (err) {
      lastError = err
      if (i < attempts - 1) await new Promise((r) => setTimeout(r, delays[i]))
    }
  }
  throw lastError
}

async function fetchWebmania(accessKey: string): Promise<WebmaniaRaw> {
  if (!env.webmaniaToken) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Consulta de NF indisponível neste momento')
    }
    // Dev mock — permite testar o fluxo sem credenciais Webmania
    return {
      status: 'aprovado',
      nfe: {
        chNFe: accessKey,
        emit:  { CNPJ: '12345678000195' },
        ide:   { nNF: `DEV-${accessKey.slice(-6)}`, dhEmi: new Date().toISOString() },
      },
      xml: `<?xml version="1.0" encoding="UTF-8"?><nfeProc><chNFe>${accessKey}</chNFe></nfeProc>`,
    }
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 10_000)
  try {
    const res = await fetch(
      `${env.webmaniaBaseUrl}/1/nfe/consulta?chNFe=${accessKey}`,
      {
        method:  'GET',
        headers: {
          Authorization:  `Bearer ${env.webmaniaToken}:${env.webmaniaSecret ?? ''}`,
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
      }
    )
    if (!res.ok) throw new Error(`Webmania retornou ${res.status}`)
    return res.json()
  } finally {
    clearTimeout(timer)
  }
}

export async function lookupInvoice(accessKey: string): Promise<InvoiceData> {
  const supabase = adminClient()

  // 1. Check cache
  const { data: cached } = await supabase
    .from('invoice_cache')
    .select('*')
    .eq('access_key', accessKey)
    .single()

  if (cached) {
    const { data: depositor } = await supabase
      .from('depositors')
      .select('id')
      .eq('cnpj', cached.emitter_cnpj)
      .eq('active', true)
      .single()

    return {
      accessKey,
      emitterCnpj:    cached.emitter_cnpj,
      invoiceNumber:  cached.invoice_number ?? null,
      emittedAt:      cached.emitted_at ?? null,
      xmlStoragePath: cached.xml_url,
      depositorId:    depositor?.id ?? null,
    }
  }

  // 2. Fetch from Webmania
  const raw = await withRetry(() => fetchWebmania(accessKey))

  if (!raw.nfe?.emit?.CNPJ) {
    throw new Error('NF não encontrada ou resposta Webmania inválida')
  }

  const emitterCnpj  = raw.nfe.emit.CNPJ
  const invoiceNumber = raw.nfe.ide?.nNF ?? null
  const emittedAt    = raw.nfe.ide?.dhEmi ?? null
  const xmlContent   = raw.xml ?? ''
  const xmlPath      = `${accessKey}.xml`

  // 3. Upload XML to private storage (store path, not public URL)
  await supabase.storage.from('invoice-xmls').upload(
    xmlPath,
    new Blob([xmlContent], { type: 'text/xml' }),
    { upsert: true, contentType: 'text/xml' }
  )

  // 4. Cache entry (ON CONFLICT DO NOTHING via ignoreDuplicates)
  await supabase.from('invoice_cache').upsert(
    {
      access_key:     accessKey,
      xml_url:        xmlPath,
      emitter_cnpj:   emitterCnpj,
      invoice_number: invoiceNumber,
      emitted_at:     emittedAt,
      raw_response:   raw,
    },
    { onConflict: 'access_key', ignoreDuplicates: true }
  )

  // 5. Find depositor by CNPJ
  const { data: depositor } = await supabase
    .from('depositors')
    .select('id')
    .eq('cnpj', emitterCnpj)
    .eq('active', true)
    .single()

  return {
    accessKey,
    emitterCnpj,
    invoiceNumber,
    emittedAt,
    xmlStoragePath: xmlPath,
    depositorId:    depositor?.id ?? null,
  }
}
