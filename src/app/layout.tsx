import type { Metadata, Viewport } from 'next'
import { Righteous, Poppins } from 'next/font/google'
import './globals.css'
import { idiomaDeLaPeticion } from '../lib/idioma-servidor'

const righteous = Righteous({
  variable: '--font-heading',
  subsets: ['latin'],
  weight: '400',
})

const poppins = Poppins({
  variable: '--font-body',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
})

export const metadata: Metadata = {
  title: 'Stick Rush',
  description:
    'Catch the sticks falling from the machine before they hit the ground. Play in the browser or in mixed reality (VR/AR).',
}

export const viewport: Viewport = {
  themeColor: '#0F172A',
  width: 'device-width',
  initialScale: 1,
  // Sin `maximumScale`: bloquear el zoom incumple WCAG 1.4.4 y deja fuera a
  // quien necesita ampliar para leer el menú.
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  // El idioma sale de la cookie que pone el menú del arcade: el `lang` del
  // documento es lo que usan los lectores de pantalla para elegir voz, así
  // que tiene que decir en qué idioma está lo que hay dentro.
  const lang = await idiomaDeLaPeticion()

  return (
    <html lang={lang} className={`${righteous.variable} ${poppins.variable}`}>
      <body>{children}</body>
    </html>
  )
}
