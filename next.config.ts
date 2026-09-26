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
 *
 * Y `connect-src blob:` lo pide el modelo del mando que enseña el tutorial: el
 * `.glb` se sirve desde el propio origen, pero sus texturas van dentro del
 * fichero y three las saca a una URL `blob:` que después **pide con `fetch`**
 * (`ImageBitmapLoader`). Sin ella el mando sale en negro y la consola escupe un
 * error de política. Sigue siendo de casa: no abre el paso a nada de fuera.
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
  // `'unsafe-eval'` solo con `next dev`: el React de desarrollo usa `eval` para rehacer las pilas
  // de llamadas y sin él cada carga deja un error en la consola. El build no lo lleva nunca —ni,
  // con él, permiso para compilar WebAssembly—, y eso lo vigila `src/csp.test.ts`.
  process.env.NODE_ENV === 'development'
    ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
    : "script-src 'self' 'unsafe-inline'",
  "worker-src 'self' blob:",
  "connect-src 'self' blob:",
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
  /**
   * Next 16 añade un bloque suyo al `CLAUDE.md` del proyecto cada vez que se
   * ejecuta `next dev` o `next build`. Aquí `CLAUDE.md` está escrito a mano y
   * versionado, así que eso deja el árbol sucio en cada verificación y acaba
   * commiteado sin que nadie lo decida. Las instrucciones del repo viven en
   * `CLAUDE.md` y `.claude/rules/`; que las escriba un paso de build, no.
   */
  agentRules: false,
  /**
   * Desde qué máquinas se puede abrir el servidor de desarrollo.
   *
   * **Sin esto, `npm run dev` da una página muerta en cuanto no se entra por `localhost`.**
   * Next bloquea por defecto los recursos de `/_next/*` cuando la petición llega con un
   * `Origin` que no reconoce, y contesta un 403 a cada trozo de JavaScript: el HTML carga, el
   * texto de la portada se ve y no se monta nada. No sale un error de CSP ni una traza — solo
   * una pantalla a medias—, y por eso se diagnosticó mal durante tandas: no es que al React de
   * desarrollo le falte `unsafe-eval`, es esto.
   *
   * Y aquí importa más que en un proyecto normal, porque **el visor no entra por `localhost`**:
   * se prueba con `dev:https` desde el Quest, contra la IP de esta máquina en la red de casa.
   * Por eso van los dos rangos privados además del propio equipo.
   *
   * Es una opción **solo de desarrollo**: `next build` la ignora, así que no afloja nada de lo
   * que se sirve de verdad.
   */
  allowedDevOrigins: ['127.0.0.1', '192.168.*.*', '10.*.*.*'],

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
