import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ROLE_HOME } from '@/types'
import type { UserRole } from '@/types'
import type { EmailOtpType } from '@supabase/supabase-js'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const tokenHash = searchParams.get('token_hash')
  const type      = searchParams.get('type') as EmailOtpType | null
  const code      = searchParams.get('code')

  const supabase = createClient()

  // Admin-generated activation links carry a token_hash and are verified with
  // verifyOtp (no PKCE verifier exists in the recipient's browser). Browser-initiated
  // PKCE flows carry a code exchanged with exchangeCodeForSession.
  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash })
    if (error) return NextResponse.redirect(`${origin}/login?error=auth_callback_error`)
  } else if (code) {
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
