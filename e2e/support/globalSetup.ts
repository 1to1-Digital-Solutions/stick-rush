import path from 'node:path'
import { build } from 'esbuild'

const SUPPORT = path.join(process.cwd(), 'e2e/support')
export const XR_EMULATOR_BUNDLE = path.join(SUPPORT, 'xr-emulator.bundle.js')
export const HOST_BUNDLE = path.join(SUPPORT, 'host.bundle.js')

/**
 * Bundles before the suite what is injected into the browser: the WebXR emulator (IWER,
 * a pretend Quest 3, because Chromium ships no WebXR and without it the immersive paths
 * never run) and the test host, which mounts `<StickRushScene>` inside
 * someone else's Canvas, as the xrcade hall does.
 */
export default async function globalSetup() {
  await Promise.all([
    bundle('xr-emulator.src.ts', XR_EMULATOR_BUNDLE),
    bundle('host.src.tsx', HOST_BUNDLE),
  ])
}

function bundle(entry: string, outfile: string) {
  return build({
    entryPoints: [path.join(SUPPORT, entry)],
    outfile,
    bundle: true,
    format: 'iife',
    platform: 'browser',
    jsx: 'automatic',
    define: { 'process.env.NODE_ENV': '"production"' },
    logLevel: 'warning',
  })
}
