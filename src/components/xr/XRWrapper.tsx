'use client'

import { useEffect, useState } from 'react'
import { xrStore } from './xrStore'

type XRSupport = {
  vr: boolean
  ar: boolean
}

/** Comprueba qué modos inmersivos soporta el navegador/dispositivo. */
async function detectXRSupport(): Promise<XRSupport> {
  if (typeof navigator === 'undefined' || !navigator.xr) {
    return { vr: false, ar: false }
  }
  const [vr, ar] = await Promise.all([
    navigator.xr.isSessionSupported('immersive-vr').catch(() => false),
    navigator.xr.isSessionSupported('immersive-ar').catch(() => false),
  ])
  return { vr, ar }
}

/**
 * Botones de entrada a VR/AR. Se renderizan en el DOM (no en la escena 3D)
 * y disparan la sesión a través del store de WebXR compartido. Si el
 * dispositivo no soporta ningún modo inmersivo, no se muestra nada.
 */
export function XRWrapper() {
  const [support, setSupport] = useState<XRSupport>({ vr: false, ar: false })
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let active = true
    detectXRSupport().then((result) => {
      if (active) {
        setSupport(result)
        setReady(true)
      }
    })
    return () => {
      active = false
    }
  }, [])

  if (!ready || (!support.vr && !support.ar)) {
    return null
  }

  return (
    <div className="flex items-center justify-center gap-3">
      {support.vr && (
        <button
          type="button"
          onClick={() => xrStore.enterVR()}
          className="inline-flex min-h-11 items-center justify-center rounded-lg border border-white/10 bg-[var(--color-muted)] px-5 py-2.5 text-sm font-semibold uppercase tracking-wide text-white transition-colors hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]"
        >
          Entrar en VR
        </button>
      )}
      {support.ar && (
        <button
          type="button"
          onClick={() => xrStore.enterAR()}
          className="inline-flex min-h-11 items-center justify-center rounded-lg border border-white/10 bg-[var(--color-muted)] px-5 py-2.5 text-sm font-semibold uppercase tracking-wide text-white transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
        >
          Entrar en AR
        </button>
      )}
    </div>
  )
}
