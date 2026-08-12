/**
 * Iconos del menú y del marcador de escritorio.
 *
 * Viven aparte porque los comparten el menú (elegir modo) y el HUD (vidas que
 * quedan): un corazón que se dibujara distinto en cada sitio haría dudar de si
 * hablan de lo mismo. Nada que ver con `xrIcons.ts`, que son siluetas 3D para el
 * visor, donde no hay SVG ni letras.
 */

/**
 * Corazón: una vida. Lleno mientras se conserva y de contorno cuando se ha
 * gastado, para que el estado se distinga por forma y no solo por color.
 */
export function HeartIcon({
  spent = false,
  className = 'size-5',
}: {
  spent?: boolean
  className?: string
}) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      className={`${className} shrink-0`}
      fill={spent ? 'none' : 'currentColor'}
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinejoin="round"
    >
      <path d="M12 20.5 4.2 12.9a4.6 4.6 0 0 1 6.5-6.5l1.3 1.3 1.3-1.3a4.6 4.6 0 0 1 6.5 6.5z" />
    </svg>
  )
}

/** Infinito: en práctica no hay nada que se agote. */
export function InfinityIcon({ className = 'size-5' }: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      className={`${className} shrink-0`}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
    >
      <path d="M8.2 8.5C5.6 8.5 4 10.1 4 12s1.6 3.5 4.2 3.5c3.3 0 4.3-7 7.6-7C18.4 8.5 20 10.1 20 12s-1.6 3.5-4.2 3.5c-3.3 0-4.3-7-7.6-7z" />
    </svg>
  )
}
