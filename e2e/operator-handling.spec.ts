import { test, expect } from '@playwright/test'

const E2E = !!process.env.E2E_ENABLED
const OPERATOR_EMAIL = process.env.E2E_OPERATOR_EMAIL ?? ''

test.describe('Operador — Tratativas', () => {
  test.beforeEach(async ({ page }) => {
    if (!E2E) test.skip()

    await page.goto('/login')
    await page.getByLabel(/e-mail/i).fill(OPERATOR_EMAIL)
    await page.getByRole('button', { name: /receber link/i }).click()
    await page.waitForURL(/\/operador/)
  })

  test('conclui uma tratativa', async ({ page }) => {
    await page.goto('/operador/tratativas')

    // Deve mostrar lista de tratativas pendentes
    await expect(page.getByRole('heading', { name: /tratativas/i })).toBeVisible()

    // Clica em "Concluir" na primeira tratativa disponível
    const concluirBtn = page.getByRole('button', { name: /concluir/i }).first()
    await expect(concluirBtn).toBeVisible({ timeout: 5000 })
    await concluirBtn.click()

    // Modal de confirmação
    await expect(page.getByText(/confirma conclusão/i)).toBeVisible()
    await page.getByRole('button', { name: /^confirmar$/i }).click()

    // Feedback de sucesso e item some da lista
    await expect(page.getByText(/confirma conclusão/i)).not.toBeVisible({ timeout: 5000 })
  })
})
