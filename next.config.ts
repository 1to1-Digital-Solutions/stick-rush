import type { NextConfig } from 'next'

/**
 * Content security policy.
 *
 * The key is `connect-src 'self'`: the game has to work in a headset
 * connected only to the local network, and several libraries of the tree bring
 * hard-wired CDN URLs (the controller models of @react-three/xr on jsDelivr,
 * drei's preset HDRIs on raw.githack, troika's fonts on jsDelivr). None is
 * used today, but the CSP turns that into a guarantee the browser enforces
 * instead of a promise that has to be remembered.
 *
 * `script-src` carries 'unsafe-inline' because Next injects the RSC payload in
 * inline scripts and the pages are static: using a nonce would force adding
 * middleware and would make the whole site dynamic. The risk that leaves open
 * is low here: there is no user input that gets rendered, nor innerHTML, nor
 * dangerouslySetInnerHTML in the whole project.
 *
 * `blob:` in img-src and worker-src is needed by three.js and its loaders.
 *
 * And `connect-src blob:` is asked for by the controller model the tutorial
 * shows: the `.glb` is served from the same origin, but its textures go inside
 * the file and three takes them out to a `blob:` URL that it then **requests
 * with `fetch`** (`ImageBitmapLoader`). Without it the controller comes out
 * black and the console spits a policy error. It is still in-house: it opens
 * the way to nothing from outside.
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
  // `'unsafe-eval'` only with `next dev`: development React uses `eval` to rebuild the call
  // stacks and without it every load leaves an error in the console. The build never carries it
  // —nor, with it, permission to compile WebAssembly—, and `src/csp.test.ts` watches that.
  process.env.NODE_ENV === 'development'
    ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
    : "script-src 'self' 'unsafe-inline'",
  "worker-src 'self' blob:",
  "connect-src 'self' blob:",
  // The background music is served from the same origin, like everything else.
  "media-src 'self'",
].join('; ')

/**
 * Browser permissions.
 *
 * `xr-spatial-tracking=(self)` is mandatory: without it WebXR does not start
 * and the game stops working in the headset. The sensors and the camera are
 * left at `self` on purpose, because the headset's tracking and the AR
 * passthrough rely on them; what is closed is what the game will never use.
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
   * Next 16 adds a block of its own to the project's `CLAUDE.md` every time
   * `next dev` or `next build` runs. Here `CLAUDE.md` is written by hand and
   * versioned, so that leaves the tree dirty on every verification and ends up
   * committed without anyone deciding it. The repo's instructions live in
   * `CLAUDE.md` and `.claude/rules/`; having a build step write them, no.
   */
  agentRules: false,
  /**
   * Which machines the development server can be opened from.
   *
   * **Without this, `npm run dev` gives a dead page as soon as one does not come in through
   * `localhost`.** By default Next blocks the `/_next/*` resources when the request arrives
   * with an `Origin` it does not recognise, and answers a 403 to every chunk of JavaScript: the
   * HTML loads, the text of the home page shows and nothing mounts. No CSP error or trace comes
   * out — only a half-done screen—, and that is why it was misdiagnosed for several rounds of
   * work: it is not that development React is missing `unsafe-eval`, it is this.
   *
   * And here it matters more than in a normal project, because **the headset does not come in
   * through `localhost`**: it is tested with `dev:https` from the Quest, against this machine's
   * IP on the home network. That is why the two private ranges go in besides this computer.
   *
   * It is a **development-only** option: `next build` ignores it, so it loosens nothing of
   * what is really served.
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
