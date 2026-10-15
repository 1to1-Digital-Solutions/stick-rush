'use client'

import { DIFFICULTY_LABELS, LIFE_COLOR } from '../../lib/gameConfig'
import { anotherOfMode, startingLives } from '../../lib/gameMode'
import { useGame } from '../../lib/gameStore'
import { maxScore } from '../../lib/scoring'
import { PHRASES, PHRASES_WITH_HANDS } from '../../lib/tutorial'
import { HeartIcon, StarIcon } from '../ui/icons'
import { useLang } from '../../lib/settingsClient'
import { formatFigure, formatText, translator, softTranslator } from '../../lib/textos'
import { plural } from '../../lib/menuWords'
import { PLAYER_LABELS, duelSummary } from '../../lib/duel'
/**
 * Lives left, one per heart: full the ones you keep, outlined the
 * spent ones. Only in challenge; in practice there is nothing to lose and a row of
 * untouched hearts for the whole run would be decoration.
 *
 * The screen reader reads it from the `aria-label` of the scoreboard, which it
 * is part of: here it would be a second announcement competing with the same change.
 */
function Lives({ lives, total }: { lives: number; total: number }) {
  return (
    <span
      aria-hidden
      style={{ color: LIFE_COLOR }}
      className="flex items-center gap-1"
    >
      {Array.from({ length: total }, (_, index) => (
        <HeartIcon key={index} spent={index >= lives} className="size-4" />
      ))}
    </span>
  )
}

/**
 * The end of a round of the two-player match.
 *
 * After the first one, **the notice to pass the controller**: what whoever has just played scored and
 * whose turn it is, with the start button worded for whoever is going to press it. After the second one,
 * who wins —or the tie—, the points of both and the pair's tally. The record does not show: a
 * two-player round is nobody's best (`lib/duel.ts`).
 */
function DuelOver() {
  const lang = useLang()
  const t = translator(lang)
  const { duel, duelTally, startGame, resetGame } = useGame()
  // It is only painted in the two-player match; the type does not know that.
  if (duel == null) return null
  const summary = duelSummary(duel, duelTally, lang)

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/60 px-6 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="duel-over-title"
        className="animate-fade-slide-up flex w-full max-w-sm flex-col items-center gap-6 rounded-2xl border border-white/10 bg-[var(--color-muted)] p-8 text-center shadow-2xl"
      >
        <h2
          id="duel-over-title"
          className={`text-glow-primary text-3xl tracking-wide ${
            summary.winner != null ? 'text-[var(--color-accent)]' : 'text-[var(--color-primary)]'
          }`}
        >
          {summary.title}
        </h2>
        {summary.pass != null ? (
          <p className="text-lg font-semibold text-white">{summary.pass}</p>
        ) : (
          <ul className="flex flex-col gap-1 text-base">
            {summary.lines.map((line) => (
              <li
                key={line.player}
                className={
                  line.player === summary.winner ? 'font-bold text-[var(--color-accent)]' : 'text-white/60'
                }
              >
                {line.text}
              </li>
            ))}
          </ul>
        )}
        {summary.tally != null && <p className="text-sm text-white/50">{summary.tally}</p>}
        <div className="flex w-full flex-col items-center gap-2">
          <button
            type="button"
            onClick={() => startGame()}
            className="cta-gradient w-full rounded-xl px-6 py-3 text-base font-bold uppercase tracking-[0.15em] text-[#3b1d00] transition-[filter,box-shadow] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
          >
            {summary.next == null
              ? t('Play')
              : formatText(t('{player}, your turn'), { player: t(PLAYER_LABELS[summary.next]) })}
          </button>
          <button
            type="button"
            onClick={resetGame}
            className="inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-white/10 px-6 py-2 text-sm font-semibold uppercase tracking-wide text-white/80 transition-colors hover:border-white/30 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]"
          >
            {t('Back to the menu')}
          </button>
        </div>
      </div>
    </div>
  )
}

export function HUD() {
  // The language is asked for once and passed whole: the words are translated and the figures
  // are grouped the way of the language, and with one thing on one side and another on the other the
  // scoreboard ended up in Spanish with the thousands written the English way.
  const lang = useLang()
  const t = translator(lang)
  const {
    score,
    points,
    streak,
    bestStreak,
    bestPoints,
    isRecord,
    activeStickCount: stickCount,
    activeDifficulty: difficulty,
    gameMode,
    endless,
    activeLevel,
    levelResult,
    wave,
    waveScore,
    lives,
    outcome,
    gameState,
    countdown,
    bareHanded,
    tutorialStep,
    finishTutorial,
    nextTutorialStep,
    resetGame,
    startGame,
    endRun,
    duel,
    player,
    sign,
    signPhase,
  } = useGame()
  const tutorialPhrases = bareHanded ? PHRASES_WITH_HANDS : PHRASES

  const isEndless = gameMode === 'practice' && endless
  const levels = gameMode === 'levels'
  // Renamed as opposed to `bestPoints`, which is the player's record: this is the
  // ceiling of this run and confusing them changes what is read on screen.
  const maxPossible = maxScore(difficulty, stickCount)
  const totalLives = startingLives(gameMode)
  // The lives are announced before the sticks and only when there are any: in
  // challenge it is the fact that decides whether you keep playing.
  const livesLabel =
    lives != null && totalLives != null
      ? formatText(t('Lives {lives} of {total}. '), { lives, total: totalLives })
      : ''
  // The challenge is won or lost, and the player has to know which of the
  // two happened to them before looking at any figure. Practice is not lost:
  // there the title stays as it was.
  const title = levels
    ? formatText(t(levelResult?.passed ? 'Level {level} cleared!' : 'Level {level} not cleared'), { level: activeLevel })
    : gameMode !== 'challenge'
      ? t('Game over!')
      : outcome === 'cleared'
        ? t('Challenge cleared!')
        : t('You are out of lives')
  // Endless, what was caught is counted over the whole run and not «of N»: the sticks
  // do not run out. And the level is announced before anything else in Levels.
  const caughtLabel = isEndless
    ? formatText(t('Caught {score}, endless, set {set}'), { score, set: wave + 1 })
    : formatText(t('Caught {score} of {total}'), { score, total: stickCount })
  const levelLabel = levels ? formatText(t('Level {level}. '), { level: activeLevel }) : ''
  return (
    <>
      {/* Permanent scoreboard during the run */}
      <div className="pointer-events-none fixed right-4 top-4 z-10 flex flex-col items-end gap-1">
        {/* The number by itself says nothing when read aloud, so the
            scoreboard is announced whole every time it changes. */}
        <div
          role="status"
          aria-live="polite"
          aria-label={`${formatText(t('{points} points. '), { points })}${levelLabel}${livesLabel}${caughtLabel}`}
          className="rounded-lg border border-white/10 bg-[var(--color-muted)]/80 px-4 py-2 backdrop-blur"
        >
          <p className="text-xs uppercase tracking-[0.2em] text-white/50">
             {t('Points')}
</p>
          <p className="text-2xl font-bold tabular-nums text-[var(--color-primary)]">
            {formatFigure(points, lang)}
          </p>
          <p className="text-xs font-medium text-white/50">
            {isEndless
              ? formatText(t('{score} sticks · set {set} / {total}'), { score, set: waveScore, total: stickCount })
              : formatText(t('{score} / {total} sticks'), { score, total: stickCount })}
          </p>
          {lives != null && totalLives != null && (
            <span className="mt-1.5 flex justify-end">
              <Lives lives={lives} total={totalLives} />
            </span>
          )}
        </div>

        {/* The streak only appears when there is something to show off: from two
            sticks in a row. With the permanent "x1" it would be noise. */}
        {streak >= 2 && (
          <span className="animate-fade-slide-up rounded-md border border-[var(--color-accent)]/40 bg-[var(--color-accent)]/15 px-2 py-1 text-[11px] font-bold uppercase tracking-wide text-[var(--color-accent)] backdrop-blur">
            {formatText(t('Streak ×{streak}'), { streak })}
          </span>
        )}

        <span className="rounded-md border border-white/10 bg-[var(--color-muted)]/80 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-white/60 backdrop-blur">
          {levels ? formatText(t('Level {level} · '), { level: activeLevel }) : ''}{t(DIFFICULTY_LABELS[difficulty])}
        </span>

        {/* With two players, whose round it is: with two people taking turns, the scoreboard has to
            say so, or the second one does not know whether it is their turn yet. */}
        {player != null && (
          <span className="rounded-md border border-[var(--color-primary)]/50 bg-[var(--color-primary)]/15 px-2 py-1 text-[11px] font-bold uppercase tracking-wide text-white backdrop-blur">
            {t(PLAYER_LABELS[player])}
          </span>
        )}
      </div>

      {/* The mission, head-on, until the first stick is resolved: what in the headset the
          sign above the scoreboard says (`MachineSign`), with the same phrases. Afterwards what
          has been scored and the lives are already in the scoreboard in the corner. */}
      {sign != null && signPhase === 'before' && (
        <div className="pointer-events-none fixed inset-x-0 top-4 z-10 flex justify-center px-24">
          <div className="animate-fade-slide-up rounded-lg border border-white/10 bg-[var(--color-muted)]/80 px-4 py-2 text-center backdrop-blur motion-reduce:animate-none">
            <p className="text-sm font-bold text-white">{sign.title}</p>
            {sign.detail != null && <p className="text-xs text-white/60">{sign.detail}</p>}
          </div>
        </div>
      )}

      {/* Endless does not end by itself: this button is its only exit with a summary. */}
      {isEndless && gameState === 'playing' && (
        <div className="fixed left-4 top-4 z-10">
          <button
            type="button"
            onClick={endRun}
            className="inline-flex min-h-11 items-center justify-center rounded-lg border border-white/10 bg-[var(--color-muted)]/80 px-4 py-2 text-sm font-semibold uppercase tracking-wide text-white/80 backdrop-blur transition-colors hover:border-[var(--color-accent)] hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
          >
             {t('End run')}
</button>
        </div>
      )}
      {/*
        Tutorial under way (you only get here inside the headset, see
        `XRTutorial`). What the player looks at is the 3D panel; this is its
        reflection in the DOM, which stays mounted under the immersive session: it leaves the
        lesson **and its two exits** in real elements —announceable and
        reachable by keyboard, like the rest of the overlay— and not only in objects
        of the scene, which can only be pointed at with the controller.

        The phrase is the same one the panel paints, chosen by the same criterion:
        whoever plays with bare hands has no button to hold.
      */}
      {tutorialStep !== null && gameState === 'playing' && (
        <div className="fixed inset-x-0 bottom-6 z-20 flex justify-center px-6">
          <div className="animate-fade-slide-up flex items-center gap-4 rounded-xl border border-white/10 bg-[var(--color-muted)]/90 px-5 py-3 backdrop-blur motion-reduce:animate-none">
            <p role="note" className="text-sm text-white/70">
              {t(tutorialPhrases[tutorialStep])}
            </p>
            <button
              type="button"
              onClick={nextTutorialStep}
              className="inline-flex min-h-11 items-center justify-center rounded-lg border border-white/10 px-4 py-2 text-sm font-semibold uppercase tracking-wide text-white transition-colors hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]"
            >
              {t('Next')}
            </button>
            <button
              type="button"
              onClick={finishTutorial}
              className="inline-flex min-h-11 items-center justify-center rounded-lg border border-white/10 px-4 py-2 text-sm font-semibold uppercase tracking-wide text-white transition-colors hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]"
            >
              {t('Skip tutorial')}
            </button>
          </div>
        </div>
      )}

      {/* Countdown before the first stick. It does not block the scene: the player
          sees the loaded machine while getting ready. */}
      {gameState === 'countdown' && (
        <div className="pointer-events-none fixed inset-0 z-20 flex items-center justify-center">
          <p
            // `timer` and not `status`: it is exactly what ARIA describes
            // for a count, and it also leaves `status` free for the
            // scoreboard, which shares the screen with it.
            role="timer"
            aria-live="assertive"
            aria-label={formatText(t('Starting in {seconds}'), { seconds: countdown })}
            // The key forces the remount on every number, and with it the
            // animation: without it the text would change without giving the kick.
            key={countdown}
            className="animate-countdown-pop text-glow-primary text-[10rem] font-bold leading-none tabular-nums text-[var(--color-primary)] motion-reduce:animate-none"
          >
            {countdown}
          </p>
        </div>
      )}

      {/* With two players, the end of each round is the notice to pass the controller or who has won. */}
      {gameState === 'finished' && duel != null && <DuelOver />}

      {/* End-of-run screen */}
      {gameState === 'finished' && duel == null && (
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
              {title}
            </h2>
            {levelResult && (
              <div
                role="img"
                aria-label={softTranslator(lang)(plural(levelResult.stars, '{stars} star', '{stars} stars'), { stars: levelResult.stars })}
                className="flex items-center gap-1 text-[var(--color-accent)]"
              >
                {Array.from({ length: 3 }, (_, index) => (
                  <StarIcon key={index} earned={index < levelResult.stars} className="size-9" />
                ))}
              </div>
            )}
            <div className="flex flex-col items-center gap-1">
              <p className="text-5xl font-bold tabular-nums text-[var(--color-accent)]">
                {formatFigure(points, lang)}
              </p>
              {!isEndless && (
                <p className="text-xs uppercase tracking-[0.2em] text-white/40">
                  {formatText(t('of {max} possible'), { max: formatFigure(maxPossible, lang) })}
                </p>
              )}
              {/* The record: beaten, it is announced; if not, the best that
                  had to be beaten is shown, which is what gives meaning to the figure
                  above. Never both: they would say the same. In Levels there is no
                  record: there are stars, and what is announced is what they open. */}
              {levelResult ? (
                levelResult.unlocked != null && (
                  <p className="animate-fade-slide-up mt-2 rounded-full border border-[var(--color-accent)] bg-[var(--color-accent)]/15 px-3 py-1 text-sm font-bold uppercase tracking-wide text-[var(--color-accent)] motion-reduce:animate-none">
                    {formatText(t('Level {level} unlocked'), { level: levelResult.unlocked })}
                  </p>
                )
              ) : isRecord ? (
                <p className="animate-fade-slide-up mt-2 rounded-full border border-[var(--color-accent)] bg-[var(--color-accent)]/15 px-3 py-1 text-sm font-bold uppercase tracking-wide text-[var(--color-accent)] motion-reduce:animate-none">
                  {t(isEndless ? 'Best streak!' : 'New record!')}
                </p>
              ) : (
                bestPoints > 0 && (
                  <p className="mt-2 text-sm text-white/50">
                    {t(isEndless ? 'Your best streak:' : 'Your record:')}{' '}
                    <span className="font-bold tabular-nums text-white/80">
                      {isEndless ? `×${bestPoints}` : formatFigure(bestPoints, lang)}
                    </span>
                  </p>
                )
              )}
            </div>

            <p className="text-lg text-white/80">
              {isEndless ? (
                <>
                  {t('You caught')}{' '}
                  <span className="font-bold text-[var(--color-accent)]">{score}</span>{' '}
                  {t('sticks, endless.')}
                </>
              ) : (
                <>
                  {t('You caught')}{' '}
                  <span className="font-bold text-[var(--color-accent)]">{score}</span>{' '}
                  {t('of')}{' '}
                  <span className="font-bold">{stickCount}</span>{' '}
                  {t('sticks.')}
                </>
              )}
            </p>
            <dl className="flex w-full flex-wrap justify-center gap-x-6 gap-y-3 text-sm">
              {/* With how many lives it ended: next to the score, it is what
                  sums up a challenge and what is shared of it. */}
              {lives != null && totalLives != null && (
                <div className="flex flex-col items-center gap-1">
                  <dt className="text-xs uppercase tracking-wide text-white/40">
                     {t('Lives')}
</dt>
                  <dd className="flex items-center gap-2 font-bold tabular-nums text-white/80">
                    <Lives lives={lives} total={totalLives} />
                    {lives} / {totalLives}
                  </dd>
                </div>
              )}
              <div className="flex flex-col items-center gap-1">
                <dt className="text-xs uppercase tracking-wide text-white/40">
                   {t('Best streak')}
</dt>
                <dd className="font-bold tabular-nums text-white/80">
                  ×{bestStreak}
                </dd>
              </div>
              <div className="flex flex-col items-center gap-1">
                <dt className="text-xs uppercase tracking-wide text-white/40">
                   {t('Difficulty')}
</dt>
                <dd className="font-bold text-white/80">
                  {t(DIFFICULTY_LABELS[difficulty])}
                </dd>
              </div>
            </dl>
            <div className="flex w-full flex-col items-center gap-2">
              {/* What is highlighted is repeating: the same run again, without going through the menu. */}
              <button
                type="button"
                onClick={() => startGame()}
                className="cta-gradient w-full rounded-xl px-6 py-3 text-base font-bold uppercase tracking-[0.15em] text-[#3b1d00] transition-[filter,box-shadow] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
              >
                {t(anotherOfMode(gameMode))}
              </button>
              <button
                type="button"
                onClick={resetGame}
                className="inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-white/10 px-6 py-2 text-sm font-semibold uppercase tracking-wide text-white/80 transition-colors hover:border-white/30 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]"
              >
                {t('Back to the menu')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
