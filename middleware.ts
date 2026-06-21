import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'
import type { UserRole } from '@/types'
import { ROLE_HOME } from '@/types'

const PUBLIC_ROUTES = ['/login', '/auth/callback', '/ativar', '/privacidade', '/termos']
const TERMS_EXEMPT  = ['/primeiro-acesso', '/aceite-termos', '/redefinir-senha', ...PUBLIC_ROUTES]

function isPublicRoute(pathname: string) {
  return PUBLIC_ROUTES.some((r) => pathname.startsWith(r))
}

function isTermsExempt(pathname: string) {
  return TERMS_EXEMPT.some((r) => pathname.startsWith(r))
}

function isAllowedForRole(pathname: string, role: UserRole) {
  if (role === 'manager') return true
  return pathname.startsWith(ROLE_HOME[role])
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
  const { supabase, user, response: updatedResponse } = await updateSession(request, response)
  response = updatedResponse

  // 1. Não autenticado → /login (exceto rotas públicas)
  if (!user && !isPublicRoute(pathname)) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // 2. Autenticado: ler claims do JWT (injetados via Auth Hook — sem DB hit)
  if (user) {
    const meta = user.app_metadata ?? {}
    let role            = meta.role as UserRole | undefined
    let active          = meta.active as boolean | undefined
    let termsAcceptedAt = meta.terms_accepted_at as string | null | undefined

    // Fallback: hook ausente ou claims ainda não injetados → consulta profiles
    if (!role) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role, active, terms_accepted_at')
        .eq('id', user.id)
        .single()

      if (profile) {
        role            = profile.role as UserRole
        active          = profile.active as boolean
        termsAcceptedAt = profile.terms_accepted_at as string | null
      }
    }

    // Sem profile cadastrado → deslogar
    if (!role) {
      const url = request.nextUrl.clone()
      url.pathname = '/api/auth/signout'
      return NextResponse.redirect(url)
    }

    // Usuário inativo → sign out + /login
    if (active === false) {
      const url = request.nextUrl.clone()
      url.pathname = '/api/auth/signout'
      return NextResponse.redirect(url)
    }

    // Autenticado em /login → home da role (ou aceite-termos)
    if (pathname === '/login') {
      if (!termsAcceptedAt) {
        const url = request.nextUrl.clone()
        url.pathname = '/primeiro-acesso'
        return NextResponse.redirect(url)
      }
      const url = request.nextUrl.clone()
      url.pathname = ROLE_HOME[role]
      return NextResponse.redirect(url)
    }

    // Termos não aceitos → /aceite-termos
    if (!termsAcceptedAt && !isTermsExempt(pathname)) {
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
