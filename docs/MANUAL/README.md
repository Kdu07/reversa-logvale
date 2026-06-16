# Manual do Usuário — Logvale

Manual completo do Sistema Logvale de Devoluções, cobrindo os três perfis (Operador, Cliente, Gerente).

## Arquivos

```
docs/MANUAL/
├── manual-logvale.html     ← o manual (abra no navegador)
├── PLANO-MANUAL.md         ← plano de produção e rastreabilidade
├── assets/
│   ├── logvale-logo.png    ← logotipo usado no cabeçalho
│   └── screenshots/        ← imagens das telas (a inserir)
└── README.md               ← este arquivo
```

## Como abrir

Dê duplo clique em `manual-logvale.html` ou arraste-o para o navegador (Chrome, Edge ou Firefox). O arquivo é autossuficiente e funciona **offline** — só precisa de internet para carregar a fonte Roboto.

## Como gerar o PDF

1. Abra `manual-logvale.html` no navegador.
2. Pressione **Ctrl + P** (Imprimir).
3. Em "Destino", escolha **Salvar como PDF**.
4. Recomendado: ativar **"Gráficos de plano de fundo"** para manter as cores da marca.
5. Salve.

O manual tem quebras de página por capítulo e um layout específico para impressão.

## Como inserir as capturas de tela

O manual usa **placeholders numerados** (Captura 01, 02, …) onde entram as imagens. O inventário completo das capturas está em `PLANO-MANUAL.md` (seção 7).

Para substituir um placeholder por uma imagem real:

1. Salve o screenshot em `assets/screenshots/` (ex.: `captura-01-login.png`).
2. No `manual-logvale.html`, localize o bloco correspondente:
   ```html
   <figure class="shot">
     <div class="shot-box"><span><strong>Captura 01</strong>...</span></div>
     <figcaption>Captura 01 — Tela de login.</figcaption>
   </figure>
   ```
3. Troque a `<div class="shot-box">…</div>` por:
   ```html
   <img src="assets/screenshots/captura-01-login.png" alt="Tela de login" style="width:100%;border:1px solid #e3e8ef;border-radius:10px;">
   ```
4. Mantenha o `<figcaption>` como legenda.

## Manutenção

- Ao mudar uma tela do sistema, atualize **o texto**, **a captura** e a **data de versão** (no cabeçalho e no rodapé do HTML).
- Toda informação do manual foi verificada no código — veja a rastreabilidade em `PLANO-MANUAL.md` (seção 8).
