import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { updateSession } from '@/lib/supabase/middleware'
import type { UserRole } from '@/types'
import { ROLE_HOME } from '@/types'

const PUBLIC_ROUTES = ['/login', '/auth/callback', '/privacidade', '/termos']
const TERMS_EXEMPT  = ['/aceite-termos', '/auth/callback', '/login', '/privacidade', '/termos']

const ROLE_PREFIXES: Record<UserRole, string> = {
  operator: '/operador',
  client:   '/cliente',
  manager:  '/admin',
}

function isPublicRoute(pathname: string) {
  return PUBLIC_ROUTES.some((r) => pathname.startsWith(r))
}

function isTermsExempt(pathname: string) {
  return TERMS_EXEMPT.some((r) => pathname.startsWith(r))
}

function isAllowedForRole(pathname: string, role: UserRole) {
  if (role === 'manager') return true
  return pathname.startsWith(ROLE_PREFIXES[role])
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Passa internos do Next.js e assets sem verificação
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api')   ||
    pathname.includes('.')
  ) {
    return NextResponse.next()
  }

  let response = NextResponse.next({ request: { headers: request.headers } })

  // Renova cookies de sessão e obtém o usuário
  const { user, response: updatedResponse } = await updateSession(request, response)
  response = updatedResponse

  // 1. Não autenticado → /login (exceto rotas públicas)
  if (!user && !isPublicRoute(pathname)) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // 2. Autenticado: verificar profile para decisões de redirect
  if (user) {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => request.cookies.getAll(), setAll: () => {} } }
    )

    const { data: profile } = await supabase
      .from('profiles')
      .select('role, terms_accepted_at, active')
      .eq('id', user.id)
      .single()

    // Usuário inativo → /login
    if (!profile || !profile.active) {
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      return NextResponse.redirect(url)
    }

    const role = profile.role as UserRole

    // Autenticado em /login → home da role (ou aceite-termos)
    if (pathname === '/login') {
      if (!profile.terms_accepted_at) {
        const url = request.nextUrl.clone()
        url.pathname = '/aceite-termos'
        return NextResponse.redirect(url)
      }
      const url = request.nextUrl.clone()
      url.pathname = ROLE_HOME[role]
      return NextResponse.redirect(url)
    }

    // Termos não aceitos → /aceite-termos
    if (!profile.terms_accepted_at && !isTermsExempt(pathname)) {
      const url = request.nextUrl.clone()
      url.pathname = '/aceite-termos'
      return NextResponse.redirect(url)
    }

    // Cross-role → home da própria role
    if (!isPublicRoute(pathname) && !isTermsExempt(pathname) && !isAllowedForRole(pathname, role)) {
      const url = request.nextUrl.clone()
      url.pathname = ROLE_HOME[role]
      return NextResponse.redirect(url)
    }
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
