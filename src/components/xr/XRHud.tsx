'use client'

import { useXR } from '@react-three/xr'
import { LIFE_COLOR } from '../../lib/gameConfig'
import { anotherOfMode, startingLives, type GameMode } from '../../lib/gameMode'
import { useCallback } from 'react'

import { useGame } from '../../lib/gameStore'
import { useLang } from '../../lib/settingsClient'
import { translator, type TextKey } from '../../lib/textos'
import { CanvasPanel, drawParagraph, drawText } from './canvasPanel'
import { scoreRatio } from '../../lib/scoring'
import { type StickStatus, stickStatuses } from '../../lib/stickLayout'
import {
  XR_END_RUN_POSITION,
  XR_END_RUN_YAW,
  XR_HUD_POSITION,
  xrHudLayout,
  CONFIRM_BOXES,
  CONFIRM_TEXT,
  XR_CONFIRM_POSITION,
  XR_CONFIRM_SIZE,
  XR_QUIT_POSITION,
  XR_QUIT_YAW,
  DUEL_TEXT,
  XR_DUEL_POSITION,
  XR_DUEL_SIZE,
} from '../../lib/xrLayout'
import { duelSummary, type DuelSummary } from '../../lib/duel'
import {
  PANEL_COLOR,
  XRCheckIcon,
  XRHeartIcon,
  XRHomeIcon,
  XRPanel,
  XRPlayersIcon,
  XRPressable,
  XRRepeatIcon,
  XRStarsRow,
} from './XRUi'
/**
 * Scoreboard inside the scene, for immersive sessions.
 *
 * The normal HUD is DOM and in immersive it is not seen, so the player was left
 * with no scoreboard and no result. This one replaces it with geometry: one token per
 * stick, caught / missed / pending.
 *
 * **In the run that counts for a medal it keeps quiet about what the sign above already says**
 * (`MachineSign`): the points and the lives are read there, with the threshold still to go, and here
 * the tokens and the streak remain. Repeating them underneath was forcing a choice of where to look.
 *
 * It uses no text on purpose: drei's `<Text>` downloads the fonts from a CDN
 * (troika resolves the typeface against jsdelivr), and the game must be visible even if
 * the headset is on a local network with no way out. Each state is told by colour
 * *and* by size and height, so as not to depend on colour alone.
 *
 * It goes inside <XROrigin>, so its measurements are metres as seen by the
 * player. It sits in front of and below the hoop so as not to cross the
 * falling sticks.
 */

const TOKEN_SPACING = 0.07
const TOKEN_RADIUS = 0.026

const TOKEN_STYLE: Record<
  StickStatus,
  { color: string; emissive: number; scale: number; lift: number }
> = {
  // Caught: green, a big raised token.
  caught: { color: '#22c55e', emissive: 1.4, scale: 1.15, lift: 0.012 },
  // Missed: red, a small sunken token.
  missed: { color: '#dc2626', emissive: 0.25, scale: 0.7, lift: -0.012 },
  // Pending: dull grey, in-between size.
  pending: { color: '#475569', emissive: 0, scale: 0.9, lift: 0 },
}

/**
 * Score bar: it fills up as the player gets closer to the maximum possible
 * in that run.
 *
 * It is the way of giving points without writing a number. drei's `<Text>` would download
 * the font from a CDN that the CSP blocks, so the score is read as a
 * proportion —how much you have got out of what there was— which is also more useful at a
 * glance than an absolute figure with no scale.
 *
 * For the same reason, the record is a **mark** on the track and not a figure: on the
 * scale of this run, how far there is to go. If with the chosen difficulty and
 * number of sticks the record is not even reachable, the mark
 * stays at the end of the track, which is exactly what it means.
 */
function ScoreBar({
  ratio,
  recordRatio,
  isRecord,
  width,
}: {
  ratio: number
  recordRatio: number
  isRecord: boolean
  width: number
}) {
  const filled = Math.max(width * ratio, 0.001)

  return (
    <group position={[0, -0.055, 0]}>
      {/* Track */}
      <mesh>
        <boxGeometry args={[width, 0.012, 0.006]} />
        <meshBasicMaterial color="#1c2634" toneMapped={false} />
      </mesh>
      {/* Fill, anchored on the left so it grows to the right. */}
      <mesh position={[(filled - width) / 2, 0, 0.004]}>
        <boxGeometry args={[filled, 0.012, 0.006]} />
        <meshBasicMaterial
          color={isRecord ? '#fbbf24' : '#22c55e'}
          toneMapped={false}
        />
      </mesh>
      {/* Record mark. On beating it it also grows besides changing the colour of the
          bar: with the headset on colour alone is not enough. */}
      {recordRatio > 0 && (
        <mesh position={[width * (recordRatio - 0.5), 0, 0.008]}>
          <boxGeometry args={[0.005, isRecord ? 0.034 : 0.024, 0.006]} />
          <meshBasicMaterial color="#fbbf24" toneMapped={false} />
        </mesh>
      )}
    </group>
  )
}

/**
 * Live streak: one wedge per chained stick, up to five. Beyond that they
 * add no information and only widen the scoreboard.
 */
function StreakPips({ streak }: { streak: number }) {
  const shown = Math.min(streak, 5)
  if (shown < 2) return null

  return (
    <group position={[0, 0.06, 0]}>
      {Array.from({ length: shown }, (_, index) => (
        <mesh
          key={index}
          position={[(index - (shown - 1) / 2) * 0.026, 0, 0]}
          rotation={[0, 0, Math.PI / 4]}
        >
          <boxGeometry args={[0.012, 0.012, 0.006]} />
          <meshBasicMaterial color="#fbbf24" toneMapped={false} />
        </mesh>
      ))}
    </group>
  )
}

/** Spacing and size of the life hearts on the scoreboard. */
const LIFE_SPACING = 0.05
const LIFE_SIZE = 0.019
/** Where the row of lives goes inside the scoreboard. How much it lengthens it is said by `xrHudLayout`. */
const LIFE_ROW_Y = -0.105
/** The spent one dims to grey and shrinks; the live one is the usual red. */
const LIFE_SPENT_COLOR = '#3f4a5a'

/**
 * Lives left in a challenge: one heart per life, the spent one shrunk and
 * dimmed. With the headset on it is what says whether the next one that
 * gets away closes the run, and that is why it goes under the score bar, in
 * the scoreboard's fixed place and not among the sticks' tokens, which move
 * with how many are in play.
 */
function Lives({ lives, total, y }: { lives: number; total: number; y: number }) {
  const width = (total - 1) * LIFE_SPACING

  return (
    <group position={[0, y, 0]}>
      {Array.from({ length: total }, (_, index) => {
        const spent = index >= lives
        return (
          <XRHeartIcon
            key={index}
            position={[index * LIFE_SPACING - width / 2, 0, 0]}
            size={spent ? LIFE_SIZE * 0.62 : LIFE_SIZE}
            color={spent ? LIFE_SPENT_COLOR : LIFE_COLOR}
          />
        )
      })}
    </group>
  )
}

/** Plates of the end-of-run buttons: the repeat one and the back-to-menu one. */
const PLAY_BUTTON = { color: '#15803d', emissive: '#22c55e', intensity: 0.4 }
const NEUTRAL_BUTTON = { color: '#334155', emissive: '#94a3b8', intensity: 0.2 }

/** Spacing between the end-of-run buttons, with air between their areas. */
const BUTTON_SPACING = 0.36
const BUTTON_HIT: [number, number, number] = [0.15, 0.11, 0.06]

/**
 * The labels under the end-of-run buttons.
 *
 * With the headset on an icon is only guessed at: under each plate, what it does, with the hall's
 * common words («Otro reto» or «Otra partida», and the menu). They go **under the plate**, on a single
 * canvas for both (one draw call), and they are measured in the two languages
 * (`finalLabels.legible.test.ts`). `y` is their centre relative to the row of buttons.
 *
 * With no button in the middle, each label has almost twice the gap between buttons (`maxWidth`): «Another
 * challenge» did not fit in a single one without lowering the letter size. The canvas, and with it the end panel,
 * widens to leave them that room.
 */
export const FINAL_LABELS = { width: 4 * BUTTON_SPACING, height: 0.06, y: -0.08, size: 0.047, maxWidth: 2 * BUTTON_SPACING - 0.04 } as const

/** What each button says, from left to right: repeat and back to the menu. */
export function finalTexts(gameMode: GameMode): readonly TextKey[] {
  return [anotherOfMode(gameMode), 'Menu']
}

/** Paints the labels, each one under its button. Outside the component to measure it with the recording canvas. */
export function drawFinalLabels(ctx: CanvasRenderingContext2D, t: (key: TextKey) => string, gameMode: GameMode): void {
  finalTexts(gameMode).forEach((text, i) => {
    drawText(ctx, t(text), (i === 0 ? -1 : 1) * BUTTON_SPACING, 0, {
      size: FINAL_LABELS.size,
      color: '#e2e8f0',
      weight: '700',
      maxWidth: FINAL_LABELS.maxWidth,
    })
  })
}

/** The labels' canvas, under the row of buttons. */
function FinalLabels({ gameMode }: { gameMode: GameMode }) {
  const t = translator(useLang())
  const draw = useCallback((ctx: CanvasRenderingContext2D) => drawFinalLabels(ctx, t, gameMode), [t, gameMode])
  return (
    <group position={[0, FINAL_LABELS.y, 0.004]}>
      <CanvasPanel width={FINAL_LABELS.width} height={FINAL_LABELS.height} draw={draw} fallbackColor="#000000" />
    </group>
  )
}

/** Plate of an end-of-run button. */
function ButtonPlate({
  style,
}: {
  style: { color: string; emissive: string; intensity: number }
}) {
  return (
    <mesh position={[0, 0, -0.008]}>
      <boxGeometry args={[0.13, 0.09, 0.012]} />
      <meshStandardMaterial
        color={style.color}
        emissive={style.emissive}
        emissiveIntensity={style.intensity}
        roughness={0.5}
      />
    </mesh>
  )
}

function Token({ state, x }: { state: StickStatus; x: number }) {
  const style = TOKEN_STYLE[state]

  return (
    <mesh
      position={[x, style.lift, 0]}
      rotation={[Math.PI / 2, 0, 0]}
      scale={style.scale}
    >
      <cylinderGeometry args={[TOKEN_RADIUS, TOKEN_RADIUS, 0.014, 16]} />
      <meshStandardMaterial
        color={style.color}
        emissive={style.color}
        emissiveIntensity={style.emissive}
        metalness={0.2}
        roughness={0.5}
      />
    </mesh>
  )
}

export function XRHud({ hasDomUi = false }: { hasDomUi?: boolean }) {
  const mode = useXR((state) => state.mode)
  const {
    score,
    resolved,
    points,
    streak,
    bestPoints,
    isRecord,
    activeDifficulty: difficulty,
    activeStickCount: stickCount,
    gameMode,
    endless,
    levelResult,
    waveScore,
    waveResolved,
    lives,
    gameState,
    startGame,
    resetGame,
    player,
    signPhase,
  } = useGame()
  const endlessPractice = gameMode === 'practice' && endless
  // Outside the immersive session the DOM HUD rules, and in the menu XRMenu rules.
  // It appears with the countdown, which is when it starts measuring something. There is no longer a
  // tutorial phase to dodge: the lesson runs with the run under way and
  // its panel plants itself above this one (see `XR_TUTORIAL_POSITION`).
  if ((hasDomUi && mode == null) || gameState === 'menu') {
    return null
  }

  const width = Math.max(stickCount - 1, 0) * TOKEN_SPACING
  // Endless, the tokens are those of the hanging round: those of the whole
  // run would not fit, and the bar below already counts what has accumulated.
  const tokens = stickStatuses(
    endlessPractice ? waveScore : score,
    endlessPractice ? waveResolved : resolved,
    stickCount,
  ).map(
    (state, index) => ({
      index,
      state,
      x: index * TOKEN_SPACING - width / 2,
    }),
  )
  const finished = gameState === 'finished'
  // Endless, the points have no ceiling: the bar measures the live streak against the
  // best streak, which is what is saved for that mode.
  const ratio = endlessPractice
    ? Math.min(1, streak / Math.max(bestPoints, streak, 1))
    : scoreRatio(points, difficulty, stickCount)
  const recordRatio = endlessPractice
    ? bestPoints > 0
      ? Math.min(1, bestPoints / Math.max(bestPoints, streak, 1))
      : 0
    : scoreRatio(bestPoints, difficulty, stickCount)
  // In challenge the scoreboard grows to make room for them: the lives are seen during
  // the run and are still there at the end, which are the ones it ended with. In Levels
  // that place is taken by the stars on finishing.
  const totalLives = startingLives(gameMode)
  // With the goal sign above, the points and the lives are read there.
  const onSign = signPhase != null
  const showLives = lives != null && totalLives != null && !onSign
  const showStars = finished && levelResult != null
  const layout = xrHudLayout({ finished, row: showLives || showStars, sign: onSign })
  return (
    <group position={XR_HUD_POSITION}>
      {/* Background panel: in AR the real world is behind, without it the tokens
          lose contrast against any wall. */}
      <group position={[0, layout.centre, 0]}>
        <XRPanel
          // At the end, the width cannot depend on how many sticks were played:
          // with the few of a short run, the row of buttons would
          // run off the panel and lose the background that lifts it off the passthrough.
          width={Math.max(width + 0.2, finished ? FINAL_LABELS.width + 0.06 : 0)}
          height={layout.height}
          color={PANEL_COLOR}
          opacity={0.72}
        />
      </group>

      <group position={[0, layout.content, 0]}>
        {tokens.map((token) => (
          <Token key={token.index} state={token.state} x={token.x} />
        ))}
        <StreakPips streak={streak} />
        {!onSign && (
          <ScoreBar
            ratio={ratio}
            recordRatio={recordRatio}
            isRecord={isRecord}
            width={Math.max(width, 0.28)}
          />
        )}
        {showLives && <Lives lives={lives} total={totalLives} y={LIFE_ROW_Y} />}
        {/* For two, whose round it is: the pair of chips with the one of whoever has the controller
            lit and grown (the one on this side, player 1; the one opposite, player 2), to the
            left of the lives. At the end the notice to pass the controller says it, above. */}
        {player != null && !finished && (
          <XRPlayersIcon
            position={[-0.17, LIFE_ROW_Y, 0.004]}
            size={0.011}
            table="#94a3b8"
            near={player === 0 ? { color: '#22c55e', scale: 1.3 } : { color: '#475569' }}
            far={player === 1 ? { color: '#22c55e', scale: 1.3 } : { color: '#475569' }}
          />
        )}
        {showStars && (
          <XRStarsRow stars={levelResult.stars} position={[0, LIFE_ROW_Y, 0]} size={0.02} />
        )}
      </group>
      {/*
        At the end, the run no longer chains by itself: the player decides. Before, it
        restarted after a pause and there was no way to choose sticks or
        difficulty again without taking the headset off.
      */}
      {finished && (
        <group position={[0, -0.12, 0]}>
          <XRPressable
            position={[-BUTTON_SPACING, 0, 0]}
            onSelect={startGame}
            hitSize={BUTTON_HIT}
          >
            <ButtonPlate style={PLAY_BUTTON} />
            <XRRepeatIcon position={[0, 0, 0.008]} size={0.026} />
          </XRPressable>

          <XRPressable
            position={[BUTTON_SPACING, 0, 0]}
            onSelect={resetGame}
            hitSize={BUTTON_HIT}
          >
            <ButtonPlate style={NEUTRAL_BUTTON} />
            <XRHomeIcon position={[0, 0, 0.008]} />
          </XRPressable>
          <FinalLabels gameMode={gameMode} />
        </group>
      )}
    </group>
  )
}

/**
 * Button to go back to the menu during the run, set aside to one side so as not to
 * cross the sticks. Without it, entering a run in the headset was a
 * dead end: there was no way to change options.
 */
export function XRQuitButton({ hasDomUi = false }: { hasDomUi?: boolean }) {
  const mode = useXR((state) => state.mode)
  const { gameState, gameMode, endless, askToQuit, endRun } = useGame()

  // During the countdown too: if it occurs to the player that they got
  // the options wrong, those three seconds are their last chance.
  if ((hasDomUi && mode == null) || (gameState !== 'playing' && gameState !== 'countdown')) {
    return null
  }

  return (
    <>
      {/* Endless does not end by itself: finishing is its only way out with a summary. It goes
          at the tip opposite to the back-to-menu one so as not to confuse them. */}
      {gameMode === 'practice' && endless && gameState === 'playing' && (
        <XRPressable
          position={XR_END_RUN_POSITION}
          rotation={[0, XR_END_RUN_YAW, 0]}
          onSelect={endRun}
          hitSize={[0.16, 0.14, 0.08]}
        >
          <mesh>
            <boxGeometry args={[0.12, 0.1, 0.012]} />
            <meshStandardMaterial
              color="#15803d"
              emissive="#22c55e"
              emissiveIntensity={0.3}
              roughness={0.5}
            />
          </mesh>
          <XRCheckIcon position={[0, 0, 0.012]} />
        </XRPressable>
      )}
      {/* It asks before leaving it: the button gets pressed by accident and quitting loses what was done. */}
      <QuitButton onSelect={askToQuit} />
    </>
  )
}

function QuitButton({ onSelect }: { onSelect: () => void }) {
  return (
    // The turn hangs from the button, not from the plate: turning only the plate, its left
    // edge came forward in front of the icon and ate the drawing from
    // that side. It is what made the previous icon illegible, whose arrowhead
    // fell right on the part that was buried.
    <XRPressable
      position={XR_QUIT_POSITION}
      rotation={[0, XR_QUIT_YAW, 0]}
      onSelect={onSelect}
      hitSize={[0.16, 0.14, 0.08]}
    >
      <mesh>
        <boxGeometry args={[0.12, 0.1, 0.012]} />
        <meshStandardMaterial
          color="#334155"
          emissive="#94a3b8"
          emissiveIntensity={0.22}
          roughness={0.5}
        />
      </mesh>
      <XRHomeIcon position={[0, 0, 0.012]} />
    </XRPressable>
  )
}

/**
 * The notice before leaving the run.
 *
 * **There is no leaving all at once.** The button gets pressed by accident —with the headset on what
 * is at the sides is not seen and the hand goes for the sticks— and quitting loses what has been done.
 * So the run is stopped and the question asked; while it is asked no stick falls, because
 * otherwise deciding would cost points.
 */
/**
 * What is written on the notice to leave the run.
 *
 * Apart from the component to be able to **measure it**: a headset panel is painted on a canvas that
 * nobody looks at at the size it is read at, so a text that runs off or two that overlap are only
 * discovered with the headset on. `exit.legible.test.ts` measures it, in the two languages
 * —Spanish is longer and is where it runs off—.
 */
export function drawNotice(ctx: CanvasRenderingContext2D, t: (key: TextKey) => string): void {
  drawParagraph(ctx, t('Leave the game?'), 0, 0.1, {
    size: CONFIRM_TEXT.title,
    color: '#e2e8f0',
    weight: '700',
    maxWidth: XR_CONFIRM_SIZE[0] - 0.08,
  })
  drawParagraph(ctx, t('You lose what you have got so far.'), 0, 0.02, {
    size: CONFIRM_TEXT.body,
    color: '#94a3b8',
    maxWidth: XR_CONFIRM_SIZE[0] - 0.08,
  })
  drawText(ctx, t('Leave'), CONFIRM_BOXES.leave.position[0], CONFIRM_BOXES.leave.position[1], {
    size: CONFIRM_TEXT.button,
    color: '#e2e8f0',
    maxWidth: CONFIRM_BOXES.leave.size[0] - 0.03,
  })
  drawText(
    ctx,
    t('Keep playing'),
    CONFIRM_BOXES.stay.position[0],
    CONFIRM_BOXES.stay.position[1],
    {
      size: CONFIRM_TEXT.button,
      color: '#3b1d00',
      weight: '700',
      maxWidth: CONFIRM_BOXES.stay.size[0] - 0.03,
    },
  )
}

export function XRQuitConfirm() {
  const { prompt, resetGame, keepPlaying } = useGame()
  const t = translator(useLang())

  const write = useCallback((ctx: CanvasRenderingContext2D) => drawNotice(ctx, t), [t])

  if (prompt !== 'quit') return null

  return (
    <group position={XR_CONFIRM_POSITION}>
      <XRPanel width={XR_CONFIRM_SIZE[0]} height={XR_CONFIRM_SIZE[1]} color={PANEL_COLOR} />

      <XRPressable
        position={CONFIRM_BOXES.leave.position}
        onSelect={resetGame}
        hitSize={CONFIRM_BOXES.leave.size}
      >
        <mesh>
          <planeGeometry args={[CONFIRM_BOXES.leave.size[0], CONFIRM_BOXES.leave.size[1]]} />
          <meshBasicMaterial color="#1c2634" toneMapped={false} />
        </mesh>
      </XRPressable>

      <XRPressable
        position={CONFIRM_BOXES.stay.position}
        onSelect={keepPlaying}
        hitSize={CONFIRM_BOXES.stay.size}
      >
        <mesh>
          <planeGeometry args={[CONFIRM_BOXES.stay.size[0], CONFIRM_BOXES.stay.size[1]]} />
          <meshBasicMaterial color={LIFE_COLOR} toneMapped={false} />
        </mesh>
      </XRPressable>

      {/* The text goes on top of the plates: the canvas is transparent except where it writes. */}
      <group position={[0, 0, 0.03]}>
        <CanvasPanel
          width={XR_CONFIRM_SIZE[0]}
          height={XR_CONFIRM_SIZE[1]}
          draw={write}
          fallbackColor={PANEL_COLOR}
        />
      </group>
    </group>
  )
}

/**
 * What is written when a round of the two-player match ends: whose it was and who they pass the
 * controller to or, with both played, who wins, the points of both and what the pair has so far.
 *
 * Apart from the component to be able to **measure it** in the two languages (`duel.legible.test.ts`):
 * Spanish is longer and is where the text runs off. The phrases come already said (`duelSummary`).
 */
export function drawDuel(ctx: CanvasRenderingContext2D, summary: DuelSummary): void {
  const width = XR_DUEL_SIZE[0] - 0.04
  drawText(ctx, summary.title, 0, 0.08, {
    size: DUEL_TEXT.title,
    color: summary.winner != null ? '#fbbf24' : '#ffffff',
    weight: '700',
    maxWidth: width,
  })
  if (summary.pass != null) {
    drawText(ctx, summary.pass, 0, 0.015, { size: DUEL_TEXT.body, color: '#4ade80', weight: '700', maxWidth: width })
    return
  }
  // One line per player: together on one they do not fit at the panel's letter size.
  summary.lines.forEach((line, i) => {
    drawText(ctx, line.text, 0, 0.025 - i * 0.045, {
      size: DUEL_TEXT.body,
      color: line.player === summary.winner ? '#fbbf24' : '#e2e8f0',
      maxWidth: width,
    })
  })
  if (summary.tally != null) {
    drawText(ctx, summary.tally, 0, -0.08, { size: DUEL_TEXT.body, color: '#94a3b8', maxWidth: width })
  }
}

/**
 * The end of a two-player round, inside the headset: **the notice to pass the controller** or who has won.
 *
 * With letters and not with tokens like the scoreboard: «pass the controller to player 2» cannot be said with
 * a silhouette. It goes in front, in the place of the quit notice (`XR_DUEL_POSITION`), and the scoreboard's
 * buttons are still underneath: the play one starts the other player's round, or a new match.
 */
export function XRDuelPanel({ hasDomUi = false }: { hasDomUi?: boolean }) {
  const mode = useXR((state) => state.mode)
  const { gameState, duel, duelTally } = useGame()
  const lang = useLang()

  const write = useCallback(
    (ctx: CanvasRenderingContext2D) => {
      if (duel != null) drawDuel(ctx, duelSummary(duel, duelTally, lang))
    },
    [duel, duelTally, lang],
  )

  if ((hasDomUi && mode == null) || gameState !== 'finished' || duel == null) return null

  return (
    <group position={XR_DUEL_POSITION}>
      <XRPanel width={XR_DUEL_SIZE[0]} height={XR_DUEL_SIZE[1]} color={PANEL_COLOR} />
      <group position={[0, 0, 0.01]}>
        <CanvasPanel width={XR_DUEL_SIZE[0]} height={XR_DUEL_SIZE[1]} draw={write} fallbackColor={PANEL_COLOR} />
      </group>
    </group>
  )
}
