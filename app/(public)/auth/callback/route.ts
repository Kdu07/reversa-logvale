import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ROLE_HOME } from '@/types'
import type { UserRole } from '@/types'
import type { EmailOtpType } from '@supabase/supabase-js'

// Tipos de OTP que o callback aceita. Ativação de conta NÃO passa por aqui
// (usa o token próprio em /ativar); restam o recovery (redefinição de senha) e
// o magiclink legado (compatibilidade com links em trânsito).
const ALLOWED_TYPES = new Set<EmailOtpType>(['recovery', 'magiclink'])

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const tokenHash = searchParams.get('token_hash')
  const type      = searchParams.get('type') as EmailOtpType | null
  const code      = searchParams.get('code')

  const supabase = createClient()

  // token_hash + type: links gerados pelo admin, verificados com verifyOtp (não
  // há PKCE verifier no navegador do destinatário). Restringimos o `type` a uma
  // allowlist para não confiar cegamente no valor da query string.
  if (tokenHash && type) {
    if (!ALLOWED_TYPES.has(type)) {
      return NextResponse.redirect(`${origin}/login?error=auth_callback_error`)
    }
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash })
    if (error) return NextResponse.redirect(`${origin}/login?error=auth_callback_error`)

    // Recovery cria a sessão, mas o usuário precisa definir uma nova senha antes
    // de seguir — não mandamos direto para a home.
    if (type === 'recovery') {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return NextResponse.redirect(`${origin}/login?error=auth_callback_error`)
      return NextResponse.redirect(`${origin}/redefinir-senha`)
    }
  } else if (code) {
    // Ramo defensivo: fluxo PKCE iniciado no navegador (signInWithOtp). Nenhum
    // ponto do app o usa hoje, mas mantemos o suporte caso venha a existir.
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) return NextResponse.redirect(`${origin}/login?error=auth_callback_error`)
  } else {
    return NextResponse.redirect(`${origin}/login?error=auth_callback_error`)
  }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(`${origin}/login?error=auth_callback_error`)

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, terms_accepted_at')
    .eq('id', user.id)
    .single()

  if (!profile) return NextResponse.redirect(`${origin}/`)

  if (!profile.terms_accepted_at) return NextResponse.redirect(`${origin}/primeiro-acesso`)
  return NextResponse.redirect(`${origin}${ROLE_HOME[profile.role as UserRole]}`)
}
