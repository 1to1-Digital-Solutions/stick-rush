import type { Metadata, Viewport } from 'next'
import { Righteous, Poppins } from 'next/font/google'
import './globals.css'
import { requestLang } from '../lib/server-lang'
import { gameName } from '../lib/menuTemplate'
import { translator } from '../lib/textos'

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

/**
 * What the tab says and what is read when the link is shared, in the hall's language.
 *
 * It is a function and not a constant because the language arrives in the request's cookie
 * (see `lib/settings.ts`), and that can only be read in here.
 */
export async function generateMetadata(): Promise<Metadata> {
  const t = translator(await requestLang())

  return {
    // Like the catalogue's cabinet: the game's own website does not go through the hall, so it is the package's.
    title: gameName(),
    description: t('Catch the sticks falling from the machine before they hit the ground. Play in the browser or in mixed reality (VR/AR).'),
  }
}


export const viewport: Viewport = {
  themeColor: '#0F172A',
  width: 'device-width',
  initialScale: 1,
  // No `maximumScale`: blocking zoom breaks WCAG 1.4.4 and leaves out
  // whoever needs to zoom in to read the menu.
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  // The language comes from the cookie the hall's menu sets: the document's
  // `lang` is what screen readers use to choose a voice, so it has to say
  // what language the content inside is in.
  const lang = await requestLang()

  return (
    <html lang={lang} className={`${righteous.variable} ${poppins.variable}`}>
      <body>{children}</body>
    </html>
  )
}
