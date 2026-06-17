import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DownloadXmlButton } from '@/components/shared/download-xml-button'

// action assina a URL on-click
const getXmlDownloadUrlAction = vi.fn()
vi.mock('@/lib/actions/xml-download', () => ({
  getXmlDownloadUrlAction: (path: string, filename: string) => getXmlDownloadUrlAction(path, filename),
}))

// captura o href da âncora temporária sem navegar de verdade (jsdom)
const clickedHrefs: string[] = []
let clickSpy: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  vi.clearAllMocks()
  clickedHrefs.length = 0
  clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    clickedHrefs.push(this.href)
  })
})

afterEach(() => {
  clickSpy.mockRestore()
})

describe('DownloadXmlButton', () => {
  it('assina on-click e dispara o download na âncora com a URL retornada', async () => {
    getXmlDownloadUrlAction.mockResolvedValue('https://signed.example/url?download=RV1-nf-devolucao.xml')

    render(<DownloadXmlButton path="decisions/r-1/1.xml" filename="RV1-nf-devolucao.xml" />)
    await userEvent.click(screen.getByRole('button', { name: /baixar xml/i }))

    await waitFor(() => expect(clickSpy).toHaveBeenCalledTimes(1))
    expect(getXmlDownloadUrlAction).toHaveBeenCalledWith('decisions/r-1/1.xml', 'RV1-nf-devolucao.xml')
    expect(clickedHrefs[0]).toContain('https://signed.example/url')
  })

  it('não dispara download quando a action retorna null', async () => {
    getXmlDownloadUrlAction.mockResolvedValue(null)

    render(<DownloadXmlButton path="x.xml" filename="x.xml" />)
    await userEvent.click(screen.getByRole('button', { name: /baixar xml/i }))

    await waitFor(() => expect(getXmlDownloadUrlAction).toHaveBeenCalled())
    expect(clickSpy).not.toHaveBeenCalled()
  })

  it('renderiza o label customizado', () => {
    render(<DownloadXmlButton path="x.xml" filename="x.xml" label="Devolução" />)
    expect(screen.getByRole('button', { name: 'Devolução' })).toBeInTheDocument()
  })
})
