import type { NextConfig } from 'next'

/**
 * Política de seguridad de contenido.
 *
 * La clave es `connect-src 'self'`: el juego tiene que funcionar en un visor
 * conectado solo a la red local, y varias librerías del árbol traen URLs de CDN
 * cableadas (los modelos de mando de @react-three/xr en jsDelivr, los HDRI de
 * preset de drei en raw.githack, las fuentes de troika en jsDelivr). Ninguna se
 * usa hoy, pero la CSP convierte eso en una garantía que impone el navegador en
 * vez de una promesa que hay que recordar.
 *
 * `script-src` lleva 'unsafe-inline' porque Next inyecta el payload de RSC en
 * scripts inline y las páginas son estáticas: usar un nonce obligaría a meter
 * middleware y volvería dinámico todo el sitio. El riesgo que eso deja abierto
 * es bajo aquí: no hay entrada de usuario que se renderice, ni innerHTML, ni
 * dangerouslySetInnerHTML en todo el proyecto.
 *
 * `blob:` en img-src y worker-src lo necesitan three.js y sus loaders.
 */
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "form-action 'self'",
  "frame-ancestors 'self'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "script-src 'self' 'unsafe-inline'",
  "worker-src 'self' blob:",
  "connect-src 'self'",
  // La música de fondo se sirve desde el propio origen, como todo lo demás.
  "media-src 'self'",
].join('; ')

/**
 * Permisos del navegador.
 *
 * `xr-spatial-tracking=(self)` es obligatorio: sin él WebXR no arranca y el
 * juego deja de funcionar en el visor. Los sensores y la cámara se dejan en
 * `self` a propósito, porque el seguimiento del visor y el passthrough de AR se
 * apoyan en ellos; lo que se cierra es lo que el juego no usará nunca.
 */
const PERMISSIONS_POLICY = [
  'accelerometer=(self)',
  'camera=(self)',
  'gyroscope=(self)',
  'magnetometer=(self)',
  'xr-spatial-tracking=(self)',
  'geolocation=()',
  'microphone=()',
  'payment=()',
  'usb=()',
].join(', ')

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: CONTENT_SECURITY_POLICY },
          { key: 'Permissions-Policy', value: PERMISSIONS_POLICY },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
        ],
      },
    ]
  },
}

export default nextConfig
