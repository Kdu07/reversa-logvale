import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'
import type { UserRole } from '@/types'
import { ROLE_HOME } from '@/types'

const PUBLIC_ROUTES = ['/login', '/auth/callback', '/privacidade', '/termos']
const TERMS_EXEMPT  = ['/primeiro-acesso', '/aceite-termos', ...PUBLIC_ROUTES]

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
  const { user, response: updatedResponse } = await updateSession(request, response)
  response = updatedResponse

  // 1. Não autenticado → /login (exceto rotas públicas)
  if (!user && !isPublicRoute(pathname)) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // 2. Autenticado: ler claims do JWT (injetados via Auth Hook — sem DB hit)
  if (user) {
    const meta             = user.app_metadata ?? {}
    const role             = meta.role as UserRole | undefined
    const active           = meta.active as boolean | undefined
    const termsAcceptedAt  = meta.terms_accepted_at as string | null | undefined

    // Claims ausentes = usuário criado antes do hook ser ativado → forçar re-login
    if (!role) {
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      return NextResponse.redirect(url)
    }

    // Usuário inativo → /login
    if (active === false) {
      const url = request.nextUrl.clone()
      url.pathname = '/login'
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
