'use client'

import { DIFFICULTY_LABELS } from '@/lib/gameConfig'
import { useGame } from '@/lib/gameStore'

export function HUD() {
  const { score, stickCount, difficulty, gameState, resetGame } = useGame()

  return (
    <>
      {/* Marcador permanente durante la partida */}
      <div className="pointer-events-none fixed right-4 top-4 z-10 flex flex-col items-end gap-1">
        <div className="rounded-lg border border-white/10 bg-[var(--color-muted)]/80 px-4 py-2 backdrop-blur">
          <p className="text-xs uppercase tracking-[0.2em] text-white/50">
            Atrapados
          </p>
          <p className="text-2xl font-bold text-[var(--color-primary)]">
            {score}
            <span className="text-base font-medium text-white/50"> / {stickCount}</span>
          </p>
        </div>
        <span className="rounded-md border border-white/10 bg-[var(--color-muted)]/80 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-white/60 backdrop-blur">
          {DIFFICULTY_LABELS[difficulty]}
        </span>
      </div>

      {/* Pantalla de fin de partida */}
      {gameState === 'finished' && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/60 px-6 backdrop-blur-sm">
          <div className="animate-fade-slide-up flex w-full max-w-sm flex-col items-center gap-6 rounded-2xl border border-white/10 bg-[var(--color-muted)] p-8 text-center shadow-2xl">
            <h2 className="text-glow-primary text-3xl tracking-wide text-[var(--color-primary)]">
              ¡Partida terminada!
            </h2>
            <p className="text-lg text-white/80">
              Has atrapado{' '}
              <span className="font-bold text-[var(--color-accent)]">{score}</span> de{' '}
              <span className="font-bold">{stickCount}</span> palos.
            </p>
            <p className="text-sm text-white/50">
              Dificultad: {DIFFICULTY_LABELS[difficulty]}
            </p>
            <button
              type="button"
              onClick={resetGame}
              className="cta-gradient w-full rounded-xl px-6 py-3 text-base font-bold uppercase tracking-[0.15em] text-[#3b1d00] transition-[filter,box-shadow] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
            >
              Volver al menú
            </button>
          </div>
        </div>
      )}
    </>
  )
}
