'use client'

import { useEffect, useState } from 'react'
import { getXrStore } from './xrStore'
import { useLang } from '../../lib/settingsClient'
import { translator } from '../../lib/textos'

type XRSupport = {
  vr: boolean
  ar: boolean
}

/** Checks which immersive modes the browser/device supports. */
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
 * Entry to the headset. It is rendered in the DOM (not in the 3D scene) and starts the
 * session through the shared WebXR store. If the device supports
 * no immersive mode, nothing is shown.
 *
 * **A single button, and it prefers AR.** There used to be one per mode, but that tied the
 * decision to before putting the headset on and did not allow a change of mind: WebXR does not
 * let you go from `immersive-vr` to `immersive-ar` without closing the session and opening
 * another. Entering in `immersive-ar`, the two modes are the same session painted
 * in two ways and the player switches from the immersive menu instantly. On a
 * headset without AR one enters in VR and there the option appears disabled.
 */
export function XRWrapper() {
  const t = translator(useLang())
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
         {t('Enter the headset')}
</button>
      <p className="text-xs text-white/40">
        {support.ar
          ? t('Inside you choose between the scene and your room')
          : t('Your headset only supports virtual reality')}
      </p>
      {/* How to get out with the headset on: the hall's common exit (`ExitRing`). */}
      <p className="text-xs text-white/40">{t('Hold B or Y to exit')}</p>
    </div>
  )
}
