import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StepItemCount } from '@/app/(operator)/operador/recebimento/steps/step-item-count'

const onComplete = vi.fn()
const onBack     = vi.fn()

function renderStep(props: { itemCount?: number | null; damagedItemCount?: number | null } = {}) {
  return render(
    <StepItemCount
      itemCount={props.itemCount ?? null}
      damagedItemCount={props.damagedItemCount ?? null}
      onComplete={onComplete}
      onBack={onBack}
    />,
  )
}

const next     = () => screen.getByRole('button', { name: /próximo/i })
const good     = () => screen.getByRole('button', { name: /^bom/i })
const damaged  = () => screen.getByRole('button', { name: /^avaria/i })
const empty    = () => screen.getByRole('button', { name: /^caixa vazia/i })
const quantity = () => screen.getByLabelText('Quantidade de itens')

beforeEach(() => {
  vi.clearAllMocks()
})

describe('StepItemCount — Etapa 3 (Itens)', () => {
  it('exige escolher o estado: sem pré-seleção, "Próximo" fica desabilitado', async () => {
    const user = userEvent.setup()
    renderStep()

    await user.type(quantity(), '3')
    expect(good()).toHaveAttribute('aria-pressed', 'false')
    expect(damaged()).toHaveAttribute('aria-pressed', 'false')
    expect(next()).toBeDisabled()

    await user.click(good())
    expect(next()).toBeEnabled()
    await user.click(next())
    expect(onComplete).toHaveBeenCalledWith(3, 0)
  })

  it('com Avaria pede quantos avariados e envia o número', async () => {
    const user = userEvent.setup()
    renderStep()

    await user.type(quantity(), '5')
    expect(screen.queryByLabelText('Quantos avariados?')).toBeNull()

    await user.click(damaged())
    const avariados = screen.getByLabelText('Quantos avariados?')
    expect(avariados).toHaveFocus()
    expect(screen.getByText('de 5')).toBeInTheDocument()
    expect(next()).toBeDisabled() // avariados ainda vazio

    await user.type(avariados, '2')
    await user.click(next())
    expect(onComplete).toHaveBeenCalledWith(5, 2)
  })

  it('bloqueia avariados acima da quantidade, com mensagem', async () => {
    const user = userEvent.setup()
    renderStep()

    await user.type(quantity(), '3')
    await user.click(damaged())
    await user.type(screen.getByLabelText('Quantos avariados?'), '4')

    expect(screen.getByText('Avariados não pode passar de 3.')).toBeInTheDocument()
    expect(next()).toBeDisabled()
  })

  it('com 1 item, Avaria já vem com 1 avariado', async () => {
    const user = userEvent.setup()
    renderStep()

    await user.type(quantity(), '1')
    await user.click(damaged())

    expect(screen.getByLabelText('Quantos avariados?')).toHaveValue(1)
    await user.click(next())
    expect(onComplete).toHaveBeenCalledWith(1, 1)
  })

  it('atalhos: B marca Bom e Enter avança', async () => {
    const user = userEvent.setup()
    renderStep()

    await user.type(quantity(), '4')
    await user.keyboard('b')
    expect(good()).toHaveAttribute('aria-pressed', 'true')
    expect(quantity()).toHaveValue(4) // a letra não vai para o campo

    await user.keyboard('{Enter}')
    expect(onComplete).toHaveBeenCalledWith(4, 0)
  })

  it('atalhos: A marca Avaria e foca o campo de avariados', async () => {
    const user = userEvent.setup()
    renderStep()

    await user.type(quantity(), '6')
    await user.keyboard('a')
    expect(damaged()).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByLabelText('Quantos avariados?')).toHaveFocus()

    await user.keyboard('3{Enter}')
    expect(onComplete).toHaveBeenCalledWith(6, 3)
  })

  it('Enter não avança enquanto o estado não foi escolhido', async () => {
    const user = userEvent.setup()
    renderStep()

    await user.type(quantity(), '2{Enter}')
    expect(onComplete).not.toHaveBeenCalled()
  })

  it('Enter num botão aciona só o botão (Voltar não envia a etapa)', async () => {
    const user = userEvent.setup()
    renderStep({ itemCount: 2, damagedItemCount: 0 })

    screen.getByRole('button', { name: /voltar/i }).focus()
    await user.keyboard('{Enter}')

    expect(onBack).toHaveBeenCalledTimes(1)
    expect(onComplete).not.toHaveBeenCalled()
  })

  it('ao voltar para a etapa, restaura o que foi escolhido', () => {
    const { unmount } = renderStep({ itemCount: 5, damagedItemCount: 2 })
    expect(damaged()).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByLabelText('Quantos avariados?')).toHaveValue(2)
    unmount()

    renderStep({ itemCount: 5, damagedItemCount: 0 })
    expect(good()).toHaveAttribute('aria-pressed', 'true')
    expect(next()).toBeEnabled()
  })

  it('Caixa vazia dispensa a quantidade e envia 0 itens', async () => {
    const user = userEvent.setup()
    renderStep()

    expect(next()).toBeDisabled()
    await user.click(empty())
    expect(empty()).toHaveAttribute('aria-pressed', 'true')
    expect(quantity()).toBeDisabled()
    expect(quantity()).toHaveValue(0)
    await user.click(next())
    expect(onComplete).toHaveBeenCalledWith(0, 0)
  })

  it('atalho V marca Caixa vazia; trocar para Bom restaura a quantidade digitada', async () => {
    const user = userEvent.setup()
    renderStep()

    await user.type(quantity(), '3')
    await user.keyboard('v')
    expect(empty()).toHaveAttribute('aria-pressed', 'true')
    expect(quantity()).toHaveValue(0)

    await user.click(good())
    expect(quantity()).toBeEnabled()
    expect(quantity()).toHaveValue(3)
    await user.click(next())
    expect(onComplete).toHaveBeenCalledWith(3, 0)
  })

  it('ao voltar para a etapa, restaura Caixa vazia', () => {
    renderStep({ itemCount: 0, damagedItemCount: 0 })
    expect(empty()).toHaveAttribute('aria-pressed', 'true')
    expect(next()).toBeEnabled()
  })

  it('diminuir a quantidade abaixo dos avariados bloqueia o avanço', async () => {
    const user = userEvent.setup()
    renderStep({ itemCount: 5, damagedItemCount: 4 })

    await user.clear(quantity())
    await user.type(quantity(), '3')

    expect(screen.getByText('Avariados não pode passar de 3.')).toBeInTheDocument()
    expect(next()).toBeDisabled()
  })
})
