'use client'

import { useState } from 'react'
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { AccessKeyForm } from './access-key-form'
import { KeyRound } from 'lucide-react'

interface AccessKeyDialogProps {
  returnId: string
  rv:       string
}

/**
 * Atalho para informar a chave sem sair da tabela de devoluções. O fluxo
 * completo (com fotos e contexto) fica em /cliente/notas-pendentes.
 */
export function AccessKeyDialog({ returnId, rv }: AccessKeyDialogProps) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800 transition-colors ease-quint hover:bg-amber-100"
      >
        <KeyRound className="h-3 w-3" />
        Informar chave
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Informar chave · {rv}</DialogTitle>
            <DialogDescription>
              Esta devolução foi recebida sem a chave de acesso da NF de origem. Informe os
              44 dígitos da chave da NF de venda.
            </DialogDescription>
          </DialogHeader>

          <AccessKeyForm returnId={returnId} />
        </DialogContent>
      </Dialog>
    </>
  )
}
