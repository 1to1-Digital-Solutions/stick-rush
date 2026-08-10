'use client'

import {
  DIFFICULTY_COLORS,
  DIFFICULTY_LABELS,
  DIFFICULTY_ORDER,
  MAX_STICKS,
  MIN_STICKS,
} from '@/lib/gameConfig'
import { useGame } from '@/lib/gameStore'
import { XRWrapper } from '@/components/xr/XRWrapper'

const STICK_OPTIONS = Array.from(
  { length: MAX_STICKS - MIN_STICKS + 1 },
  (_, i) => MIN_STICKS + i,
)

/**
 * Altavoz, con ondas o tachado. Es lo que distingue el estado del botón por
 * forma y no solo por color.
 */
function SpeakerIcon({ muted }: { muted: boolean }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      className="size-5 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
    >
      <path d="M4 9h3.5L12 5v14l-4.5-4H4z" fill="currentColor" stroke="none" />
      {muted ? (
        <path d="m16 9.5 5 5m0-5-5 5" />
      ) : (
        <>
          <path d="M16 9.2a4 4 0 0 1 0 5.6" />
          <path d="M18.7 6.5a7.6 7.6 0 0 1 0 11" />
        </>
      )}
    </svg>
  )
}

/**
 * Silenciar el juego.
 *
 * Etiqueta fija y `aria-pressed`, como los demás botones del menú: lo que
 * cambia es el estado, no lo que hace el botón. Silenciado, `useGameSound` ni
 * siquiera crea el contexto de audio.
 */
function SoundToggle() {
  const { muted, setMuted } = useGame()

  return (
    <button
      type="button"
      aria-pressed={muted}
      onClick={() => setMuted(!muted)}
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)] ${
        muted
          ? 'border-[var(--color-primary)] bg-[var(--color-primary)] text-white'
          : 'border-white/10 bg-[var(--color-muted)] text-white/70 hover:border-white/30 hover:text-white'
      }`}
    >
      <SpeakerIcon muted={muted} />
      Silenciar
    </button>
  )
}

export function StartScreen() {
  const { stickCount, difficulty, setStickCount, setDifficulty, startGame } =
    useGame()

  return (
    <main className="absolute inset-0 z-20 flex w-full items-center justify-center overflow-y-auto bg-[var(--color-background)] px-6 py-12">
      {/* Gradiente radial sutil de fondo */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(21,128,61,0.18),transparent_60%)]"
      />

      <div className="animate-fade-slide-up relative z-10 flex w-full max-w-xl flex-col items-center gap-10 text-center">
        <header className="flex flex-col gap-2">
          <h1 className="text-glow-primary text-5xl tracking-wide text-[var(--color-primary)] sm:text-6xl">
            STICK RUSH
          </h1>
          <p className="text-sm text-white/60 sm:text-base">
            Atrapa los palos antes de que toquen el suelo.
          </p>
        </header>

        {/* Selector de número de palos */}
        <section className="flex w-full flex-col gap-3" aria-labelledby="sticks-label">
          <h2
            id="sticks-label"
            className="text-xs font-semibold uppercase tracking-[0.2em] text-white/50"
          >
            Número de palos
          </h2>
          <div className="flex flex-wrap justify-center gap-2">
            {STICK_OPTIONS.map((count) => {
              const selected = count === stickCount
              return (
                <button
                  key={count}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setStickCount(count)}
                  className={`h-11 w-11 rounded-lg border text-base font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)] ${
                    selected
                      ? 'border-[var(--color-primary)] bg-[var(--color-primary)] text-white'
                      : 'border-white/10 bg-[var(--color-muted)] text-white/70 hover:border-white/30 hover:text-white'
                  }`}
                >
                  {count}
                </button>
              )
            })}
          </div>
        </section>

        {/* Selector de dificultad */}
        <section
          className="flex w-full flex-col gap-3"
          aria-labelledby="difficulty-label"
        >
          <h2
            id="difficulty-label"
            className="text-xs font-semibold uppercase tracking-[0.2em] text-white/50"
          >
            Dificultad
          </h2>
          <div className="flex flex-wrap justify-center gap-2">
            {DIFFICULTY_ORDER.map((level) => {
              const selected = level === difficulty
              const color = DIFFICULTY_COLORS[level]
              return (
                <button
                  key={level}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setDifficulty(level)}
                  style={
                    selected
                      ? { backgroundColor: color, borderColor: color }
                      : { borderColor: `${color}66` }
                  }
                  className={`inline-flex min-h-11 items-center justify-center rounded-lg border px-4 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${
                    selected
                      ? 'text-white'
                      : 'bg-[var(--color-muted)] text-white/80 hover:text-white'
                  }`}
                >
                  {DIFFICULTY_LABELS[level]}
                </button>
              )
            })}
          </div>
        </section>

        {/* CTA principal, con el silencio a mano por si el juego molesta */}
        <div className="flex w-full max-w-xs flex-col items-center gap-3">
          <button
            type="button"
            onClick={startGame}
            className="cta-gradient w-full rounded-xl px-8 py-4 text-lg font-bold uppercase tracking-[0.15em] text-[#3b1d00] transition-[filter,box-shadow] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
          >
            Jugar
          </button>
          <SoundToggle />
        </div>

        {/* Entrada a realidad mixta (solo si el dispositivo lo soporta) */}
        <XRWrapper />
      </div>
    </main>
  )
}
