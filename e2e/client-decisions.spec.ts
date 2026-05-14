import { test, expect } from '@playwright/test'

const E2E = !!process.env.E2E_ENABLED
const CLIENT_EMAIL = process.env.E2E_CLIENT_EMAIL ?? ''

const DECISIONS = [
  { name: 'Voltar pro Estoque', text: /voltar pro estoque/i, needsXml: true },
  { name: 'Armazenar p/ Tratativas', text: /armazenar/i, needsXml: false },
  { name: 'Descarte', text: /descarte/i, needsXml: true },
  { name: 'Reembalagem', text: /reembalagem/i, needsXml: true },
]

test.describe('Cliente — Decisões', () => {
  test.beforeEach(async ({ page }) => {
    if (!E2E) test.skip()

    await page.goto('/login')
    await page.getByLabel(/e-mail/i).fill(CLIENT_EMAIL)
    await page.getByRole('button', { name: /receber link/i }).click()
    await page.waitForURL(/\/cliente/)
  })

  for (const decision of DECISIONS) {
    test(`toma decisão: ${decision.name}`, async ({ page }) => {
      await page.goto('/cliente')

      // Clica na decisão na primeira linha disponível
      await page.getByRole('button', { name: decision.text }).first().click()

      // Modal de confirmação deve aparecer
      await expect(page.getByText(/esta decisão é irreversível/i)).toBeVisible()

      // Aguarda o countdown (2s)
      await expect(page.getByRole('button', { name: /confirmar/i })).toBeDisabled()
      await page.waitForTimeout(2500)
      await expect(page.getByRole('button', { name: /confirmar/i })).toBeEnabled()

      if (decision.needsXml) {
        // Upload de XML de teste
        const fileChooserPromise = page.waitForEvent('filechooser')
        await page.getByLabel(/xml/i).click()
        const fileChooser = await fileChooserPromise
        await fileChooser.setFiles({
          name:     'test.xml',
          mimeType: 'text/xml',
          buffer:   Buffer.from('<nfeProc></nfeProc>'),
        })
      }

      await page.getByRole('button', { name: /^confirmar$/i }).click()

      // Deve fechar modal e atualizar tabela
      await expect(page.getByText(/esta decisão é irreversível/i)).not.toBeVisible({ timeout: 10000 })
    })
  }
})
