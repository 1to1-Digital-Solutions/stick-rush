/**
 * Icons of the menu and of the desktop scoreboard.
 *
 * They live apart because the menu (choosing a mode) and the HUD (lives
 * left) share them: a heart drawn differently in each place would make one
 * doubt whether they talk about the same thing. Nothing to do with `xrIcons.ts`,
 * which are 3D silhouettes for the headset, where there is no SVG or letters.
 */

/**
 * Heart: a life. Filled while it is kept and outlined once it has been
 * spent, so that the state is told apart by shape and not only by colour.
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

/** Infinity: in practice there is nothing that runs out. */
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
 * Level star: the earned one filled, the missing one outlined. It is what
 * tells the two apart by shape and not only by colour.
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

