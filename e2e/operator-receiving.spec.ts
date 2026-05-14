import { test, expect } from '@playwright/test'

const E2E = !!process.env.E2E_ENABLED
const OPERATOR_EMAIL = process.env.E2E_OPERATOR_EMAIL ?? ''

test.describe('Operador — Fluxo de Recebimento', () => {
  test.beforeEach(async ({ page }) => {
    if (!E2E) test.skip()

    // Login via magic link (assume test env auto-confirms)
    await page.goto('/login')
    await page.getByLabel(/e-mail/i).fill(OPERATOR_EMAIL)
    await page.getByRole('button', { name: /receber link/i }).click()
    // In test env, magic link redirect should be pre-configured
    await page.waitForURL(/\/operador/)
  })

  test('completa recebimento end-to-end com chave de acesso', async ({ page }) => {
    await page.goto('/operador/recebimento')

    // Etapa 1 — Chave de acesso (44 dígitos)
    const accessKey = '12345678901234567890123456789012345678901234'
    await page.getByLabel(/chave de acesso/i).fill(accessKey)
    await page.keyboard.press('Enter')
    await expect(page.getByText(/etapa 2/i)).toBeVisible({ timeout: 5000 })

    // Etapa 2 — RV
    await page.getByLabel(/rv/i).fill('RV-TEST-001')
    await page.keyboard.press('Enter')
    await expect(page.getByText(/etapa 3/i)).toBeVisible()

    // Etapa 3 — Número de itens
    await page.getByLabel(/número de itens/i).fill('3')
    await page.getByRole('button', { name: /próximo/i }).click()

    // Etapa 4 — Fotos da caixa (skip webcam, use file upload fallback if available)
    await expect(page.getByText(/etapa 4/i)).toBeVisible()
    // In E2E, assume webcam is mocked or test uses file input
    await page.getByRole('button', { name: /próximo/i }).click({ force: true })

    // Etapa 5 — Fotos dos itens
    await expect(page.getByText(/etapa 5/i)).toBeVisible()
    await page.getByRole('button', { name: /próximo/i }).click({ force: true })

    // Etapa 6 — Revisão
    await expect(page.getByText(/revisão/i)).toBeVisible()
    await expect(page.getByText('RV-TEST-001')).toBeVisible()
    await page.getByRole('button', { name: /confirmar/i }).click()

    // Etapa 7 — Sucesso
    await expect(page.getByText(/recebimento concluído/i)).toBeVisible({ timeout: 10000 })
  })
})
