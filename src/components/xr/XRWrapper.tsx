'use client'

import { useEffect, useState } from 'react'
import { getXrStore } from './xrStore'

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
 * Entrada al visor. Se renderiza en el DOM (no en la escena 3D) y dispara la
 * sesión a través del store de WebXR compartido. Si el dispositivo no soporta
 * ningún modo inmersivo, no se muestra nada.
 *
 * **Un solo botón, y prefiere AR.** Antes había uno por modo, pero eso ataba la
 * decisión a antes de ponerse el visor y no dejaba cambiar de opinión: WebXR no
 * permite pasar de `immersive-vr` a `immersive-ar` sin cerrar la sesión y abrir
 * otra. Entrando en `immersive-ar`, los dos modos son la misma sesión pintada
 * de dos formas y el jugador alterna desde el menú inmersivo al instante. En un
 * visor sin AR se entra en VR y allí la opción aparece deshabilitada.
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
    <div className="flex flex-col items-center justify-center gap-2">
      <button
        type="button"
        onClick={() =>
          support.ar ? getXrStore().enterAR() : getXrStore().enterVR()
        }
        className="inline-flex min-h-11 items-center justify-center rounded-lg border border-white/10 bg-[var(--color-muted)] px-5 py-2.5 text-sm font-semibold uppercase tracking-wide text-white transition-colors hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]"
      >
        Enter the headset
      </button>
      <p className="text-xs text-white/40">
        {support.ar
          ? 'Inside you choose between the scene and your room'
          : 'Your headset only supports virtual reality'}
      </p>
    </div>
  )
}
