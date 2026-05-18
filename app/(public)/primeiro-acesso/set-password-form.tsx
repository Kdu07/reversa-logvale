'use client'

import { useFormStatus } from 'react-dom'
import { useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ptBR } from '@/lib/i18n/pt-BR'

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus()
  const t = ptBR.auth.firstAccess
  return (
    <Button
      type="submit"
      className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
      disabled={disabled || pending}
    >
      {pending ? t.submitting : t.submitButton}
    </Button>
  )
}

interface SetPasswordFormProps {
  action: (formData: FormData) => Promise<void>
}

export default function SetPasswordForm({ action }: SetPasswordFormProps) {
  const [password,  setPassword]  = useState('')
  const [confirm,   setConfirm]   = useState('')
  const [termsOk,   setTermsOk]   = useState(false)
  const t  = ptBR.auth.firstAccess
  const tT = ptBR.auth.terms

  const passwordError = password.length > 0 && password.length < 8
    ? t.errorPasswordMin : null
  const confirmError  = confirm.length > 0 && confirm !== password
    ? t.errorPasswordMatch : null
  const canSubmit = password.length >= 8 && password === confirm && termsOk

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t.title}</CardTitle>
        <CardDescription>{t.subtitle}</CardDescription>
      </CardHeader>
      <form action={action}>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password">{t.passwordLabel}</Label>
            <Input
              id="password"
              name="password"
              type="password"
              placeholder={t.passwordPlaceholder}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
              autoComplete="new-password"
              required
            />
            {passwordError && (
              <p className="text-sm text-destructive">{passwordError}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm">{t.confirmLabel}</Label>
            <Input
              id="confirm"
              name="confirm"
              type="password"
              placeholder={t.confirmPlaceholder}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
              required
            />
            {confirmError && (
              <p className="text-sm text-destructive">{confirmError}</p>
            )}
          </div>
          <div className="flex items-start gap-3 pt-2">
            <Checkbox
              id="terms"
              name="terms"
              checked={termsOk}
              onCheckedChange={(v) => setTermsOk(v === true)}
              className="mt-0.5"
            />
            <Label htmlFor="terms" className="text-sm leading-relaxed cursor-pointer">
              {tT.checkboxLabel}{' '}
              <Link href="/termos" className="underline text-primary hover:text-primary/80" target="_blank">
                {tT.termsLink}
              </Link>
              {tT.linksSeparator}
              <Link href="/privacidade" className="underline text-primary hover:text-primary/80" target="_blank">
                {tT.privacyLink}
              </Link>
              .
            </Label>
          </div>
        </CardContent>
        <CardFooter>
          <SubmitButton disabled={!canSubmit} />
        </CardFooter>
      </form>
    </Card>
  )
}
