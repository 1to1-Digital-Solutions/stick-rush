'use client'

import {
  DIFFICULTY_COLORS,
  DIFFICULTY_LABELS,
  DIFFICULTY_ORDER,
  LIFE_COLOR,
  MAX_STICKS,
  MIN_STICKS,
} from '../../lib/gameConfig'
import {
  type GameMode,
  GAME_MODE_HINTS,
  GAME_MODE_LABELS,
  GAME_MODE_ORDER,
  startingLives,
} from '../../lib/gameMode'
import { useGame } from '../../lib/gameStore'
import { LEVEL_COUNT, levelSpec } from '../../lib/levels'
import { HeartIcon, InfinityIcon, StarIcon } from './icons'
import { XRWrapper } from '../xr/XRWrapper'
import { useLang } from '../../lib/ajustesCliente'
import { formatoDeCifra, traductor } from '../../lib/textos'

const STICK_OPTIONS = Array.from(
  { length: MAX_STICKS - MIN_STICKS + 1 },
  (_, i) => MIN_STICKS + i,
)

/**
 * Récord del jugador en el modo elegido. Solo aparece cuando hay uno: un "0"
 * permanente no da nada que batir y ocupa el sitio del reclamo del menú.
 *
 * Dice de qué modo es porque hay uno por cada uno (ver `highScore.ts`): sin
 * nombrarlo, la cifra cambiaría sola al tocar el selector de modo y parecería
 * que el récord se ha perdido.
 */
function BestScore() {
  const lang = useLang()
  const t = traductor(lang)
  const { bestPoints, gameMode, endless } = useGame()
  if (bestPoints <= 0 || gameMode === 'levels') return null
  // Sin fin no mide puntos —crecen sin tope— sino la racha más larga.
  const sinFin = gameMode === 'practice' && endless

  return (
    <p className="mt-2 inline-flex items-center gap-2 self-center rounded-full border border-[var(--color-accent)]/30 bg-[var(--color-accent)]/10 px-4 py-1.5 text-sm text-white/70">
      {sinFin ? t('Best endless streak') : `${t('Best score in')} ${t(GAME_MODE_LABELS[gameMode])}`}{' '}
      <span className="font-bold tabular-nums text-[var(--color-accent)]">
        {sinFin ? `×${bestPoints}` : formatoDeCifra(bestPoints, lang)}
      </span>
    </p>
  )
}

/** Tres estrellas, llenas las ganadas. */
function Stars({ stars, className = 'size-4' }: { stars: number; className?: string }) {
  return (
    <span aria-hidden className="flex items-center gap-0.5 text-[var(--color-accent)]">
      {Array.from({ length: 3 }, (_, index) => (
        <StarIcon key={index} earned={index < stars} className={className} />
      ))}
    </span>
  )
}

/**
 * La escalera de niveles: una casilla por nivel con sus estrellas, bloqueadas
 * las que quedan por abrir. Debajo, lo que trae el elegido, porque en Niveles
 * los palos y la velocidad los dice el nivel y no el jugador.
 */
function LevelPicker() {
  const t = traductor(useLang())
  const { activeLevel, unlockedLevel, levelStars, setLevel } = useGame()
  const spec = levelSpec(activeLevel)

  return (
    <section className="flex w-full flex-col gap-3" aria-labelledby="level-label">
      <h2
        id="level-label"
        className="text-xs font-semibold uppercase tracking-[0.2em] text-white/50"
      >
         {t('Level')}
</h2>
      <div className="grid grid-cols-5 gap-2">
        {Array.from({ length: LEVEL_COUNT }, (_, index) => {
          const level = index + 1
          const locked = level > unlockedLevel
          const stars = levelStars[index] ?? 0
          const selected = level === activeLevel
          const estrellas = stars === 1 ? '1 star' : `${stars} stars`
          return (
            <button
              key={level}
              type="button"
              disabled={locked}
              aria-pressed={selected}
              aria-label={locked ? `Level ${level}, locked` : `Level ${level}, ${estrellas}`}
              onClick={() => setLevel(level)}
              className={`flex min-h-11 flex-col items-center justify-center gap-1 rounded-lg border px-1 py-2 text-base font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)] disabled:cursor-not-allowed disabled:opacity-40 ${
                selected
                  ? 'border-[var(--color-primary)] bg-[var(--color-primary)] text-white'
                  : 'border-white/10 bg-[var(--color-muted)] text-white/70 hover:border-white/30 hover:text-white'
              }`}
            >
              {level}
              {locked ? (
                <span aria-hidden className="text-[10px] uppercase tracking-wide text-white/40">
                  🔒
                </span>
              ) : (
                <Stars stars={stars} className="size-3" />
              )}
            </button>
          )
        })}
      </div>
      <p className="text-sm text-white/60">
        {t('Level')} {spec.level}: {spec.stickCount} {t('sticks on')}{' '}
        {t(DIFFICULTY_LABELS[spec.difficulty])}.
      </p>
    </section>
  )
}

/**
 * Tanda o sin fin, solo en práctica. Sin fin, la máquina se recarga cada vez
 * que se vacía y la partida la termina el jugador; lo que se guarda es la
 * racha más larga.
 */
function EndlessToggle() {
  const t = traductor(useLang())
  const { endless, setEndless } = useGame()
  const options = [
    { value: false, label: 'Set', hint: 'The sticks you picked, and that is it.' },
    { value: true, label: 'Endless', hint: 'It reloads until you say stop.' },
  ]

  return (
    <section className="flex w-full flex-col gap-3" aria-labelledby="endless-label">
      <h2
        id="endless-label"
        className="text-xs font-semibold uppercase tracking-[0.2em] text-white/50"
      >
         {t('Length')}
</h2>
      <div className="grid gap-2 sm:grid-cols-2">
        {options.map(({ value, label, hint }) => {
          const selected = value === endless
          return (
            <button
              key={label}
              type="button"
              aria-pressed={selected}
              onClick={() => setEndless(value)}
              className={`flex min-h-11 flex-col items-center gap-1 rounded-xl border px-4 py-3 text-center transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)] ${
                selected
                  ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/15'
                  : 'border-white/10 bg-[var(--color-muted)] hover:border-white/30'
              }`}
            >
              <span className={`text-base font-semibold ${selected ? 'text-white' : 'text-white/80'}`}>
                {label}
              </span>
              <span className="text-xs leading-snug text-white/50">{hint}</span>
            </button>
          )
        })}
      </div>
    </section>
  )
}
/**
 * Lo que cada modo pone en juego, dibujado: corazones en desafío, infinito en
 * práctica. Es lo que deja entender la elección sin leerse la línea de ayuda.
 */
function ModeStake({ mode }: { mode: GameMode }) {
  const lives = startingLives(mode)

  if (mode === 'levels') return <Stars stars={3} className="size-5" />

  return (
    <span
      style={{ color: LIFE_COLOR }}
      className="flex items-center gap-1"
    >
      {lives == null ? (
        <InfinityIcon className="size-6" />
      ) : (
        Array.from({ length: lives }, (_, index) => (
          <HeartIcon key={index} className="size-5" />
        ))
      )}
    </span>
  )
}

export function StartScreen() {
  const t = traductor(useLang())
  const {
    stickCount,
    difficulty,
    gameMode,
    setStickCount,
    setDifficulty,
    setGameMode,
    startGame,
  } = useGame()
  // En Niveles los palos y la velocidad los dice el nivel: sus selectores se
  // cambian por la escalera.
  const levels = gameMode === 'levels'
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
             {t('Catch the sticks before they hit the ground.')}
</p>
          <BestScore />
        </header>

        {/* Selector de modo. Va el primero porque decide a qué se juega: los
            palos y la dificultad gradúan la partida, el modo dice si hay algo
            en juego. */}
        <section className="flex w-full flex-col gap-3" aria-labelledby="mode-label">
          <h2
            id="mode-label"
            className="text-xs font-semibold uppercase tracking-[0.2em] text-white/50"
          >
             {t('Mode')}
</h2>
          <div className="grid gap-2 sm:grid-cols-3">
            {GAME_MODE_ORDER.map((mode) => {
              const selected = mode === gameMode
              return (
                <button
                  key={mode}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setGameMode(mode)}
                  className={`flex min-h-11 flex-col items-center gap-1.5 rounded-xl border px-4 py-3 text-center transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)] ${
                    selected
                      ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/15'
                      : 'border-white/10 bg-[var(--color-muted)] hover:border-white/30'
                  }`}
                >
                  <ModeStake mode={mode} />
                  <span
                    className={`text-base font-semibold ${
                      selected ? 'text-white' : 'text-white/80'
                    }`}
                  >
                    {t(GAME_MODE_LABELS[mode])}
                  </span>
                  <span className="text-xs leading-snug text-white/50">
                    {t(GAME_MODE_HINTS[mode])}
                  </span>
                </button>
              )
            })}
          </div>
        </section>

        {levels && <LevelPicker />}
        {gameMode === 'practice' && <EndlessToggle />}

        {/* Selector de número de palos */}
        {!levels && (
        <section className="flex w-full flex-col gap-3" aria-labelledby="sticks-label">
          <h2
            id="sticks-label"
            className="text-xs font-semibold uppercase tracking-[0.2em] text-white/50"
          >
             {t('Number of sticks')}
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
        )}

        {/* Selector de dificultad */}
        {!levels && (
        <section
          className="flex w-full flex-col gap-3"
          aria-labelledby="difficulty-label"
        >
          <h2
            id="difficulty-label"
            className="text-xs font-semibold uppercase tracking-[0.2em] text-white/50"
          >
             {t('Difficulty')}
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
                  {t(DIFFICULTY_LABELS[level])}
                </button>
              )
            })}
          </div>
        </section>
        )}

        {/* CTA principal, con el silencio a mano por si el juego molesta */}
        <div className="flex w-full max-w-xs flex-col items-center gap-3">
          <button
            type="button"
            // Sin el envoltorio, el evento del clic viajaría como opciones de
            // partida. En escritorio no hay tutorial que anteponer: el menú lo
            // explica con texto, que se lee antes de lo que dura la demostración.
            onClick={() => startGame()}
            className="cta-gradient w-full rounded-xl px-8 py-4 text-lg font-bold uppercase tracking-[0.15em] text-[#3b1d00] transition-[filter,box-shadow] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
          >
             {t('Play')}
</button>
        </div>

        {/* Entrada a realidad mixta (solo si el dispositivo lo soporta) */}
        <XRWrapper />
      </div>
    </main>
  )
}
