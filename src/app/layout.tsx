import type { Metadata, Viewport } from 'next'
import { Righteous, Poppins } from 'next/font/google'
import './globals.css'

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
    'Atrapa los palos que caen de la máquina antes de que toquen el suelo. Juega en navegador o en realidad mixta (VR/AR).',
}

export const viewport: Viewport = {
  themeColor: '#0F172A',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="es" className={`${righteous.variable} ${poppins.variable}`}>
      <body>{children}</body>
    </html>
  )
}
