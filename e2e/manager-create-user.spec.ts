import { test, expect } from '@playwright/test'

const E2E = !!process.env.E2E_ENABLED
const MANAGER_EMAIL = process.env.E2E_MANAGER_EMAIL ?? ''

test.describe('Gerente — Criação de Usuário', () => {
  test.beforeEach(async ({ page }) => {
    if (!E2E) test.skip()

    await page.goto('/login')
    await page.getByLabel(/e-mail/i).fill(MANAGER_EMAIL)
    await page.getByRole('button', { name: /receber link/i }).click()
    await page.waitForURL(/\/admin/)
  })

  test('cria usuário cliente e vincula depositante', async ({ page }) => {
    await page.goto('/admin/usuarios')

    // Abre modal de criação
    await page.getByRole('button', { name: /novo usuário/i }).click()
    await expect(page.getByText(/criar usuário/i)).toBeVisible()

    // Preenche formulário
    const email = `e2e-test-${Date.now()}@logvale.test`
    await page.getByLabel(/nome/i).fill('Usuário E2E Teste')
    await page.getByLabel(/e-mail/i).fill(email)
    await page.getByLabel(/telefone/i).fill('21999999999')
    await page.getByLabel(/função/i).selectOption('client')

    // Vincula primeiro depositante disponível
    const firstDepositor = page.getByRole('checkbox').first()
    if (await firstDepositor.isVisible()) {
      await firstDepositor.check()
    }

    await page.getByRole('button', { name: /salvar/i }).click()

    // Usuário aparece na tabela
    await expect(page.getByText('Usuário E2E Teste')).toBeVisible({ timeout: 10000 })
    await expect(page.getByText(email)).toBeVisible()
  })
})
