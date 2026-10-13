/**
 * The best score, kept between visits: the bests of `bests.ts` and what only the browser has,
 * the subscription to the `storage` event of the other tabs and what the server sees.
 *
 * Everything else —the keys, reading, writing, saving if it improves, the endless streak— is in
 * `bests.ts`, without a browser, and is re-exported from here as is: whoever imported from this
 * file keeps importing the same.
 */
import { subscribeToRecord } from './bests'

export * from './bests'

/**
 * What the server sees when prerendering: there is no browser, so there is no
 * record. Without this the server's HTML and the client's would differ and React
 * would warn of a hydration error.
 */
export function getServerBestPoints(): number {
  return 0
}

/**
 * Subscription for `useSyncExternalStore`.
 *
 * Besides its own notification the `storage` event is listened to, which is how
 * the browser tells that **another tab** has touched the storage. Without it,
 * beating the record in one tab would leave the others showing the previous one,
 * and the storage would stop being the only source of truth it claims to be.
 */
export function subscribeBestPoints(listener: () => void): () => void {
  const unsubscribe = subscribeToRecord(listener)
  window.addEventListener('storage', listener)
  return () => {
    unsubscribe()
    window.removeEventListener('storage', listener)
  }
}
