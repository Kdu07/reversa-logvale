import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { consumeActivationToken } from '@/lib/auth/activation-token'

// Ativação de conta via token próprio (válido até o uso, uso único).
//
// O link enviado por e-mail aponta para cá com `?token=<segredo>`. Diferente do
// OTP do Supabase (1h), este token não expira por tempo: vale enquanto a conta
// não foi ativada. Ao clicar, criamos a sessão server-side mintando um OTP curto
// do Supabase e verificando-o com o client de servidor (cookies). O token só é
// marcado como usado quando a ativação conclui (em /primeiro-acesso).
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const token = searchParams.get('token')

  const userId = await consumeActivationToken(token ?? '')
  if (!userId) return NextResponse.redirect(`${origin}/login?error=auth_callback_error`)

  const admin = createAdminClient()

  // Conta já ativada → token obsoleto: usar e-mail e senha no login normal.
  const { data: profile } = await admin
    .from('profiles')
    .select('terms_accepted_at')
    .eq('id', userId)
    .single()
  if (profile?.terms_accepted_at) return NextResponse.redirect(`${origin}/login`)

  // Resolve o e-mail do usuário para mintar o OTP.
  const { data: authData, error: authErr } = await admin.auth.admin.getUserById(userId)
  const email = authData?.user?.email
  if (authErr || !email) return NextResponse.redirect(`${origin}/login?error=auth_callback_error`)

  // Minta um OTP curto e o verifica para criar a sessão (grava cookies).
  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
    type:  'magiclink',
    email,
  })
  const tokenHash = linkData?.properties?.hashed_token
  if (linkErr || !tokenHash) return NextResponse.redirect(`${origin}/login?error=auth_callback_error`)

  const supabase = createClient()
  const { error: verifyErr } = await supabase.auth.verifyOtp({ type: 'magiclink', token_hash: tokenHash })
  if (verifyErr) return NextResponse.redirect(`${origin}/login?error=auth_callback_error`)

  return NextResponse.redirect(`${origin}/primeiro-acesso`)
}
