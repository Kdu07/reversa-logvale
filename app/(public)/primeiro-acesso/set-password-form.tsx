'use client'

import { useFormStatus, useFormState } from 'react-dom'
import { useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertCircle } from 'lucide-react'
import { ptBR } from '@/lib/i18n/pt-BR'
import { validatePassword } from '@/lib/validation/password'

export interface PasswordFormState {
  error?: string
}

function SubmitButton({ disabled, label, submittingLabel }: { disabled: boolean; label: string; submittingLabel: string }) {
  const { pending } = useFormStatus()
  return (
    <Button
      type="submit"
      className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
      disabled={disabled || pending}
    >
      {pending ? submittingLabel : label}
    </Button>
  )
}

interface SetPasswordFormProps {
  action:       (state: PasswordFormState, formData: FormData) => Promise<PasswordFormState>
  requireTerms?: boolean
  title?:        string
  subtitle?:     string
  submitLabel?:  string
}

export default function SetPasswordForm({
  action,
  requireTerms = true,
  title,
  subtitle,
  submitLabel,
}: SetPasswordFormProps) {
  const [state, formAction] = useFormState(action, {})
  const [password,  setPassword]  = useState('')
  const [confirm,   setConfirm]   = useState('')
  const [termsOk,   setTermsOk]   = useState(false)
  const t  = ptBR.auth.firstAccess
  const tT = ptBR.auth.terms

  const passwordError = password.length > 0 ? validatePassword(password) : null
  const confirmError  = confirm.length > 0 && confirm !== password
    ? t.errorPasswordMatch : null
  const canSubmit =
    validatePassword(password) === null &&
    password === confirm &&
    (!requireTerms || termsOk)

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title ?? t.title}</CardTitle>
        <CardDescription>{subtitle ?? t.subtitle}</CardDescription>
      </CardHeader>
      <form action={formAction}>
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
          {requireTerms && (
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
          )}
          {state.error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          )}
        </CardContent>
        <CardFooter>
          <SubmitButton
            disabled={!canSubmit}
            label={submitLabel ?? t.submitButton}
            submittingLabel={t.submitting}
          />
        </CardFooter>
      </form>
    </Card>
  )
}
