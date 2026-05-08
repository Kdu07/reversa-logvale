import type { Metadata } from 'next'
import { Roboto } from 'next/font/google'
import './globals.css'

const roboto = Roboto({
  weight:   ['400', '500', '700'],
  subsets:  ['latin'],
  variable: '--font-roboto',
  display:  'swap',
})

export const metadata: Metadata = {
  title:       'Logvale — Gestão de Devoluções',
  description: 'Sistema de gestão de devoluções logísticas Logvale',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className={`${roboto.variable} font-sans antialiased`}>
        {children}
      </body>
    </html>
  )
}
