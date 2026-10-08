'use client'

import { DIFFICULTY_LABELS, LIFE_COLOR } from '../../lib/gameConfig'
import { otraDelModo, startingLives } from '../../lib/gameMode'
import { useGame } from '../../lib/gameStore'
import { maxScore } from '../../lib/scoring'
import { FRASES, FRASES_CON_LAS_MANOS } from '../../lib/tutorial'
import { HeartIcon, StarIcon } from '../ui/icons'
import { useLang } from '../../lib/ajustesCliente'
import { formatoDeCifra, formatea, traductor } from '../../lib/textos'
import { PLAYER_LABELS, duelSummary } from '../../lib/duel'
/**
 * Vidas que quedan, una por corazón: llenos los que conservas, de contorno los
 * gastados. Solo en desafío; en práctica no hay nada que perder y una fila de
 * corazones intactos toda la partida sería decorado.
 *
 * Lo lee el lector de pantalla desde el `aria-label` del marcador, del que
 * forma parte: aquí sería un segundo anuncio compitiendo con el mismo cambio.
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
 * El final de una tanda de la partida a dos.
 *
 * Después de la primera, **el aviso de pasar el mando**: lo que ha sacado quien acaba de jugar y a
 * quién le toca, con el botón de empezar dicho para quien lo va a pulsar. Después de la segunda,
 * quién gana —o el empate—, los puntos de los dos y lo que lleva la pareja. El récord no sale: una
 * tanda a dos no es la marca de nadie (`lib/duel.ts`).
 */
function DuelOver() {
  const lang = useLang()
  const t = traductor(lang)
  const { duel, duelTally, startGame, resetGame } = useGame()
  // Solo se pinta en la partida a dos; el tipo no lo sabe.
  if (duel == null) return null
  const dicho = duelSummary(duel, duelTally, lang)

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
            dicho.winner != null ? 'text-[var(--color-accent)]' : 'text-[var(--color-primary)]'
          }`}
        >
          {dicho.title}
        </h2>
        {dicho.pass != null ? (
          <p className="text-lg font-semibold text-white">{dicho.pass}</p>
        ) : (
          <ul className="flex flex-col gap-1 text-base">
            {dicho.lines.map((line) => (
              <li
                key={line.player}
                className={
                  line.player === dicho.winner ? 'font-bold text-[var(--color-accent)]' : 'text-white/60'
                }
              >
                {line.text}
              </li>
            ))}
          </ul>
        )}
        {dicho.tally != null && <p className="text-sm text-white/50">{dicho.tally}</p>}
        <div className="flex w-full flex-col items-center gap-2">
          <button
            type="button"
            onClick={() => startGame()}
            className="cta-gradient w-full rounded-xl px-6 py-3 text-base font-bold uppercase tracking-[0.15em] text-[#3b1d00] transition-[filter,box-shadow] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
          >
            {dicho.next == null
              ? t('Play')
              : formatea(t('{player}, your turn'), { player: t(PLAYER_LABELS[dicho.next]) })}
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
  // El idioma se pide una vez y se pasa entero: las palabras se traducen y las cifras
  // se agrupan a la manera del idioma, y con una cosa por un lado y otra por otro el
  // marcador acababa en español con los miles escritos a la inglesa.
  const lang = useLang()
  const t = traductor(lang)
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
    cartel,
    faseDelCartel,
  } = useGame()
  const frasesDelTutorial = bareHanded ? FRASES_CON_LAS_MANOS : FRASES

  const sinFin = gameMode === 'practice' && endless
  const levels = gameMode === 'levels'
  // Renombrada frente a `bestPoints`, que es el récord del jugador: esto es el
  // techo de esta partida y confundirlos cambia lo que se lee en pantalla.
  const maxPossible = maxScore(difficulty, stickCount)
  const totalLives = startingLives(gameMode)
  // Las vidas se anuncian antes que los palos y solo cuando las hay: en
  // desafío es el dato que decide si sigues jugando.
  const livesLabel =
    lives != null && totalLives != null
      ? formatea(t('Lives {lives} of {total}. '), { lives, total: totalLives })
      : ''
  // El desafío se gana o se pierde, y el jugador tiene que saber cuál de las
  // dos le ha pasado antes de mirar ninguna cifra. La práctica no se pierde:
  // ahí el título se queda como estaba.
  const title = levels
    ? formatea(t(levelResult?.passed ? 'Level {level} cleared!' : 'Level {level} not cleared'), { level: activeLevel })
    : gameMode !== 'challenge'
      ? t('Game over!')
      : outcome === 'cleared'
        ? t('Challenge cleared!')
        : t('You are out of lives')
  // Sin fin, lo atrapado se cuenta de la partida entera y no «de N»: los palos
  // no se acaban. Y el nivel se anuncia antes que nada en Niveles.
  const caughtLabel = sinFin
    ? formatea(t('Caught {score}, endless, set {set}'), { score, set: wave + 1 })
    : formatea(t('Caught {score} of {total}'), { score, total: stickCount })
  const levelLabel = levels ? formatea(t('Level {level}. '), { level: activeLevel }) : ''
  return (
    <>
      {/* Marcador permanente durante la partida */}
      <div className="pointer-events-none fixed right-4 top-4 z-10 flex flex-col items-end gap-1">
        {/* El número por sí solo no dice nada leído en voz alta, así que el
            marcador se anuncia entero cada vez que cambia. */}
        <div
          role="status"
          aria-live="polite"
          aria-label={`${formatea(t('{points} points. '), { points })}${levelLabel}${livesLabel}${caughtLabel}`}
          className="rounded-lg border border-white/10 bg-[var(--color-muted)]/80 px-4 py-2 backdrop-blur"
        >
          <p className="text-xs uppercase tracking-[0.2em] text-white/50">
             {t('Points')}
</p>
          <p className="text-2xl font-bold tabular-nums text-[var(--color-primary)]">
            {formatoDeCifra(points, lang)}
          </p>
          <p className="text-xs font-medium text-white/50">
            {sinFin
              ? formatea(t('{score} sticks · set {set} / {total}'), { score, set: waveScore, total: stickCount })
              : formatea(t('{score} / {total} sticks'), { score, total: stickCount })}
          </p>
          {lives != null && totalLives != null && (
            <span className="mt-1.5 flex justify-end">
              <Lives lives={lives} total={totalLives} />
            </span>
          )}
        </div>

        {/* La racha solo aparece cuando hay algo que presumir: a partir de dos
            palos seguidos. Con el "x1" permanente sería ruido. */}
        {streak >= 2 && (
          <span className="animate-fade-slide-up rounded-md border border-[var(--color-accent)]/40 bg-[var(--color-accent)]/15 px-2 py-1 text-[11px] font-bold uppercase tracking-wide text-[var(--color-accent)] backdrop-blur">
            {formatea(t('Streak ×{streak}'), { streak })}
          </span>
        )}

        <span className="rounded-md border border-white/10 bg-[var(--color-muted)]/80 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-white/60 backdrop-blur">
          {levels ? formatea(t('Level {level} · '), { level: activeLevel }) : ''}{t(DIFFICULTY_LABELS[difficulty])}
        </span>

        {/* A dos, de quién es la tanda: con dos personas turnándose, el marcador tiene que
            decirlo, o el segundo no sabe si ya le toca. */}
        {player != null && (
          <span className="rounded-md border border-[var(--color-primary)]/50 bg-[var(--color-primary)]/15 px-2 py-1 text-[11px] font-bold uppercase tracking-wide text-white backdrop-blur">
            {t(PLAYER_LABELS[player])}
          </span>
        )}
      </div>

      {/* La misión, de frente, hasta que se resuelve el primer palo: lo que en el visor dice el
          cartel de encima del marcador (`CartelDeLaMaquina`), con las mismas frases. Después lo
          que se lleva y las vidas ya están en el marcador de la esquina. */}
      {cartel != null && faseDelCartel === 'antes' && (
        <div className="pointer-events-none fixed inset-x-0 top-4 z-10 flex justify-center px-24">
          <div className="animate-fade-slide-up rounded-lg border border-white/10 bg-[var(--color-muted)]/80 px-4 py-2 text-center backdrop-blur motion-reduce:animate-none">
            <p className="text-sm font-bold text-white">{cartel.titulo}</p>
            {cartel.detalle != null && <p className="text-xs text-white/60">{cartel.detalle}</p>}
          </div>
        </div>
      )}

      {/* Sin fin no se acaba sola: este botón es su única salida con resumen. */}
      {sinFin && gameState === 'playing' && (
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
        Tutorial en marcha (solo se llega aquí dentro del visor, ver
        `XRTutorial`). Lo que el jugador mira es el panel en 3D; esto es su
        reflejo en el DOM, que sigue montado bajo la sesión inmersiva: deja la
        lección **y sus dos salidas** en elementos de verdad —anunciables y
        alcanzables con teclado, como el resto del overlay— y no solo en objetos
        de la escena, que solo se pueden apuntar con el mando.

        La frase es la misma que pinta el panel, elegida por el mismo criterio:
        quien juega con las manos desnudas no tiene ningún botón que mantener.
      */}
      {tutorialStep !== null && gameState === 'playing' && (
        <div className="fixed inset-x-0 bottom-6 z-20 flex justify-center px-6">
          <div className="animate-fade-slide-up flex items-center gap-4 rounded-xl border border-white/10 bg-[var(--color-muted)]/90 px-5 py-3 backdrop-blur motion-reduce:animate-none">
            <p role="note" className="text-sm text-white/70">
              {t(frasesDelTutorial[tutorialStep])}
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
            aria-label={formatea(t('Starting in {seconds}'), { seconds: countdown })}
            // La clave fuerza el remontaje en cada número, y con él la
            // animación: sin ella el texto cambiaría sin dar el golpe.
            key={countdown}
            className="animate-countdown-pop text-glow-primary text-[10rem] font-bold leading-none tabular-nums text-[var(--color-primary)] motion-reduce:animate-none"
          >
            {countdown}
          </p>
        </div>
      )}

      {/* A dos, el final de cada tanda es el aviso de pasar el mando o quién ha ganado. */}
      {gameState === 'finished' && duel != null && <DuelOver />}

      {/* Pantalla de fin de partida */}
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
                aria-label={levelResult.stars === 1 ? t('1 star') : formatea(t('{stars} stars'), { stars: levelResult.stars })}
                className="flex items-center gap-1 text-[var(--color-accent)]"
              >
                {Array.from({ length: 3 }, (_, index) => (
                  <StarIcon key={index} earned={index < levelResult.stars} className="size-9" />
                ))}
              </div>
            )}
            <div className="flex flex-col items-center gap-1">
              <p className="text-5xl font-bold tabular-nums text-[var(--color-accent)]">
                {formatoDeCifra(points, lang)}
              </p>
              {!sinFin && (
                <p className="text-xs uppercase tracking-[0.2em] text-white/40">
                  {formatea(t('of {max} possible'), { max: formatoDeCifra(maxPossible, lang) })}
                </p>
              )}
              {/* El récord: batido, se anuncia; si no, se enseña la marca que
                  había que superar, que es lo que da sentido a la cifra de
                  arriba. Nunca los dos: dirían lo mismo. En Niveles no hay
                  récord: hay estrellas, y lo que se anuncia es lo que abren. */}
              {levelResult ? (
                levelResult.unlocked != null && (
                  <p className="animate-fade-slide-up mt-2 rounded-full border border-[var(--color-accent)] bg-[var(--color-accent)]/15 px-3 py-1 text-sm font-bold uppercase tracking-wide text-[var(--color-accent)] motion-reduce:animate-none">
                    {formatea(t('Level {level} unlocked'), { level: levelResult.unlocked })}
                  </p>
                )
              ) : isRecord ? (
                <p className="animate-fade-slide-up mt-2 rounded-full border border-[var(--color-accent)] bg-[var(--color-accent)]/15 px-3 py-1 text-sm font-bold uppercase tracking-wide text-[var(--color-accent)] motion-reduce:animate-none">
                  {t(sinFin ? 'Best streak!' : 'New record!')}
                </p>
              ) : (
                bestPoints > 0 && (
                  <p className="mt-2 text-sm text-white/50">
                    {t(sinFin ? 'Your best streak:' : 'Your record:')}{' '}
                    <span className="font-bold tabular-nums text-white/80">
                      {sinFin ? `×${bestPoints}` : formatoDeCifra(bestPoints, lang)}
                    </span>
                  </p>
                )
              )}
            </div>

            <p className="text-lg text-white/80">
              {sinFin ? (
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
              {/* Con cuántas vidas se acabó: junto a la puntuación, es lo que
                  resume un desafío y lo que se comparte de él. */}
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
              {/* Lo resaltado es repetir: la misma partida otra vez, sin pasar por el menú. */}
              <button
                type="button"
                onClick={() => startGame()}
                className="cta-gradient w-full rounded-xl px-6 py-3 text-base font-bold uppercase tracking-[0.15em] text-[#3b1d00] transition-[filter,box-shadow] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
              >
                {t(otraDelModo(gameMode))}
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
