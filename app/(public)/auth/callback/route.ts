import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ROLE_HOME } from '@/types'
import type { UserRole } from '@/types'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (!code) return NextResponse.redirect(`${origin}/login?error=auth_callback_error`)

  const supabase = createClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)
  if (error) return NextResponse.redirect(`${origin}/login?error=auth_callback_error`)

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
