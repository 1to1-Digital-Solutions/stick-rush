'use client'

import { useState } from 'react'
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
  startingLives,
} from '../../lib/gameMode'
import { PLAYER_COUNTS, PLAYER_COUNT_HINTS, PLAYER_COUNT_LABELS, playsAsDuel } from '../../lib/duel'
import { MENU_MODES, optionsButton, isShown } from '../../lib/gameMenu'
import { MENU_EN, plural } from '../../lib/menuWords'
import { gameName } from '../../lib/menuTemplate'
import { useGame } from '../../lib/gameStore'
import { LEVEL_COUNT, levelSpec } from '../../lib/levels'
import { HeartIcon, InfinityIcon, StarIcon } from './icons'
import { XRWrapper } from '../xr/XRWrapper'
import { useLang } from '../../lib/settingsClient'
import { formatText, formatFigure, translator, softTranslator } from '../../lib/textos'

const STICK_OPTIONS = Array.from(
  { length: MAX_STICKS - MIN_STICKS + 1 },
  (_, i) => MIN_STICKS + i,
)

/**
 * The player's record in the chosen mode. It only appears when there is one: a
 * permanent "0" gives nothing to beat and takes up the place of the menu's hook.
 *
 * It says which mode it is for because there is one per mode (see
 * `highScore.ts`): without naming it, the figure would change by itself on
 * touching the mode selector and it would look as if the record had been lost.
 */
function BestScore() {
  const lang = useLang()
  const t = translator(lang)
  const { bestPoints, gameMode, endless, players, duelTally } = useGame()
  // With two, nobody plays against anyone's record: what is shown is what the pair has so far.
  if (playsAsDuel(gameMode, players)) {
    const matches = duelTally.wins[0] + duelTally.wins[1] + duelTally.ties
    if (matches === 0) return null
    return (
      <p className="mt-2 inline-flex items-center gap-2 self-center rounded-full border border-[var(--color-accent)]/30 bg-[var(--color-accent)]/10 px-4 py-1.5 text-sm text-white/70">
        {formatText(t('Duels won: {one}–{two} · tied: {ties}'), {
          one: duelTally.wins[0],
          two: duelTally.wins[1],
          ties: duelTally.ties,
        })}
      </p>
    )
  }
  if (bestPoints <= 0 || gameMode === 'levels') return null
  // Endless does not measure points —they grow without limit— but the longest streak.
  const isEndless = gameMode === 'practice' && endless

  return (
    <p className="mt-2 inline-flex items-center gap-2 self-center rounded-full border border-[var(--color-accent)]/30 bg-[var(--color-accent)]/10 px-4 py-1.5 text-sm text-white/70">
      {isEndless ? t('Best endless streak') : `${t('Best score in')} ${t(GAME_MODE_LABELS[gameMode])}`}{' '}
      <span className="font-bold tabular-nums text-[var(--color-accent)]">
        {isEndless ? `×${bestPoints}` : formatFigure(bestPoints, lang)}
      </span>
    </p>
  )
}

/** Three stars, the earned ones filled. */
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
 * The ladder of levels: one box per level with its stars, the ones still to be
 * opened locked. Below, what the chosen one brings, because in Levels the
 * sticks and the speed are set by the level and not by the player.
 */
function LevelPicker() {
  const lang = useLang()
  const t = translator(lang)
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
          const starsLabel = softTranslator(lang)(plural(stars, '{stars} star', '{stars} stars'), { stars })
          return (
            <button
              key={level}
              type="button"
              disabled={locked}
              aria-pressed={selected}
              aria-label={locked ? `Level ${level}, locked` : `Level ${level}, ${starsLabel}`}
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
 * Round or endless, only in practice. In endless, the machine reloads every
 * time it empties and the player ends the run; what is saved is the longest
 * streak.
 */
function EndlessToggle() {
  const t = translator(useLang())
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
 * Against whom, only in the challenge mode: alone, or two passing the controller, with the same
 * sticks for each (`duel.ts`). The challenge mode is the same run for everyone, and that is why
 * it is the only one where two rounds can be compared.
 */
function PlayersPicker() {
  const t = translator(useLang())
  const { players, setPlayers } = useGame()

  return (
    <section className="flex w-full flex-col gap-3" aria-labelledby="players-label">
      <h2
        id="players-label"
        className="text-xs font-semibold uppercase tracking-[0.2em] text-white/50"
      >
        {t(MENU_EN.players)}
      </h2>
      <div className="grid gap-2 sm:grid-cols-2">
        {PLAYER_COUNTS.map((count) => {
          const selected = count === players
          return (
            <button
              key={count}
              type="button"
              aria-pressed={selected}
              onClick={() => setPlayers(count)}
              className={`flex min-h-11 flex-col items-center gap-1 rounded-xl border px-4 py-3 text-center transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)] ${
                selected
                  ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/15'
                  : 'border-white/10 bg-[var(--color-muted)] hover:border-white/30'
              }`}
            >
              <span className={`text-base font-semibold ${selected ? 'text-white' : 'text-white/80'}`}>
                {t(PLAYER_COUNT_LABELS[count])}
              </span>
              <span className="text-xs leading-snug text-white/50">{t(PLAYER_COUNT_HINTS[count])}</span>
            </button>
          )
        })}
      </div>
    </section>
  )
}

/**
 * What each mode puts at stake, drawn: hearts in the challenge mode, infinity in
 * practice. It is what lets the choice be understood without reading the hint line.
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
  const t = translator(useLang())
  const {
    stickCount,
    difficulty,
    gameMode,
    setStickCount,
    setDifficulty,
    setGameMode,
    startGame,
  } = useGame()
  // **Only practice asks** for sticks and speed, and behind «Más opciones» (`gameMenu.ts`). In
  // Levels the level sets them —its selectors are swapped for the ladder— and the challenge mode
  // is fixed (`CHALLENGE_SETUP`): the mode is chosen and Play is pressed. The rows are not shown,
  // not even greyed out. What is folded belongs to the UI: it is not saved, and the home page opens folded.
  const [moreOptions, setMoreOptions] = useState(false)
  const shows = (row: Parameters<typeof isShown>[0]) => isShown(row, gameMode, 'page', moreOptions)
  const optionsLabel = optionsButton(gameMode, 'page', moreOptions)
  return (
    <main className="absolute inset-0 z-20 flex w-full items-center justify-center overflow-y-auto bg-[var(--color-background)] px-6 py-12">
      {/* Subtle radial gradient in the background */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(21,128,61,0.18),transparent_60%)]"
      />

      <div className="animate-fade-slide-up relative z-10 flex w-full max-w-xl flex-col items-center gap-10 text-center">
        <header className="flex flex-col gap-2">
          {/* What the hall's cabinet is called (`menuTemplate.ts`), in label capitals. */}
          <h1 className="text-glow-primary text-5xl uppercase tracking-wide text-[var(--color-primary)] sm:text-6xl">
            {gameName()}
          </h1>
          <p className="text-sm text-white/60 sm:text-base">
             {t('Catch the sticks before they hit the ground.')}
</p>
          <BestScore />
        </header>

        {/* Mode selector. It goes first because it decides what is played: the
            sticks and the difficulty grade the run, the mode says whether there
            is something at stake. */}
        <section className="flex w-full flex-col gap-3" aria-labelledby="mode-label">
          <h2
            id="mode-label"
            className="text-xs font-semibold uppercase tracking-[0.2em] text-white/50"
          >
             {t('Mode')}
</h2>
          <div className="grid gap-2 sm:grid-cols-3">
            {MENU_MODES.map((mode) => {
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

        {shows('levels') && <LevelPicker />}
        {shows('players') && <PlayersPicker />}
        {shows('endless') && <EndlessToggle />}

        {/* Selector of the number of sticks */}
        {shows('sticks') && (
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

        {/* Difficulty selector */}
        {shows('speed') && (
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

        {/* «Más opciones»: what the template leaves folded, one tap away. */}
        {optionsLabel != null && (
          <button
            type="button"
            aria-expanded={moreOptions}
            onClick={() => setMoreOptions(!moreOptions)}
            className="min-h-11 rounded-lg border border-white/10 px-4 py-2 text-sm font-semibold text-white/70 transition-colors hover:border-white/30 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]"
          >
            {t(optionsLabel)}
          </button>
        )}

        {/* Main CTA, with the mute at hand in case the game bothers */}
        <div className="flex w-full max-w-xs flex-col items-center gap-3">
          <button
            type="button"
            // Without the wrapper, the click event would travel as run options.
            // On desktop there is no tutorial to put first: the menu explains it
            // with text, which is read sooner than the demonstration lasts.
            onClick={() => startGame()}
            className="cta-gradient w-full rounded-xl px-8 py-4 text-lg font-bold uppercase tracking-[0.15em] text-[#3b1d00] transition-[filter,box-shadow] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
          >
             {t('Play')}
</button>
        </div>

        {/* Entrance to mixed reality (only if the device supports it) */}
        <XRWrapper />
      </div>
    </main>
  )
}
