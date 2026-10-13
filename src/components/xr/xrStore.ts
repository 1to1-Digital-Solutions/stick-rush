'use client'

import { createXRStore } from '@react-three/xr'
import { assetUrl } from '../../lib/assets'
import { StickRushController } from './XRController'

/** The same grab volume for the bare hand, somewhat tighter. */
const HAND_GRAB_RADIUS = 0.06

/** Where the controller profiles live, served alongside the rest of the assets. */
const XR_PROFILES_PATH = 'webxr-profiles/'

/**
 * Absolute path to the profiles.
 *
 * @react-three/xr resolves paths with `new URL(path, baseAssetPath)`, which
 * demands an absolute base: a path like `/webxr-profiles/` throws. On the
 * server there is no `window`, but there is no XR session either, so that value never
 * gets used.
 */
function profilesBasePath(): string {
  const path = assetUrl(XR_PROFILES_PATH)
  if (typeof window === 'undefined') return new URL(path, 'http://localhost').href
  return new URL(path, window.location.origin).href
}

/**
 * WebXR store shared between the entry buttons (DOM) and the
 * <XR> component inside the Canvas. It is created only once, the first time
 * either of them asks for it, so that both sides point at the same session.
 *
 * It is created on request and not on importing the module because its `baseAssetPath`
 * depends on where the game's files are, and that is decided by whoever mounts it
 * (see `lib/assets.ts`): fixing it at import would leave it tied to the root before
 * anybody had been able to say otherwise.
 *
 * Two decisions, both of them the result of testing with the headset on:
 *
 * - **The controller profiles are served from the app itself** (`baseAssetPath`).
 *   By default they are downloaded from `cdn.jsdelivr.net`; the CSP blocks it, and when
 *   the promise fails @react-three/xr swallows the error in a
 *   `.catch(console.error)` and **never registers the controller**. Without controller state
 *   neither the ray nor the grab pointer is mounted: in the headset that meant
 *   being left without controllers and unable to press anything. The files are copied with
 *   `npm run sync:xr-profiles`.
 * - **The controller is drawn by the game**, not by the library: `StickRushController` mounts
 *   a controller of its own geometry (with the hint of the grab trigger) and its two
 *   pointers. The real model is a `.glb` from the same CDN, and self-hosting it
 *   would cost the 100 MB of the assets package for something seen in passing.
 *
 * - **The hands are NOT drawn by the store** (`hand.model: false`), neither the glove with
 *   controllers nor the articulated hand without them: the scene mounts them
 *   (`PlayerHands`). What hangs from here only exists on the game's own website, and
 *   the game is played mostly inside the xrcade hall, whose store does not
 *   draw hands. Turning them on here too would paint them twice.
 */
let store: ReturnType<typeof createXRStore> | null = null

export function getXrStore(): ReturnType<typeof createXRStore> {
  store ??= createXRStore({
    baseAssetPath: profilesBasePath(),
    controller: StickRushController,
    hand: {
      // The scene draws it (`PlayerHands`), which is what also shows up in the hall.
      model: false,
      grabPointer: { radius: HAND_GRAB_RADIUS, cursorModel: true },
      rayPointer: { rayModel: true, cursorModel: true },
      teleportPointer: false,
    },
  })
  return store
}

/**
 * Closes the immersive session, if there is one.
 *
 * It is needed when the game is unmounted. The store lives outside the React tree and
 * `<XR>` closes nothing on unmounting: an application that removes the game with
 * the headset on —the hub going back to its hall— would leave alive a session tied to
 * a Canvas that no longer exists, and the player would be left looking at a frozen
 * scene, unable to go back or start another (WebXR gives one session per
 * document). On its own website the same happens when navigating between `/` and `/game`.
 */
export function endXrSession(): void {
  const session = store?.getState().session
  if (session == null) return
  // The call failing is an expected outcome: the session may already be
  // closing because the player left on their own.
  void session.end().catch(() => {})
}
