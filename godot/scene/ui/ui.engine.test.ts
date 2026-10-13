/**
 * Stick Rush's ui in Godot, measured with the web's instrument and pressed with the mouse.
 *
 * **Measured with the same as the web**: the panels here note down what they write with the engine's
 * type (`panel.escritos`) and are passed to the same guards as the web's `*.legible.test.ts`
 * —`legibility.ts` (nothing overlaps or sticks out, no type below what is read at its
 * distance), `panelReading.ts` (each type with its foreshortening, from three eye heights, standing and with
 * the world at eye level, with the size of its list and without getting into a button) and `exitCorner.ts` (the
 * exit, at the bottom right)—. The menu in the headset column and in the desktop place, in the
 * two languages and in the three modes; the notice; the tutorial in its two steps, with a controller and with the hands;
 * and the type of the end.
 *
 * **Pressed with the mouse**: the whole ui mounted with a real camera and the run of
 * `game/run.ts`, and the clicks through the same `MousePointer` as when flat.
 *
 * It runs inside the engine, with the domain tests (`npm run godot:build -- --tests`).
 */
import {
  Camera3D,
  Engine,
  InputEventMouseButton,
  InputEventMouseMotion,
  MouseButton,
  Node,
  Node3D,
  OS,
  SceneTree,
  Vector2,
  Vector3,
} from 'godot'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { legibilityProblems } from '@kit/lib/ui/legibility'
import { LINE_HEIGHT, type Escrito, drawnTexts } from '@kit/lib/ui/text'
import { PANEL_DEL_TUTORIAL } from '@kit/lib/ui/tutorial'
import { PointerAim } from '@kit/runtime/ui/pointerAim'

import { LANGS, VOLUME_KEYS } from '@/lib/settings'
import { exitProblems } from '@/lib/exitCorner'
import { DIFFICULTY_ORDER, MAX_STICKS, MIN_STICKS } from '@/lib/gameConfig'
import { CHALLENGE_LIVES, CHALLENGE_SETUP, GAME_MODE_ORDER } from '@/lib/gameMode'
import { VIEW_WITHOUT_TURNING, angleFromGaze, signCorners, signRun, signPose, signPlacement, type WhatIsPlayed } from '@/lib/machineSign'
import { goalSign, type Goal } from '@/lib/goal'
import { maxScore } from '@/lib/scoring'
import { softTranslator } from '@/lib/textos'
import { HOOP_ADJUST_STEP } from '@/lib/hoopHeight'
import { centreInside, sizesOffList, textsOnButtons, unreadableTexts, worstReadingDistance, type PanelPose } from '@/lib/panelReading'
import { gameStorage } from '@/lib/storage'
import { setGameName } from '@/lib/menuTemplate'
import { TUTORIAL_STEPS } from '@/lib/tutorial'
import {
  CONFIRM_BOXES,
  CONFIRM_TEXT,
  DUEL_TEXT,
  MENU_TEXT,
  MENU_TITLE,
  TUTORIAL_TEXT,
  XR_DUEL_POSITION,
  XR_DUEL_SIZE,
  XR_CONFIRM_POSITION,
  XR_CONFIRM_SIZE,
  XR_HUD_POSITION,
  XR_MENU_DESK_POSE,
  XR_MENU_HIT,
  XR_MENU_POSE,
  XR_MENU_SPOT,
  XR_TUTORIAL_POSITION,
  XR_HUD_WITH_SIGN,
  xrPanelViews,
  type MenuPose,
} from '@/lib/xrLayout'

import { COUNTDOWN_SECONDS, Run } from '../game/run'
import { createDuel, duelSummary, recordTurn } from '@/lib/duel'
import { getDuelTally } from '@/lib/duelTally'
import { LANG_KEY, currentLang, volumeLevels } from '@kit/runtime/settings'
import { QuitNotice, DuelPanel } from './notice'
import { SIGN, Sign, SIGN_ASPECT } from './sign'
import { GameUi, type GameScene } from './ui'
import { SCOREBOARD_FONT, Scoreboard, type ScoreboardState } from './scoreboard'
import { MENU_PANEL, GameMenu, type MenuState } from './menu'
import { STICK_RUSH_MEASUREMENTS, GameTutorial } from './tutorial'

type Views = { where: string; pose: PanelPose; eyes: { x: number; y: number; z: number } }[]

/** What the web measures of a panel: that it can be read from where you play with the headset. */
function measure(written: readonly Escrito[], panel: { width: number; height: number }, views: Views): string[] {
  const distance = Math.max(...views.map(({ pose, eyes }) => worstReadingDistance(drawnTexts(written), pose, eyes, LINE_HEIGHT)))
  return [
    ...legibilityProblems(written, { panel, distance }),
    ...views.flatMap(({ pose, eyes, where }) => unreadableTexts(drawnTexts(written), pose, eyes, LINE_HEIGHT).map((p) => `${where}: ${p}`)),
  ]
}

/** What is written on a scaled panel, as `menu.legible.test.ts` measures it (`aEscala`). */
function scaled(written: readonly Escrito[], k: number): Escrito[] {
  return written.map((e) => ({ ...e, x: e.x * k, y: e.y * k, ancho: e.ancho * k, alto: e.alto * k }))
}

const nothing = () => {}

function menuState(changes: Partial<MenuState> = {}): MenuState {
  return {
    lang: 'en',
    mode: 'practice',
    difficulty: 'easy',
    sticks: MIN_STICKS,
    endless: false,
    level: 1,
    unlocked: 1,
    stars: Array.from({ length: 15 }, () => 0 as const),
    hoopAdjustment: 0,
    room: false,
    scenery: 'scene',
    players: 1,
    moreOptions: false,
    ...changes,
  }
}

describe('the menu measures what the web does', () => {
  const menu = new GameMenu(
    {
      nextMode: nothing,
      chooseDifficulty: nothing,
      chooseSticks: nothing,
      toggleEndless: nothing,
      togglePlayers: nothing,
      toggleOptions: nothing,
      chooseLevel: nothing,
      chooseScenery: nothing,
      moveHoop: nothing,
      watchTutorial: nothing,
      play: nothing,
      exit: nothing,
    },
    new PointerAim(),
  )
  const PLACES: { name: string; pose: MenuPose }[] = [
    { name: 'headset column', pose: XR_MENU_POSE },
    { name: 'desktop', pose: XR_MENU_DESK_POSE },
  ]

  it('the names of the rows and the explanation of the mode, in the two languages', () => {
    menu.paint(menuState({ lang: 'es', moreOptions: true }))
    const texts = menu.panel.escritos.map((e) => e.texto)
    // The row of the mode says «Modo» and which one is chosen, and its explanation starts with whether it gives a medal.
    expect(texts).toEqual(expect.arrayContaining(['Aro', 'Palos', 'Velocidad', 'Modo: Práctica', 'Alrededor', 'Menos']))
    expect(texts.some((t) => t.startsWith('Sin medalla. Caen todos'))).toBe(true)
    // Folded, as it opens: the mode and the «Más opciones» button.
    menu.paint(menuState({ lang: 'es' }))
    expect(menu.panel.escritos.map((e) => e.texto)).toEqual(expect.arrayContaining(['Modo: Práctica', 'Más', 'opciones']))
    expect(menu.panel.escritos.map((e) => e.texto)).not.toContain('Aro')
    // The challenge is fixed: without the rows that are not chosen, without their names and without «Más opciones».
    menu.paint(menuState({ mode: 'challenge', moreOptions: true }))
    expect(menu.panel.escritos.map((e) => e.texto)).not.toContain('Sticks')
    expect(menu.panel.escritos.map((e) => e.texto)).not.toContain('Hoop')
    expect(menu.panel.escritos.map((e) => e.texto)).not.toContain('More')
    expect(menu.panel.escritos.map((e) => e.texto)).toContain('Mode: Challenge')
    menu.paint(menuState({ lang: 'es', mode: 'challenge' }))
    expect(menu.panel.escritos.map((e) => e.texto)).toContain('Modo: Reto')
    expect(menu.panel.escritos.some((e) => e.texto.startsWith('Cuenta para medalla.'))).toBe(true)
  })

  it('reads in the headset column and on the desktop, in each language and mode, with no sizes off the list', () => {
    for (const lang of LANGS) {
      for (const [mode, players] of [...GAME_MODE_ORDER.map((m) => [m, 1] as const), ['challenge', 2] as const]) {
        for (const moreOptions of [false, true]) {
          menu.paint(menuState({ lang, mode, players, moreOptions }))
          const written = menu.panel.escritos
          const where = `${lang} ${mode}${moreOptions ? ' unfolded' : ''}`
          expect(sizesOffList(drawnTexts(written), LINE_HEIGHT, Object.values(MENU_TEXT)), where).toEqual([])
          for (const { name, pose } of PLACES) {
            const scaledTexts = scaled(written, pose.scale)
            const panel = { width: MENU_PANEL[0] * pose.scale, height: MENU_PANEL[1] * pose.scale }
            expect(measure(scaledTexts, panel, xrPanelViews(pose.position, pose.yaw)), `${where}, ${name}`).toEqual([])
          }
        }
      }
    }
  })

  it('with two players: the row of against whom with its name and the explanation of the two-player run', () => {
    menu.paint(menuState({ lang: 'es', mode: 'challenge', players: 2 }))
    const texts = menu.panel.escritos.map((e) => e.texto)
    expect(texts).toContain('Jugadores')
    expect(texts.some((t) => t.startsWith('Pasaos el mando'))).toBe(true)
    menu.paint(menuState({ lang: 'es', mode: 'practice', players: 2 }))
    expect(menu.panel.escritos.map((e) => e.texto)).not.toContain('Jugadores')
  })

  it('no label gets into a web button', () => {
    const buttons = Object.keys(XR_MENU_HIT).map((id) => ({ x: XR_MENU_SPOT[id][0], y: XR_MENU_SPOT[id][1], width: XR_MENU_HIT[id][0], height: XR_MENU_HIT[id][1] }))
    // The only text on a button is the name of «Más opciones», written on its plate.
    const [ox, oy] = XR_MENU_SPOT.options
    const isItsOwn: typeof centreInside = (text, button) => button.x === ox && button.y === oy && centreInside(text, button)
    for (const lang of LANGS) {
      for (const mode of GAME_MODE_ORDER) {
        for (const moreOptions of [false, true]) {
          menu.paint(menuState({ lang, mode, moreOptions }))
          expect(textsOnButtons(drawnTexts(menu.panel.escritos), buttons, isItsOwn), `${lang} ${mode}`).toEqual([])
        }
      }
    }
  })

  it('the name of the cabinet, at the top left and untranslated; a long one fits without shrinking', () => {
    const title = () => menu.panel.escritos.find((e) => e.y === MENU_TITLE.y)?.texto
    for (const lang of LANGS) {
      menu.paint(menuState({ lang }))
      expect(title(), lang).toBe('Stick Rush')
    }
    setGameName('Atrapa los palos que caen del aro')
    try {
      for (const lang of LANGS) {
        for (const moreOptions of [false, true]) {
          menu.paint(menuState({ lang, moreOptions }))
          const written = menu.panel.escritos
          expect(title(), lang).toBe('Atrapa los palos que caen del aro')
          expect(sizesOffList(drawnTexts(written), LINE_HEIGHT, Object.values(MENU_TEXT)), lang).toEqual([])
          const pose = XR_MENU_POSE
          const panel = { width: MENU_PANEL[0] * pose.scale, height: MENU_PANEL[1] * pose.scale }
          expect(measure(scaled(written, pose.scale), panel, xrPanelViews(pose.position, pose.yaw)), lang).toEqual([])
        }
      }
    } finally {
      setGameName(null)
    }
  })

  it('the exit, at the bottom right: the last of its row and nothing below', () => {
    const exit = menu.button('exit').caja
    const rest = [...menu.buttons.values()].filter((b) => b.id !== 'exit').map((b) => b.caja)
    expect(exitProblems(exit, rest, { width: MENU_PANEL[0], height: MENU_PANEL[1] })).toEqual([])
  })

  it('what belongs to practice and to around, behind «Más opciones»; with the challenge, not even the button', () => {
    menu.paint(menuState())
    expect([menu.button('sticks:5').nodo.visible, menu.button('hoopUp').nodo.visible, menu.button('scenery:scene').nodo.visible]).toEqual([false, false, false])
    expect(menu.button('options').nodo.visible).toBe(true)
    menu.paint(menuState({ moreOptions: true }))
    expect([menu.button('sticks:5').nodo.visible, menu.button('hoopUp').nodo.visible, menu.button('scenery:scene').nodo.visible]).toEqual([true, true, true])
    menu.paint(menuState({ mode: 'challenge', moreOptions: true }))
    expect([menu.button('options').nodo.visible, menu.button('hoopUp').nodo.visible, menu.button('players').nodo.visible]).toEqual([false, false, true])
  })

  it('only practice asks for sticks and speed; the levels, their ladder; and what is off is not pressed', () => {
    menu.paint(menuState({ moreOptions: true }))
    expect(menu.button('sticks:5').nodo.visible && menu.button('difficulty:easy').nodo.visible && !menu.button('level:1').nodo.visible).toBe(true)
    expect([menu.button('sticks:4').apagado, menu.button(`sticks:${MAX_STICKS}`).apagado]).toEqual([true, false])
    expect(menu.button('scenery:passthrough').apagado).toBe(true)
    menu.paint(menuState({ mode: 'levels', unlocked: 3, level: 2, moreOptions: true }))
    expect([menu.button('sticks:5').nodo.visible, menu.button('level:1').nodo.visible, menu.button('level:3').apagado, menu.button('level:4').apagado]).toEqual([
      false,
      true,
      false,
      true,
    ])
    expect(DIFFICULTY_ORDER.filter((d) => !menu.button(`difficulty:${d}`).apagado)).toEqual(['easy'])
    menu.paint(menuState({ mode: 'challenge' }))
    expect([menu.button('difficulty:easy').nodo.visible, menu.button('endless').nodo.visible]).toEqual([false, false])
    // Against whom, only in the challenge, in the slot of endless.
    expect(menu.button('players').nodo.visible).toBe(true)
    menu.paint(menuState({ mode: 'practice' }))
    expect(menu.button('players').nodo.visible).toBe(false)
    menu.paint(menuState({ hoopAdjustment: 0.2, moreOptions: true }))
    expect([menu.button('hoopUp').apagado, menu.button('hoopDown').apagado]).toEqual([true, false])
  })
})

describe('the notice, the tutorial and the end measure what the web does', () => {
  it('the notice of leaving the run, in the two languages', () => {
    const notice = new QuitNotice({ leave: nothing, keepGoing: nothing }, new PointerAim())
    const buttons = Object.values(CONFIRM_BOXES).map(({ position, size }) => ({ x: position[0], y: position[1], width: size[0], height: size[1] }))
    for (const lang of LANGS) {
      notice.write(lang)
      const written = notice.panel.escritos
      expect(measure(written, { width: XR_CONFIRM_SIZE[0], height: XR_CONFIRM_SIZE[1] }, xrPanelViews(XR_CONFIRM_POSITION)), lang).toEqual([])
      expect(sizesOffList(drawnTexts(written), LINE_HEIGHT, Object.values(CONFIRM_TEXT)), lang).toEqual([])
      expect(textsOnButtons(drawnTexts(written), buttons), lang).toEqual([])
    }
    notice.node.free()
  })

  it('the tutorial, in its steps, with a controller and with the hands, in the two languages', () => {
    const tutorial = new GameTutorial({ next: nothing, skip: nothing }, new PointerAim())
    expect(STICK_RUSH_MEASUREMENTS.boton.width).toBe(0.33)
    for (const lang of LANGS) {
      for (const hands of [false, true]) {
        for (const step of TUTORIAL_STEPS) {
          tutorial.update(step, lang, hands, 0.016)
          const written = tutorial.view.panel.escritos
          const where = `${lang} ${hands ? 'hands' : 'controller'} ${step}`
          expect(measure(written, PANEL_DEL_TUTORIAL, xrPanelViews(XR_TUTORIAL_POSITION)), where).toEqual([])
          expect(sizesOffList(drawnTexts(written), LINE_HEIGHT, Object.values(TUTORIAL_TEXT)), where).toEqual([])
        }
      }
    }
    tutorial.view.nodo.free()
  })

  it('the two-player end reads: passing the controller, winning and tying, in the two languages', () => {
    const duel = new DuelPanel()
    const pair = { wins: [128, 99] as const, ties: 17 }
    const duels = {
      pass: recordTurn(createDuel(1), 18888),
      win: recordTurn(recordTurn(createDuel(1), 18888), 29999),
      tie: recordTurn(recordTurn(createDuel(1), 20000), 20000),
    }
    for (const lang of LANGS) {
      for (const [name, d] of Object.entries(duels)) {
        duel.write(duelSummary(d, pair, lang))
        const written = duel.panel.escritos
        const where = `${lang} ${name}`
        expect(measure(written, { width: XR_DUEL_SIZE[0], height: XR_DUEL_SIZE[1] }, xrPanelViews(XR_DUEL_POSITION)), where).toEqual([])
        expect(sizesOffList(drawnTexts(written), LINE_HEIGHT, Object.values(DUEL_TEXT)), where).toEqual([])
      }
    }
    duel.write(duelSummary(duels.pass, pair, 'es'))
    expect(duel.panel.escritos.map((e) => e.texto)).toEqual(['Jugador 1: 18.888 puntos', 'Pásale el mando a Jugador 2.'])
    duel.node.free()
  })

  it('the type of the end reads, in the two languages and with the longest it can say', () => {
    const scoreboard = new Scoreboard({ repeat: nothing, backToMenu: nothing }, new PointerAim())
    for (const lang of LANGS) {
      // The repeat label changes with the mode: «Otro reto» and «Otra partida», the longest.
      for (const [title, mode] of (lang === 'es' ? ['Te has quedado sin vidas', '¡Reto superado!', 'Nivel 15'] : ['You are out of lives', 'Level 15']).flatMap((t) => (['challenge', 'practice'] as const).map((m) => [t, m] as const))) {
        const state: ScoreboardState = {
          lang,
          mode,
          finished: true,
          tokens: Array.from({ length: 5 }, () => 'caught' as const),
          streak: 5,
          fill: 1,
          mark: 0.5,
          record: true,
          lives: 0,
          stars: null,
          title,
          points: 123456,
        }
        scoreboard.paint(state)
        const written = scoreboard.panel.escritos
        const problems = measure(written, scoreboard.size, xrPanelViews(XR_HUD_POSITION))
        expect(problems, `${lang} «${title}»: ${problems.join('; ')}`).toEqual([])
        expect(sizesOffList(drawnTexts(written), LINE_HEIGHT, Object.values(SCOREBOARD_FONT)), title).toEqual([])
      }
    }
    scoreboard.node.free()
  })
})

describe('the goal sign measures what the web does', () => {
  const CEILING = maxScore(CHALLENGE_SETUP.difficulty, CHALLENGE_SETUP.stickCount)
  const GOAL: Goal = {
    medals: { bronze: 1900, silver: 3750, gold: 5200 },
    better: 'higher',
    unit: 'points in challenge',
    record: CEILING - 1,
    mode: 'challenge',
  }

  function game(changes: Partial<WhatIsPlayed>): WhatIsPlayed {
    return {
      goal: GOAL,
      gameMode: 'challenge',
      twoPlayers: false,
      gameState: 'playing',
      points: 0,
      lives: CHALLENGE_LIVES,
      resolved: 0,
      stickCount: CHALLENGE_SETUP.stickCount,
      record: CEILING - 1,
      ...changes,
    }
  }

  it('has the measurements of the web one: 24° by 4.5° at the drawing distance, and the same aspect', () => {
    const angle = (metres: number, distance: number) => (2 * Math.atan(metres / (2 * distance)) * 180) / Math.PI
    expect(angle(SIGN.height, SIGN.distance)).toBeCloseTo(4.5, 1)
    expect(angle(SIGN.title, SIGN.distance)).toBeCloseTo(1.4, 2)
    expect(angle(SIGN.detail, SIGN.distance)).toBeCloseTo(1.2, 2)
    expect(SIGN_ASPECT.width).toBeCloseTo(SIGN.width / 2)
    // In its place, inside what is seen without turning the head, as on the web.
    for (const corner of signCorners(SIGN_ASPECT)) expect(angleFromGaze(corner)).toBeLessThanOrEqual(VIEW_WITHOUT_TURNING)
  })

  it('everything it says reads with the engine type, in the two languages and where it hangs: two lines while playing, three with the footer of the end', () => {
    const sign = new Sign()
    const placement = signPlacement()
    sign.place(placement)
    const scale = placement.distance / SIGN.distance
    const views = xrPanelViews(placement.position).map((view) => ({ ...view, pose: { ...view.pose, rotation: signPose(placement).rotation } }))
    const panel = { width: SIGN.width * scale, height: SIGN.height * scale }
    let measurements = 0
    for (const lang of LANGS) {
      const t = softTranslator(lang)
      const say = (changes: Partial<WhatIsPlayed>) => {
        const run = signRun(game(changes), t)
        if (run == null) return
        const view = goalSign(run, t)
        sign.update(view, null, lang, 0)
        const written = scaled(sign.panel.escritos, scale)
        const distance = Math.max(...views.map(({ pose, eyes }) => worstReadingDistance(drawnTexts(written), pose, eyes, LINE_HEIGHT)))
        const problems = legibilityProblems(written, { panel, distance })
        expect(problems, `${lang}: ${view.title} / ${view.detail}: ${problems.join('; ')}`).toEqual([])
        expect(written.length).toBeLessThanOrEqual(view.footer == null ? 2 : 3)
        measurements++
      }
      for (const goal of [GOAL, { ...GOAL, record: null }, null]) {
        say({ goal, gameState: 'countdown' })
        for (const points of [0, 1899, 3750, 5199, 5200, CEILING]) {
          for (const [lives, resolved] of [[3, 1], [1, 12], [0, 13]]) {
            say({ goal, points, lives, resolved })
            say({ goal, points, lives, resolved, gameState: 'finished' })
          }
        }
      }
      for (const gameMode of GAME_MODE_ORDER) say({ gameMode, lives: gameMode === 'challenge' ? 3 : null, twoPlayers: gameMode === 'challenge' })
    }
    expect(measurements).toBeGreaterThan(200)
    sign.node.free()
  })

  it('celebrates the threshold that is crossed: it returns it once, grows and comes back, and freshly mounted it celebrates nothing', () => {
    const sign = new Sign()
    sign.place(signPlacement())
    const t = softTranslator('en')
    const view = goalSign(signRun(game({ points: 2000, resolved: 5 }), t)!, t)
    const scale = sign.node.scale.x
    // Mounted with a medal already earned: the threshold has not been seen being crossed.
    expect(sign.update(view, 'bronze', 'en', 0.016)).toBeNull()
    expect(sign.node.visible).toBe(true)
    expect(sign.update(view, 'silver', 'en', 0.016)).toBe('silver')
    expect(sign.celebrating).toBe('silver')
    expect(sign.update(view, 'silver', 'en', 0.2)).toBeNull()
    expect(sign.node.scale.x).toBeGreaterThan(scale)
    for (let i = 0; i < 10; i++) sign.update(view, 'silver', 'en', 0.2)
    expect(sign.celebrating).toBeNull()
    expect(sign.node.scale.x).toBeCloseTo(scale)
    // While it celebrates, the title says the medal: the colour alone is not understood.
    sign.update(view, 'bronze', 'en', 0.016)
    sign.update(view, 'silver', 'en', 0.016)
    expect(view.cheer).toBe('Bronze!')
    expect(sign.panel.escritos[0]!.texto).toBe(view.cheer)
    // With nothing to say it hides.
    sign.update(null, null, 'en', 0.016)
    expect(sign.node.visible).toBe(false)
    sign.node.free()
  })

  it('the scoreboard keeps quiet about what the sign already says: no bar, no lives and no type, and it shrinks', () => {
    const scoreboard = new Scoreboard({ repeat: nothing, backToMenu: nothing }, new PointerAim())
    const state: ScoreboardState = {
      lang: 'es',
      mode: 'challenge',
      finished: false,
      tokens: Array.from({ length: MAX_STICKS }, () => 'pending' as const),
      streak: 3,
      fill: 0.4,
      mark: 0.5,
      record: false,
      lives: 2,
      stars: null,
      title: 'Te has quedado sin vidas',
      points: 2100,
    }
    scoreboard.paint(state)
    const whole = scoreboard.size.height
    scoreboard.paint({ ...state, onSign: true })
    expect(scoreboard.size.height).toBeCloseTo(XR_HUD_WITH_SIGN.run.height)
    expect(scoreboard.size.height).toBeLessThan(whole)
    scoreboard.paint({ ...state, onSign: true, finished: true })
    expect(scoreboard.size.height).toBeCloseTo(XR_HUD_WITH_SIGN.finished.height)
    // Only the labels of the buttons: how it has ended and the points are said by the sign.
    expect(scoreboard.panel.escritos.map((e) => e.texto)).toEqual(['Otro reto', 'Menú'])
    expect(scoreboard.repeat.nodo.visible).toBe(true)
    // Without a sign, the end still says how it has ended and the points.
    scoreboard.paint({ ...state, finished: true })
    expect(scoreboard.panel.escritos.map((e) => e.texto)).toEqual(['Otro reto', 'Menú', 'Te has quedado sin vidas', '2100'])
    scoreboard.node.free()
  })
})

describe("the hall's settings", () => {
  beforeEach(() => gameStorage()?.clear())

  it('the language is the saved one, and the command-line one wins', () => {
    // With nothing saved, the system's: it depends on the machine that runs the test.
    expect(['en', 'es']).toContain(currentLang())
    gameStorage()!.setItem(LANG_KEY, 'en')
    expect(currentLang()).toBe('en')
    gameStorage()!.setItem(LANG_KEY, 'es')
    expect(currentLang()).toBe('es')
    expect(currentLang('en')).toBe('en')
  })

  it('the volumes, from 0 to 1', () => {
    expect(volumeLevels()).toEqual({ sfx: 1, ambience: 0.6, muted: false })
    gameStorage()!.setItem(VOLUME_KEYS.sfx, '50')
    expect(volumeLevels().sfx).toBe(0.5)
  })
})

describe('the ui with the mouse', () => {
  let root: Node3D
  let camera: Camera3D
  let ui: GameUi
  let run: Run
  let exits: number

  beforeEach(() => {
    gameStorage()?.clear()
    // What is checked is in English: with no language saved, the game speaks the system's.
    gameStorage()?.setItem(LANG_KEY, 'en')
    const tree = Engine.get_main_loop() as SceneTree
    root = new Node3D()
    ;(tree.current_scene ?? (tree.root as Node)).add_child(root)
    camera = new Camera3D()
    camera.position = new Vector3(0, 1.9, 3.05)
    camera.fov = 52
    root.add_child(camera)
    camera.current = true
    exits = 0
    run = new Run({ seeds: () => 42 })
    // The menu opens on the challenge; almost everything here is pressed in practice, which is where things are chosen.
    run.setGameMode('practice')
    const scene: GameScene = { exit: () => exits++ }
    ui = new GameUi(run, scene, { parent: root, camera, headset: false })
  })

  afterEach(() => {
    ui.release()
    root.get_parent()?.remove_child(root)
    root.free()
  })

  /** A click on the button `id`: move, press in one frame and release in the next. */
  function click(id: string): void {
    // The aim does not count a second touch in less than 300 ms (the web's double touch).
    OS.delay_msec(310)
    const button = ui.aim.boton(id)!
    expect(button.nodo.is_visible_in_tree(), `${id} in view`).toBe(true)
    const at: Vector2 = camera.unproject_position(button.nodo.global_position)
    const move = new InputEventMouseMotion()
    move.position = at
    ui.handleInput(move)
    for (const pressed of [true, false]) {
      const e = new InputEventMouseButton()
      e.position = at
      e.button_index = MouseButton.MOUSE_BUTTON_LEFT
      e.pressed = pressed
      ui.handleInput(e)
      ui.update(0.016)
    }
  }

  it('starts in the menu; choosing and playing starts the run with what was chosen', () => {
    expect(run.gameState).toBe('menu')
    // What belongs to practice and the hoop, folded behind «Más opciones».
    click('options')
    click('difficulty:expert')
    click('sticks:11')
    click('hoopUp')
    expect(run.hoopAdjustment).toBeCloseTo(HOOP_ADJUST_STEP)
    click('play')
    expect([run.gameState, run.activeDifficulty, run.activeStickCount, run.seed]).toEqual(['countdown', 'expert', 11, 42])
    expect(ui.count.node.visible).toBe(true)
  })

  it('opens on the challenge: playing without touching anything hangs the sign with the mission, and the scoreboard keeps quiet about its own', () => {
    const challengeRun = new Run({ seeds: () => 42 })
    const other = new GameUi(challengeRun, { exit: nothing }, { parent: root, camera, headset: false })
    expect([challengeRun.gameState, challengeRun.gameMode, other.sign.node.visible]).toEqual(['menu', 'challenge', false])
    challengeRun.startGame()
    other.update(0.016)
    expect(other.sign.node.visible).toBe(true)
    expect(other.sign.panel.escritos.map((e) => e.texto)).toEqual(['Catch 13 sticks. Drop three and out'])
    expect(other.scoreboardState().onSign).toBe(true)
    challengeRun.tick(COUNTDOWN_SECONDS)
    challengeRun.catchStick(0.5)
    other.update(0.016)
    expect(other.sign.panel.escritos.map((e) => e.texto)).toEqual([`You have ${challengeRun.points}`, 'Lives ♥♥♥ · Sticks 12'])
    // Without a hall there are no thresholds: nothing to celebrate.
    expect(other.crossedThreshold).toBeNull()
    for (let i = 0; i < 3; i++) challengeRun.missStick()
    other.update(0.016)
    expect(challengeRun.gameState).toBe('finished')
    // With no earlier record, the first best is a record, and the sign says so.
    expect(other.sign.panel.escritos.map((e) => e.texto)).toEqual([`You scored ${challengeRun.points}`, 'First record!'])
    // At the end, repeat is in view and starts another challenge without going through the menu.
    expect(other.scoreboard.repeat.nodo.is_visible_in_tree()).toBe(true)
    challengeRun.startGame()
    expect([challengeRun.gameState, challengeRun.gameMode]).toEqual(['countdown', 'challenge'])
    other.release()
    other.root.get_parent()?.remove_child(other.root)
    other.root.free()
  })

  it('in practice, without a hall, there is no sign and the scoreboard goes whole', () => {
    click('play')
    run.tick(COUNTDOWN_SECONDS)
    ui.update(0.016)
    expect(ui.sign.node.visible).toBe(false)
    expect(ui.scoreboardState().onSign).toBe(false)
  })

  it('the mode cycles: practice, levels, challenge; the challenge is fixed', () => {
    click('mode')
    expect(run.gameMode).toBe('levels')
    click('mode')
    expect(run.gameMode).toBe('challenge')
    click('play')
    expect([run.activeDifficulty, run.activeStickCount, run.lives]).toEqual(['medium', MAX_STICKS, 3])
  })

  it('with two players: the challenge with the same sticks for both, the notice between rounds and who wins', () => {
    click('mode')
    click('mode')
    click('players')
    expect(run.players).toBe(2)
    click('play')
    expect(run.player).toBe(0)
    const seed = run.stickSeed
    run.tick(COUNTDOWN_SECONDS)
    for (let i = 0; i < MAX_STICKS; i++) run.catchStick(0.5)
    ui.update(0.016)
    expect(run.gameState).toBe('finished')
    // The notice to pass the controller, in front; the scoreboard, with its play button, below.
    expect(ui.duel.node.visible).toBe(true)
    expect(ui.duel.panel.escritos.map((e) => e.texto)).toContain('Pass the controller to Player 2.')
    click('again')
    expect([run.player, run.stickSeed]).toEqual([1, seed])
    expect(ui.duel.node.visible).toBe(false)
    run.tick(COUNTDOWN_SECONDS)
    for (let i = 0; i < 3; i++) run.missStick()
    ui.update(0.016)
    expect(ui.duel.panel.escritos[0].texto).toBe('Player 1 wins')
    expect(getDuelTally()).toEqual({ wins: [1, 0], ties: 0 })
    expect(run.bestPoints).toBe(0)
  })

  it('the arrow in the corner exits; Escape in the menu, too', () => {
    click('exit')
    expect(exits).toBe(1)
    ui.escape()
    expect(exits).toBe(2)
  })

  it('while playing, back asks; keep going plays again and leaving goes back to the menu', () => {
    click('play')
    run.tick(COUNTDOWN_SECONDS)
    ui.update(0.016)
    expect(ui.scoreboard.node.visible).toBe(true)
    click('quit')
    expect([run.prompt, ui.notice.node.visible]).toEqual(['quit', true])
    click('confirm:stay')
    expect(run.prompt).toBeNull()
    ui.escape()
    ui.update(0.016)
    click('confirm:leave')
    expect(run.gameState).toBe('menu')
    expect(ui.menu.node.is_visible_in_tree()).toBe(true)
  })

  it('the endless run is ended with its button; at the end, repeat and back to menu', () => {
    click('options')
    click('endless')
    click('play')
    run.tick(COUNTDOWN_SECONDS)
    ui.update(0.016)
    click('end-run')
    expect(run.gameState).toBe('finished')
    ui.update(0.016)
    click('again')
    expect([run.gameState, run.runId]).toEqual(['countdown', 2])
    run.tick(COUNTDOWN_SECONDS)
    run.endRun()
    ui.update(0.016)
    click('home')
    expect(run.gameState).toBe('menu')
  })
})
