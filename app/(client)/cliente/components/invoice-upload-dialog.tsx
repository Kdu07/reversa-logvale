'use client'

import { useState } from 'react'
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { InvoiceUploadForm } from './invoice-upload-form'
import { FilePlus2 } from 'lucide-react'

interface InvoiceUploadDialogProps {
  returnId: string
  rv:       string
}

/**
 * Atalho para anexar a NF sem sair da tabela de devoluções. O fluxo completo
 * (com fotos e contexto) fica em /cliente/notas-pendentes; aqui é só a ação.
 */
export function InvoiceUploadDialog({ returnId, rv }: InvoiceUploadDialogProps) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800 transition-colors ease-quint hover:bg-amber-100"
      >
        <FilePlus2 className="h-3 w-3" />
        Anexar NF
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Anexar NF · {rv}</DialogTitle>
            <DialogDescription>
              Esta devolução foi recebida sem chave de acesso, então a NF não pôde ser
              consultada automaticamente. Envie o XML ou o DANFE.
            </DialogDescription>
          </DialogHeader>

          <InvoiceUploadForm returnId={returnId} />
        </DialogContent>
      </Dialog>
    </>
  )
}
