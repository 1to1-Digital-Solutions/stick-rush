'use client'

import { useCallback, useState } from 'react'
import { useXR } from '@react-three/xr'
import {
  DIFFICULTY_COLORS,
  DIFFICULTY_ORDER,
  LIFE_COLOR,
  MAX_STICKS,
  MIN_STICKS,
  STICK_COLOR,
} from '../../lib/gameConfig'
import { CHALLENGE_LIVES, GAME_MODE_HINTS, type GameMode } from '../../lib/gameMode'
import { optionsButton, isShown, nextMode } from '../../lib/gameMenu'
import { useGame } from '../../lib/gameStore'
import { PLAYER_COUNT_HINTS, playsAsDuel, type PlayerCount } from '../../lib/duel'
import { useLang } from '../../lib/settingsClient'
import { translator, type TextKey } from '../../lib/textos'
import { CanvasPanel, drawParagraph, drawText } from './canvasPanel'
import { LEVEL_COUNT } from '../../lib/levels'
import { useExit } from '../../game/exit'
import { gameName } from '../../lib/menuTemplate'
import { HOOP_ADJUST_RANGE } from '../../lib/hoopHeight'
import {
  menuLabelsFor,
  menuLabelText,
  ROW_LABEL_RISE,
  MENU_TEXT,
  MENU_TITLE,
  XR_DIFFICULTY_SPACING,
  XR_ENDLESS_TOGGLE_OFFSET,
  XR_MENU_HIT,
  XR_PLAYERS_TOGGLE_OFFSET,
  XR_HOOP_DOWN_OFFSET,
  XR_HOOP_GAUGE_OFFSET,
  XR_HOOP_UP_OFFSET,
  XR_LEVEL_PICKER_SPACING,
  XR_MENU_EXIT_OFFSET,
  XR_MENU_OPTIONS_OFFSET,
  OPTIONS_WIDTH,
  menuPoseFor,
  XR_MENU_TUTORIAL_OFFSET,
  XR_MODE_TOGGLE_OFFSET,
  XR_SCENERY_PICKER_OFFSET,
  XR_STICK_PICKER_SPACING,
  MENU_PANEL,
  HINT_WIDTH,
  HINT_Y,
  XR_MENU_PLAY_HIT,
  XR_MENU_PLAY_OFFSET,
  XR_DIFFICULTY_ROW_Y,
  XR_ROW_HIT_HEIGHT,
  XR_STICK_ROW_Y,
} from '../../lib/xrLayout'
import { ControllerModel } from './XRControllerModel'
import { HandModel } from './XRHandModel'
import { useBareHands } from './useBareHands'
import {
  PANEL_COLOR,
  XRArrowIcon,
  XRDifficultyBars,
  XRExitIcon,
  XRHeartIcon,
  XRPanel,
  XRPassthroughIcon,
  XRPlayIcon,
  XRPlayersIcon,
  XRPressable,
  XRSceneIcon,
  XRStarsRow,
  XR_STAR_COLOR,
  XR_STAR_SPENT_COLOR,
} from './XRUi'
/**
 * Run menu for immersive sessions.
 *
 * In VR/AR there is no DOM, so the start screen is not seen: before, the session
 * started a run by itself and the player could not choose anything. This menu
 * replaces it with geometry, in front of the player and at eye height.
 *
 * **Without a single letter, on purpose.** drei's `<Text>` downloads the fonts from
 * a CDN (troika resolves them against jsDelivr) and the game must work on a
 * headset with no way out to the internet —besides, the CSP blocks it—. So each setting
 * is represented by what it means: the number of sticks, with the sticks
 * themselves; the difficulty, with growing bars and the colour the desktop
 * menu already uses. Each state is told by shape *and* colour, never colour alone.
 */

// The layout lives in `@/lib/xrLayout` so that the immersive-session tests
// aim the controller at exactly these same points.
const STICK_PICKER_SPACING = XR_STICK_PICKER_SPACING
const DIFFICULTY_SPACING = XR_DIFFICULTY_SPACING

/**
 * Picker for the number of sticks: a row with the 13 possible ones, lit up to
 * the chosen one. It is read by counting and it is literally what will hang from the machine.
 * Touching one selects that number (the store clamps to the allowed range).
 */
function StickPicker() {
  const { stickCount, setStickCount } = useGame()
  const width = (MAX_STICKS - 1) * STICK_PICKER_SPACING

  return (
    <group position={[0, XR_STICK_ROW_Y, 0]}>
      {Array.from({ length: MAX_STICKS }, (_, index) => {
        const count = index + 1
        const on = count <= stickCount
        const selectable = count >= MIN_STICKS
        return (
          <XRPressable
            key={count}
            position={[index * STICK_PICKER_SPACING - width / 2, 0, 0]}
            onSelect={() => setStickCount(count)}
            disabled={!selectable}
            hitSize={[STICK_PICKER_SPACING, XR_ROW_HIT_HEIGHT.sticks, 0.05]}
          >
            {/* A miniature stick: lit if it is within the selection. */}
            <mesh position={[0, on ? 0.008 : 0, 0]}>
              <cylinderGeometry
                args={[0.008, 0.008, on ? 0.11 : 0.075, 8]}
              />
              <meshStandardMaterial
                color={on ? STICK_COLOR : '#3d4654'}
                emissive={STICK_COLOR}
                emissiveIntensity={on ? 0.55 : 0}
                roughness={0.6}
              />
            </mesh>
          </XRPressable>
        )
      })}
    </group>
  )
}

/**
 * Level picker, in the sticks' row when playing Levels: one
 * box per level, the chosen one lit, with its stars on top and the ones
 * still to be opened dimmed. Like the sticks' one, it is chosen by touching the one
 * wanted; the locked ones do not respond.
 */
function LevelPicker() {
  const { activeLevel, unlockedLevel, levelStars, setLevel } = useGame()
  const width = (LEVEL_COUNT - 1) * XR_LEVEL_PICKER_SPACING

  return (
    <group position={[0, XR_STICK_ROW_Y, 0]}>
      {Array.from({ length: LEVEL_COUNT }, (_, index) => {
        const level = index + 1
        const locked = level > unlockedLevel
        const selected = level === activeLevel
        const stars = levelStars[index] ?? 0
        return (
          <XRPressable
            key={level}
            position={[index * XR_LEVEL_PICKER_SPACING - width / 2, 0, selected ? 0.02 : 0]}
            onSelect={() => setLevel(level)}
            disabled={locked}
            hitSize={[XR_LEVEL_PICKER_SPACING, XR_ROW_HIT_HEIGHT.sticks, 0.05]}
          >
            <mesh position={[0, -0.02, 0]}>
              <boxGeometry args={[0.03, selected ? 0.07 : 0.05, 0.012]} />
              <meshStandardMaterial
                color={selected ? STICK_COLOR : locked ? '#1c2634' : '#3d4654'}
                emissive={STICK_COLOR}
                emissiveIntensity={selected ? 0.55 : 0}
                roughness={0.6}
                transparent
                opacity={locked ? 0.35 : 1}
              />
            </mesh>
            {/* The stars earned, stacked on top of the box: with no room
                for three in a row, they are put in a column and counted. */}
            {!locked &&
              Array.from({ length: 3 }, (_, star) => (
                <mesh key={star} position={[0, 0.03 + star * 0.016, 0.004]}>
                  <boxGeometry args={[0.014, 0.008, 0.006]} />
                  <meshBasicMaterial
                    color={star < stars ? XR_STAR_COLOR : XR_STAR_SPENT_COLOR}
                    toneMapped={false}
                  />
                </mesh>
              ))}
          </XRPressable>
        )
      })}
    </group>
  )
}

/**
 * Difficulty picker: five tokens with 1 to 5 growing bars, from green
 * to red. The chosen one comes forward and lights up, so it does not depend on colour.
 * In Levels the level says it: the token in question is shown lit and the
 * others do not respond.
 */
function DifficultyPicker({ locked = false }: { locked?: boolean }) {
  const { activeDifficulty: difficulty, setDifficulty } = useGame()
  const width = (DIFFICULTY_ORDER.length - 1) * DIFFICULTY_SPACING

  return (
    <group position={[0, XR_DIFFICULTY_ROW_Y, 0]}>
      {DIFFICULTY_ORDER.map((level, index) => {
        const selected = level === difficulty
        const color = DIFFICULTY_COLORS[level]
        return (
          <XRPressable
            key={level}
            position={[index * DIFFICULTY_SPACING - width / 2, 0, selected ? 0.022 : 0]}
            onSelect={() => setDifficulty(level)}
            disabled={locked}
            hitSize={[DIFFICULTY_SPACING * 0.92, XR_ROW_HIT_HEIGHT.difficulty, 0.05]}
          >
            <mesh position={[0, 0, -0.008]}>
              <boxGeometry args={[DIFFICULTY_SPACING * 0.82, 0.13, 0.012]} />
              <meshStandardMaterial
                color={selected ? color : '#1c2634'}
                emissive={color}
                emissiveIntensity={selected ? 0.5 : 0.06}
                roughness={0.55}
                transparent
                opacity={locked && !selected ? 0.35 : 1}
              />
            </mesh>
            {/* Bars: as many as the level, each one taller than the previous.
                The same ones the tutorial shows when recalling the level. */}
            <XRDifficultyBars
              difficulty={level}
              lit={selected}
              position={[0, -0.04, 0]}
            />
          </XRPressable>
        )
      })}
    </group>
  )
}

/** Spacing between the hearts of the mode toggle. */
const MODE_HEART_SPACING = 0.045
/** Half-side of those hearts: smaller than a button icon, there are three. */
const MODE_HEART_SIZE = 0.016
/**
 * The mode, said with what each one puts at stake: nothing in practice —the
 * hearts dimmed—, stars in levels, the three hearts lit in
 * challenge. Each press goes to the next and from the last back to the first: one
 * button that cycles through three states, without a letter, like the whole immersive menu.
 * The state is told by drawing, brightness and size, never by colour alone.
 */
function ModeToggle() {
  const { gameMode, setGameMode } = useGame()
  const challenge = gameMode === 'challenge'
  const levels = gameMode === 'levels'
  const width = (CHALLENGE_LIVES - 1) * MODE_HEART_SPACING
  // The challenge first (`MENU_MODES`): from the challenge it goes to practice and from the levels, to the challenge.
  const next = nextMode(gameMode)

  return (
    <XRPressable
      position={XR_MODE_TOGGLE_OFFSET}
      onSelect={() => setGameMode(next)}
      hitSize={[0.2, 0.13, 0.06]}
    >
      <mesh position={[0, 0, -0.008]}>
        <boxGeometry args={[0.17, 0.1, 0.014]} />
        <meshStandardMaterial
          color={challenge ? '#4c1d24' : levels ? '#3b2f0b' : '#1c2634'}
          emissive={levels ? XR_STAR_COLOR : LIFE_COLOR}
          emissiveIntensity={challenge || levels ? 0.4 : 0.04}
          roughness={0.5}
        />
      </mesh>
      {levels ? (
        <XRStarsRow stars={3} position={[0, 0, 0.008]} spacing={MODE_HEART_SPACING} />
      ) : (
        Array.from({ length: CHALLENGE_LIVES }, (_, index) => (
          <XRHeartIcon
            key={index}
            position={[index * MODE_HEART_SPACING - width / 2, 0, 0.008]}
            size={challenge ? MODE_HEART_SIZE : MODE_HEART_SIZE * 0.75}
            color={challenge ? LIFE_COLOR : '#55606f'}
          />
        ))
      )}
    </XRPressable>
  )
}

/**
 * Round or endless, only in practice. On, the machine reloads every time
 * it empties and the run is ended by the player. It is drawn as what it is: a
 * ring, the path that never ends; off, a loose stretch.
 */
function EndlessToggle() {
  const { endless, setEndless } = useGame()

  return (
    <XRPressable
      position={XR_ENDLESS_TOGGLE_OFFSET}
      onSelect={() => setEndless(!endless)}
      hitSize={[0.16, 0.13, 0.06]}
    >
      <mesh position={[0, 0, -0.008]}>
        <boxGeometry args={[0.13, 0.1, 0.014]} />
        <meshStandardMaterial
          color={endless ? '#1d4ed8' : '#1c2634'}
          emissive="#60a5fa"
          emissiveIntensity={endless ? 0.45 : 0.05}
          roughness={0.5}
        />
      </mesh>
      <mesh position={[0, 0, 0.008]} rotation={[0, 0, 0]}>
        <torusGeometry args={[0.022, 0.006, 8, 24, endless ? Math.PI * 2 : Math.PI]} />
        <meshBasicMaterial color={endless ? '#ffffff' : '#64748b'} toneMapped={false} />
      </mesh>
    </XRPressable>
  )
}
/**
 * Against whom, only in the challenge: a single chip or two facing each other —the siblings' icon—,
 * and each press goes to the other, like the endless toggle in whose slot it goes. On for
 * two, the plate lights up besides changing the drawing: never colour alone.
 */
function PlayersToggle() {
  const { players, setPlayers } = useGame()
  const twoPlayers = players === 2
  const ink = twoPlayers ? '#ffffff' : '#94a3b8'

  return (
    <XRPressable
      position={XR_PLAYERS_TOGGLE_OFFSET}
      onSelect={() => setPlayers(twoPlayers ? 1 : 2)}
      hitSize={XR_MENU_HIT.endless}
    >
      <mesh position={[0, 0, -0.008]}>
        <boxGeometry args={[0.13, 0.1, 0.014]} />
        <meshStandardMaterial
          color={twoPlayers ? '#15803d' : '#1c2634'}
          emissive="#22c55e"
          emissiveIntensity={twoPlayers ? 0.45 : 0.05}
          roughness={0.5}
        />
      </mesh>
      <XRPlayersIcon
        position={[0, 0, 0.008]}
        size={0.016}
        table={ink}
        near={{ color: ink }}
        far={twoPlayers ? { color: ink } : null}
      />
    </XRPressable>
  )
}

/**
 * Scenery or real room, without leaving the session.
 *
 * In an `immersive-ar` session the two modes are the same session painted in two
 * ways, so the change is immediate (with its fade, see `SceneryFade`).
 * In an `immersive-vr` session there is no passthrough to show —the headset does not
 * deliver it—, so the option is shown dimmed instead of lying. It writes the
 * hall's scenery: the hall's panel and this picker show the same thing.
 */
function SceneryPicker({ passthroughAvailable }: { passthroughAvailable: boolean }) {
  const { scenery, setScenery } = useGame()

  const options = [
    { key: 'scene' as const, Icon: XRSceneIcon, enabled: true },
    {
      key: 'passthrough' as const,
      Icon: XRPassthroughIcon,
      enabled: passthroughAvailable,
    },
  ]

  return (
    <group position={XR_SCENERY_PICKER_OFFSET}>
      {options.map(({ key, Icon, enabled }, index) => {
        const selected = scenery === key
        return (
          <XRPressable
            key={key}
            position={[index * 0.15 - 0.075, 0, selected ? 0.02 : 0]}
            onSelect={() => setScenery(key)}
            disabled={!enabled}
            hitSize={[0.14, 0.12, 0.06]}
          >
            <mesh position={[0, 0, -0.008]}>
              <boxGeometry args={[0.12, 0.1, 0.012]} />
              <meshStandardMaterial
                color={selected ? '#1d4ed8' : '#1c2634'}
                emissive="#60a5fa"
                emissiveIntensity={selected ? 0.45 : 0.05}
                roughness={0.5}
                // Really dimmed when the headset gives no passthrough: the
                // state is told by opacity and not only by colour.
                transparent
                opacity={enabled ? 1 : 0.35}
              />
            </mesh>
            <Icon
              position={[0, 0, 0.008]}
              size={0.028}
              color={enabled ? '#ffffff' : '#64748b'}
            />
          </XRPressable>
        )
      })}
    </group>
  )
}

/** Height of the hoop's gauge, in metres. */
const HOOP_GAUGE_HEIGHT = 0.085
/** Half-length of the mark's travel inside that gauge. */
const HOOP_GAUGE_TRAVEL = HOOP_GAUGE_HEIGHT / 2 - 0.014

/**
 * Raising and lowering the hoop by hand.
 *
 * The hoop places itself from the height of the headset (see `hoopHeight.ts`),
 * but that does not always get it right: the headset does not always say at what height the
 * head is, and whoever plays seated on a sofa with the space calibrated standing comes out
 * measured too tall. This is the correction.
 *
 * **The answer is the machine itself.** The hoop passes in front of the panel, on its
 * right, so on pressing it is seen going up or down: no figure is needed, which besides could
 * not be written (the immersive menu goes without a single letter, see above). The
 * gauge in the middle only says how much travel is left, and the buttons go dim
 * on reaching the limit, so the limit is seen before bumping into it.
 */
function HoopHeightPicker() {
  const { hoopAdjustment, adjustHoop } = useGame()
  const atTop = hoopAdjustment >= HOOP_ADJUST_RANGE
  const atBottom = hoopAdjustment <= -HOOP_ADJUST_RANGE

  const buttons = [
    { key: 'down', up: false, offset: XR_HOOP_DOWN_OFFSET, disabled: atBottom },
    { key: 'up', up: true, offset: XR_HOOP_UP_OFFSET, disabled: atTop },
  ]

  return (
    <group>
      {buttons.map(({ key, up, offset, disabled }) => (
        <XRPressable
          key={key}
          position={offset}
          onSelect={() => adjustHoop(up ? 1 : -1)}
          disabled={disabled}
          hitSize={[0.13, 0.1, 0.06]}
        >
          <mesh position={[0, 0, -0.008]}>
            <boxGeometry args={[0.1, 0.085, 0.012]} />
            <meshStandardMaterial
              color="#1c2634"
              emissive="#94a3b8"
              emissiveIntensity={disabled ? 0.02 : 0.24}
              roughness={0.5}
              // Really dimmed at the limit: the state is told by
              // opacity and by brightness, not only by colour.
              transparent
              opacity={disabled ? 0.35 : 1}
            />
          </mesh>
          <XRArrowIcon
            position={[0, 0, 0.008]}
            up={up}
            color={disabled ? '#64748b' : '#ffffff'}
          />
        </XRPressable>
      ))}

      {/* Gauge: a rail with the miniature hoop marking where it is. */}
      <group position={XR_HOOP_GAUGE_OFFSET}>
        <mesh position={[0, 0, -0.008]}>
          <boxGeometry args={[0.012, HOOP_GAUGE_HEIGHT, 0.008]} />
          <meshStandardMaterial
            color="#1c2634"
            emissive="#94a3b8"
            emissiveIntensity={0.08}
            roughness={0.5}
          />
        </mesh>
        <mesh
          position={[
            0,
            (hoopAdjustment / HOOP_ADJUST_RANGE) * HOOP_GAUGE_TRAVEL,
            0,
          ]}
        >
          <boxGeometry args={[0.05, 0.009, 0.012]} />
          <meshStandardMaterial
            color={STICK_COLOR}
            emissive={STICK_COLOR}
            emissiveIntensity={0.55}
            roughness={0.55}
          />
        </mesh>
      </group>
    </group>
  )
}

/**
 * Watching the demonstration of how to play again.
 *
 * The tutorial gets in the way only once, so whoever skipped it —or whoever comes back
 * months later— needs a way to get it back. It carries in miniature what
 * it is going to teach —the controller with its trigger marked, or the hand if one entered without
 * controllers—, because at one metre an object is recognised better than an invented
 * symbol, and because promising a controller to whoever plays with their hands is promising
 * another demonstration.
 */
function TutorialButton() {
  const { startGame } = useGame()
  const bareHanded = useBareHands()

  return (
    <XRPressable
      position={XR_MENU_TUTORIAL_OFFSET}
      onSelect={() => startGame({ tutorial: true })}
      hitSize={[0.14, 0.12, 0.06]}
    >
      <mesh position={[0, 0, -0.008]}>
        <boxGeometry args={[0.11, 0.095, 0.014]} />
        <meshStandardMaterial
          color="#1c2634"
          emissive="#94a3b8"
          emissiveIntensity={0.22}
          roughness={0.5}
        />
      </mesh>
      {/* Still and without a pulse: in the menu the pulse would compete with the start
          button, which is where almost everybody goes. */}
      {bareHanded ? (
        <group position={[0, 0.006, 0.02]} rotation={[0.2, -0.2, 0]} scale={0.42}>
          <HandModel side={1} highlight pulsing={false} />
        </group>
      ) : (
        <group position={[0, 0.012, 0.02]} rotation={[0.25, -0.5, 0]} scale={0.5}>
          <ControllerModel side={1} highlight pulsing={false} />
        </group>
      )}
    </XRPressable>
  )
}

/** What the menu's plate takes up, in metres (`xrLayout.ts`, which needs it for the sticks). */
export { MENU_PANEL }

/**
 * What each row of the menu is about.
 *
 * It goes on a separate canvas because the rest of the panel is geometry and a letter does not fit there, and
 * above the buttons and not inside: inside one would have to choose between the name and the icon,
 * and the icon is what gets pressed.
 */
/**
 * The panel's labels: what each row is. It comes out of the component so a test
 * can measure them with a fake canvas —`legibility.ts`— without mounting the scene:
 * if one name overlaps another or runs off, it is seen here and not with the headset on.
 */
export function drawNames(
  ctx: CanvasRenderingContext2D,
  t: (key: TextKey) => string,
  gameMode: GameMode = 'practice',
  players: PlayerCount = 1,
  moreOptions = false,
): void {
  // The cabinet's name, top left: it is a proper name and is not translated.
  drawText(ctx, gameName(), MENU_TITLE.x, MENU_TITLE.y, {
    size: MENU_TEXT.title,
    color: '#ffffff',
    align: 'left',
    maxWidth: MENU_TITLE.width,
  })

  for (const { text, x, y } of menuLabelsFor(gameMode, moreOptions)) {
    // The mode's row says «Modo» and which one is chosen: «Modo: Reto».
    drawText(ctx, menuLabelText(text, gameMode, t), x, y + ROW_LABEL_RISE, {
      size: MENU_TEXT.label,
      color: '#94a3b8',
      maxWidth: 0.3,
    })
  }

  // What the chosen mode is. The modes were **only names** on the panel —«Práctica»,
  // «Desafío»— and what tells them apart was only told by the website's screen, which with the
  // headset on is not seen.
  // For two, the explanation is that of the two-player match: its toggle already says the mode.
  const hint = playsAsDuel(gameMode, players) ? PLAYER_COUNT_HINTS[2] : GAME_MODE_HINTS[gameMode]
  drawParagraph(ctx, t(hint), 0, HINT_Y, {
    size: MENU_TEXT.hint,
    color: '#94a3b8',
    maxWidth: HINT_WIDTH,
    anchor: 'top',
  })

  // The name of the fold button, on its plate and in two lines: «Más / opciones».
  const options = optionsButton(gameMode, 'headset', moreOptions)
  if (options != null) {
    // At the explanation's letter size and not the labels': right at the bottom, in the corner and seen
    // foreshortened, the labels' one stayed at 1.39°.
    drawParagraph(ctx, t(options), XR_MENU_OPTIONS_OFFSET[0], XR_MENU_OPTIONS_OFFSET[1], {
      size: MENU_TEXT.hint,
      color: '#ffffff',
      maxWidth: OPTIONS_WIDTH,
      lineHeight: 1.15,
    })
  }
}

function RowLabels({ moreOptions }: { moreOptions: boolean }) {
  const t = translator(useLang())
  const { gameMode, players } = useGame()

  const write = useCallback(
    (ctx: CanvasRenderingContext2D) => drawNames(ctx, t, gameMode, players, moreOptions),
    [t, gameMode, players, moreOptions],
  )

  return (
    <group position={[0, 0, 0.004]}>
      <CanvasPanel
        width={MENU_PANEL[0]}
        height={MENU_PANEL[1]}
        draw={write}
        fallbackColor={PANEL_COLOR}
      />
    </group>
  )
}

/**
 * The «Más opciones» button, in the corner opposite the exit one: it unfolds what the template
 * leaves folded when the menu opens (`gameMenu.ts`) and folds it again. Its name is written
 * with the labels, on top of the plate.
 */
function OptionsButton({ moreOptions, onToggle }: { moreOptions: boolean; onToggle: () => void }) {
  return (
    <XRPressable position={XR_MENU_OPTIONS_OFFSET} onSelect={onToggle} hitSize={XR_MENU_HIT.options}>
      <mesh position={[0, 0, -0.008]}>
        <boxGeometry args={[OPTIONS_WIDTH, 0.1, 0.014]} />
        <meshStandardMaterial
          color={moreOptions ? '#1d4ed8' : '#334155'}
          emissive="#94a3b8"
          emissiveIntensity={0.22}
          roughness={0.5}
        />
      </mesh>
    </XRPressable>
  )
}

export function XRMenu({ hasDomUi = false }: { hasDomUi?: boolean }) {
  const mode = useXR((state) => state.mode)
  const { gameState } = useGame()
  // Outside the immersive session the DOM start screen rules.
  if ((hasDomUi && mode == null) || gameState !== 'menu') {
    return null
  }
  // The panel is mounted every time one goes back to the menu: that way it is born folded.
  return <MenuPanel immersive={mode != null} passthroughAvailable={mode === 'immersive-ar'} />
}

function MenuPanel({ immersive, passthroughAvailable }: { immersive: boolean; passthroughAvailable: boolean }) {
  const { gameMode, startGame } = useGame()
  const exit = useExit()
  // What is folded behind «Más opciones» belongs to the UI: it is not saved, and the menu opens folded.
  const [moreOptions, setMoreOptions] = useState(false)
  const shows = (row: Parameters<typeof isShown>[0]) => isShown(row, gameMode, 'headset', moreOptions)
  const options = optionsButton(gameMode, 'headset', moreOptions)

  // In the headset, the column at ≤30° to the left (`XR_MENU_POSE`); without a headset —the hall on
  // desktop— in front.
  const pose = menuPoseFor(immersive)
  return (
    <group position={pose.position} rotation={[0, pose.yaw, 0]} scale={pose.scale}>
      {/* Taller than before: the hoop's row goes right at the top and needs
          panel behind it so as not to be left floating outside it. */}
      <XRPanel width={MENU_PANEL[0]} height={MENU_PANEL[1]} color={PANEL_COLOR} />
      <RowLabels moreOptions={moreOptions} />
      {shows('hoop') && <HoopHeightPicker />}
      <TutorialButton />
      {/* **Only practice asks** for sticks and speed, and behind «Más opciones». In Levels the
          level says them: the sticks' row is swapped for the ladder and the tokens stay as a
          sample. The challenge is fixed (`CHALLENGE_SETUP`): the mode is chosen and start is pressed,
          without rows that change nothing. */}
      {shows('levels') ? <LevelPicker /> : shows('sticks') ? <StickPicker /> : null}
      {(shows('levels') || shows('speed')) && <DifficultyPicker locked={shows('levels')} />}
      <ModeToggle />
      {shows('endless') && <EndlessToggle />}
      {shows('players') && <PlayersToggle />}
      {shows('around') && <SceneryPicker passthroughAvailable={passthroughAvailable} />}
      {options != null && <OptionsButton moreOptions={moreOptions} onToggle={() => setMoreOptions(!moreOptions)} />}
      {/* Start. The first time the run opens with the tutorial —with the
          headset on there is no way of knowing that the sticks are grabbed, nor with
          which button—, but that is decided by the game and not by this button: inside the
          session one can also start from the overlay with the keyboard. */}
      <XRPressable
        position={XR_MENU_PLAY_OFFSET}
        onSelect={() => startGame()}
        hitSize={XR_MENU_PLAY_HIT}
      >
        <mesh position={[0, 0, -0.008]}>
          <boxGeometry args={[0.32, 0.1, 0.014]} />
          <meshStandardMaterial
            color="#15803d"
            emissive="#22c55e"
            emissiveIntensity={0.45}
            roughness={0.45}
          />
        </mesh>
        <XRPlayIcon position={[0, 0, 0.008]} />
      </XRPressable>

      {/* Exit. From the immersive menu there was no way to go back without taking the
          headset off: the system button is not always to hand. Where one
          goes back to is decided by whoever mounts the game (see `game/exit.tsx`): on its
          own website it is closing the session; inside the xrcade hall, handing the
          player back to it without touching it. */}
      <XRPressable
        position={XR_MENU_EXIT_OFFSET}
        onSelect={exit}
        hitSize={[0.16, 0.13, 0.06]}
      >
        <mesh position={[0, 0, -0.008]}>
          <boxGeometry args={[0.13, 0.1, 0.014]} />
          <meshStandardMaterial
            color="#334155"
            emissive="#94a3b8"
            emissiveIntensity={0.22}
            roughness={0.5}
          />
        </mesh>
        <group position={[0, 0, 0.008]}>
          <XRExitIcon />
        </group>
      </XRPressable>

    </group>
  )
}
