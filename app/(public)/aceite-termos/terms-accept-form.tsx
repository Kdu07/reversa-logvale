'use client'

import { useFormStatus } from 'react-dom'
import { useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { ptBR } from '@/lib/i18n/pt-BR'

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus()
  const t = ptBR.auth.terms

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

interface TermsAcceptFormProps {
  action: (formData: FormData) => Promise<void>
}

export default function TermsAcceptForm({ action }: TermsAcceptFormProps) {
  const [checked, setChecked] = useState(false)
  const t = ptBR.auth.terms

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t.title}</CardTitle>
        <CardDescription>{t.subtitle}</CardDescription>
      </CardHeader>
      <form action={action}>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-3">
            <Checkbox
              id="terms"
              name="terms"
              checked={checked}
              onCheckedChange={(v) => setChecked(v === true)}
              className="mt-0.5"
            />
            <Label
              htmlFor="terms"
              className="text-sm leading-relaxed cursor-pointer"
            >
              {t.checkboxLabel}{' '}
              <Link
                href="/termos"
                className="underline text-primary hover:text-primary/80"
                target="_blank"
              >
                {t.termsLink}
              </Link>
              {t.linksSeparator}
              <Link
                href="/privacidade"
                className="underline text-primary hover:text-primary/80"
                target="_blank"
              >
                {t.privacyLink}
              </Link>
              .
            </Label>
          </div>
        </CardContent>
        <CardFooter>
          <SubmitButton disabled={!checked} />
        </CardFooter>
      </form>
    </Card>
  )
}
