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

/**
 * Compartir: un nodo que sale hacia otros dos. Es el símbolo que ya llevan los
 * botones de compartir del sistema, así que no necesita explicarse.
 */
export function ShareIcon({ className = 'size-5' }: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      className={`${className} shrink-0`}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="18" cy="5" r="2.6" />
      <circle cx="6" cy="12" r="2.6" />
      <circle cx="18" cy="19" r="2.6" />
      <path d="m8.3 10.8 7.4-4.3m0 11-7.4-4.3" />
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

/**
 * Estrella de nivel: llena la ganada, de contorno la que falta. Es lo que
 * distingue las dos por forma y no solo por color.
 */
export function StarIcon({
  earned = true,
  className = 'size-5',
}: {
  earned?: boolean
  className?: string
}) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      className={className}
      fill={earned ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinejoin="round"
    >
      <path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6L2.5 9.4l6.6-.8z" />
    </svg>
  )
}

