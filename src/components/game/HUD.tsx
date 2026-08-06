'use client'

import { DIFFICULTY_LABELS } from '@/lib/gameConfig'
import { useGame } from '@/lib/gameStore'
import { maxScore } from '@/lib/scoring'

export function HUD() {
  const {
    score,
    points,
    streak,
    bestStreak,
    stickCount,
    difficulty,
    gameState,
    countdown,
    resetGame,
  } = useGame()

  const best = maxScore(difficulty, stickCount)

  return (
    <>
      {/* Marcador permanente durante la partida */}
      <div className="pointer-events-none fixed right-4 top-4 z-10 flex flex-col items-end gap-1">
        {/* El número por sí solo no dice nada leído en voz alta, así que el
            marcador se anuncia entero cada vez que cambia. */}
        <div
          role="status"
          aria-live="polite"
          aria-label={`${points} puntos. Atrapados ${score} de ${stickCount}`}
          className="rounded-lg border border-white/10 bg-[var(--color-muted)]/80 px-4 py-2 backdrop-blur"
        >
          <p className="text-xs uppercase tracking-[0.2em] text-white/50">
            Puntos
          </p>
          <p className="text-2xl font-bold tabular-nums text-[var(--color-primary)]">
            {points.toLocaleString('es-ES')}
          </p>
          <p className="text-xs font-medium text-white/50">
            {score} / {stickCount} palos
          </p>
        </div>

        {/* La racha solo aparece cuando hay algo que presumir: a partir de dos
            palos seguidos. Con el "x1" permanente sería ruido. */}
        {streak >= 2 && (
          <span className="animate-fade-slide-up rounded-md border border-[var(--color-accent)]/40 bg-[var(--color-accent)]/15 px-2 py-1 text-[11px] font-bold uppercase tracking-wide text-[var(--color-accent)] backdrop-blur">
            Racha ×{streak}
          </span>
        )}

        <span className="rounded-md border border-white/10 bg-[var(--color-muted)]/80 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-white/60 backdrop-blur">
          {DIFFICULTY_LABELS[difficulty]}
        </span>
      </div>

      {/* Cuenta atrás antes del primer palo. No bloquea la escena: el jugador
          ve la máquina cargada mientras se prepara. */}
      {gameState === 'countdown' && (
        <div className="pointer-events-none fixed inset-0 z-20 flex items-center justify-center">
          <p
            // `timer` y no `status`: es exactamente lo que describe la ARIA
            // para una cuenta, y además deja el `status` libre para el
            // marcador, que convive con ella en pantalla.
            role="timer"
            aria-live="assertive"
            aria-label={`Empieza en ${countdown}`}
            // La clave fuerza el remontaje en cada número, y con él la
            // animación: sin ella el texto cambiaría sin dar el golpe.
            key={countdown}
            className="animate-countdown-pop text-glow-primary text-[10rem] font-bold leading-none tabular-nums text-[var(--color-primary)] motion-reduce:animate-none"
          >
            {countdown}
          </p>
        </div>
      )}

      {/* Pantalla de fin de partida */}
      {gameState === 'finished' && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/60 px-6 backdrop-blur-sm">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="game-over-title"
            className="animate-fade-slide-up flex w-full max-w-sm flex-col items-center gap-6 rounded-2xl border border-white/10 bg-[var(--color-muted)] p-8 text-center shadow-2xl"
          >
            <h2
              id="game-over-title"
              className="text-glow-primary text-3xl tracking-wide text-[var(--color-primary)]"
            >
              ¡Partida terminada!
            </h2>
            <div className="flex flex-col items-center gap-1">
              <p className="text-5xl font-bold tabular-nums text-[var(--color-accent)]">
                {points.toLocaleString('es-ES')}
              </p>
              <p className="text-xs uppercase tracking-[0.2em] text-white/40">
                de {best.toLocaleString('es-ES')} posibles
              </p>
            </div>

            <p className="text-lg text-white/80">
              Has atrapado{' '}
              <span className="font-bold text-[var(--color-accent)]">{score}</span> de{' '}
              <span className="font-bold">{stickCount}</span> palos.
            </p>

            <dl className="flex w-full justify-center gap-6 text-sm">
              <div className="flex flex-col items-center">
                <dt className="text-xs uppercase tracking-wide text-white/40">
                  Mejor racha
                </dt>
                <dd className="font-bold tabular-nums text-white/80">
                  ×{bestStreak}
                </dd>
              </div>
              <div className="flex flex-col items-center">
                <dt className="text-xs uppercase tracking-wide text-white/40">
                  Dificultad
                </dt>
                <dd className="font-bold text-white/80">
                  {DIFFICULTY_LABELS[difficulty]}
                </dd>
              </div>
            </dl>
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
