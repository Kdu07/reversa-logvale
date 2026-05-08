import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ROLE_HOME } from '@/types'
import type { UserRole } from '@/types'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'

  if (code) {
    const supabase = createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role, terms_accepted_at')
          .eq('id', user.id)
          .single()

        if (profile) {
          if (!profile.terms_accepted_at) {
            return NextResponse.redirect(`${origin}/aceite-termos`)
          }
          const homeUrl = ROLE_HOME[profile.role as UserRole]
          return NextResponse.redirect(`${origin}${homeUrl}`)
        }
      }

      // Fallback: raiz (middleware cuida do redirect)
      const forwardedHost = request.headers.get('x-forwarded-host')
      const isLocal = process.env.NODE_ENV === 'development'

      if (isLocal) {
        return NextResponse.redirect(`${origin}${next}`)
      } else if (forwardedHost) {
        return NextResponse.redirect(`https://${forwardedHost}${next}`)
      } else {
        return NextResponse.redirect(`${origin}${next}`)
      }
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_error`)
}
