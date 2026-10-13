/**
 * The world of Stick Rush in Godot against the web: the machine with the pieces `StickMachine.tsx`
 * counts, at the height of the hoop; the painted sticks where the round puts them, with the flash
 * of the catch and the tint of the miss; the fairground with the pieces of the kit where
 * `fairKit.ts` puts them, the crowd of `crowdLayout.ts` and the Ferris wheel; your room; the hints
 * with the script of the web; and what travels in the package, which is the web's byte for byte.
 *
 * It runs inside the engine, with the domain tests.
 */
import { Color, FileAccess, MeshInstance3D, Node3D, ProjectSettings, StandardMaterial3D, type MultiMeshInstance3D } from 'godot'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { SceneryRig, type RoomView } from '@kit/runtime/scene/scenery'
import { RealController } from '@kit/runtime/ui/controller'

import { crowdSpots } from '@/lib/crowdLayout'
import { PIECES, placements } from '@/lib/fairKit'
import { MACHINE_HEIGHT, MAX_STICKS, STICK_CAUGHT_COLOR, STICK_MISS_Y, WOOD_TEXTURES } from '@/lib/gameConfig'
import { HINT_SCRIPT, ghostFall, ghostStick } from '@/lib/hintScript'
import { WHEEL_CABIN_COUNT } from '@/lib/sceneryLayout'
import { STICK_BEHIND_MENU, stickCoversMenu } from '@/lib/xrLayout'
import { gameStorage } from '@/lib/storage'

import { Round } from '../game/round'
import { GameHints } from './hints'
import { Fairground } from './fairground'
import { ARC_SEGMENTS, Machine, TRUSS_POSTS, TUBE_RADIUS } from './machine'
import { PaintedSticks, texturePath } from './sticks'

const CONTROLLERS_DIR = 'res://games/stick-rush/mandos'
const profile = () => 'oculus-touch-v3'

describe('the machine', () => {
  let parent: Node3D
  beforeEach(() => {
    parent = new Node3D()
  })
  afterEach(() => parent.free())

  it('carries the pieces the web counts: the striped hoop, the two posts, the truss and the bulbs', () => {
    const machine = new Machine(parent)
    machine.place(MACHINE_HEIGHT)
    // Top ring, uprights, diagonals and the two braces (`limits.truss`).
    const truss = ARC_SEGMENTS + TRUSS_POSTS + (TRUSS_POSTS - 1) + 2
    expect(machine.pieces).toEqual({ matte: ARC_SEGMENTS, frame: 2, truss, bulbs: TRUSS_POSTS - 1 })
  })

  it('is rebuilt when the hoop changes height, and only then', () => {
    const machine = new Machine(parent)
    machine.place(MACHINE_HEIGHT)
    const before = machine.node.get_child(0)
    machine.place(MACHINE_HEIGHT)
    expect(machine.node.get_child(0)).toBe(before)
    machine.place(2.2)
    expect(machine.node.get_child(machine.node.get_child_count() - 1)).not.toBe(before)
  })
})

describe('the painted sticks', () => {
  let parent: Node3D
  beforeEach(() => {
    parent = new Node3D()
  })
  afterEach(() => parent.free())

  it('each stick of the round at its anchor, with its hook; the spare ones, out', () => {
    const sticks = new PaintedSticks(parent)
    const round = new Round('a', 5, 7, MACHINE_HEIGHT, false)
    sticks.paint(round)
    const groups: Node3D[] = []
    for (let i = 0; i < sticks.node.get_child_count(); i++) {
      const child = sticks.node.get_child(i) as Node3D
      if (String(child.get_name()).startsWith('Stick')) groups.push(child)
    }
    expect(groups.length).toBe(MAX_STICKS)
    expect(groups.filter((g) => g.visible).length).toBe(7)
    const [x, y, z] = round.sticks[3].layout.anchor
    const placement = groups[3].position
    expect([placement.x, placement.y, placement.z].map((v) => Number(v.toFixed(4)))).toEqual([x, y, z].map((v) => Number(v.toFixed(4))))
    // The body hangs one cord below: the centre of the stick, in the space of the group.
    expect(sticks.body(3).position.y).toBeCloseTo(-0.11 - 0.39 / 2)
    expect(TUBE_RADIUS).toBe(0.032)
  })

  it('the caught one turns green and grows; the missed one stays on the ground, red', () => {
    const sticks = new PaintedSticks(parent)
    const round = new Round('a', 5, 5, MACHINE_HEIGHT, false)
    round.catchStick(1, false)
    round.advance(0.2, { paused: true, speed: 1 })
    sticks.paint(round)
    const material = sticks.body(1).material_override as StandardMaterial3D
    const green = Color.html(STICK_CAUGHT_COLOR)
    expect([material.albedo_color.r, material.albedo_color.g].map((v) => Number(v.toFixed(3)))).toEqual([green.r, green.g].map((v) => Number(v.toFixed(3))))
    expect(material.emission_energy_multiplier).toBeGreaterThan(0)
    const group = sticks.body(1).get_parent() as Node3D
    expect(group.scale.x).toBeGreaterThan(1)
    // The missed one.
    const missed = new Round('b', 5, 5, MACHINE_HEIGHT, false)
    for (let i = 0; i < 72 * 30; i++) missed.advance(1 / 72, { paused: false, speed: 2.16 })
    sticks.paint(missed)
    const red = sticks.body(0).material_override as StandardMaterial3D
    expect(red.albedo_color.r).toBeGreaterThan(red.albedo_color.g * 3)
    expect((sticks.body(0).get_parent() as Node3D).position.y).toBeCloseTo(STICK_MISS_Y)
  })

  it('in the menu, the sticks in front of the column dim little by little and come back on playing', () => {
    const sticks = new PaintedSticks(parent)
    const round = new Round('a', 5, 13, MACHINE_HEIGHT, false)
    const covering = round.sticks.filter((stick) => stickCoversMenu(stick.layout.anchor)).map((stick) => stick.index)
    const alpha = (i: number) => (sticks.body(i).material_override as StandardMaterial3D).albedo_color.a
    const cord = (i: number) => (sticks.body(i).get_parent() as Node3D).get_child(0) as MeshInstance3D
    expect(covering.length).toBeGreaterThan(0)
    sticks.paint(round, 0.1, true)
    // Halfway: nothing that is seen changes brightness at once.
    expect(alpha(covering[0])).toBeLessThan(1)
    expect(alpha(covering[0])).toBeGreaterThan(STICK_BEHIND_MENU)
    for (let i = 0; i < 10; i++) sticks.paint(round, 0.1, true)
    expect(alpha(covering[0])).toBeCloseTo(STICK_BEHIND_MENU)
    expect(cord(covering[0]).visible).toBe(false)
    const inFront = round.sticks.find((stick) => !covering.includes(stick.index))!.index
    expect(alpha(inFront)).toBe(1)
    expect(cord(inFront).visible).toBe(true)
    for (let i = 0; i < 10; i++) sticks.paint(round, 0.1, false)
    expect(alpha(covering[0])).toBe(1)
    expect(cord(covering[0]).visible).toBe(true)
  })

  it('the wood carries the relief and the roughness of the web, without its colour', () => {
    const sticks = new PaintedSticks(parent)
    const material = sticks.body(0).material_override as StandardMaterial3D
    expect(material.normal_enabled).toBe(true)
    expect(material.normal_texture).not.toBe(null)
    expect(material.roughness_texture).not.toBe(null)
    expect(material.albedo_texture).toBe(null)
  })
})

describe('the fairground and your room', () => {
  let scene: Node3D
  let world: Node3D
  let fairground: Fairground
  let transparent: boolean[]
  let passthrough: boolean
  const view: RoomView = { hayPassthrough: () => passthrough, transparente: (on) => transparent.push(on) }

  beforeEach(() => {
    gameStorage()?.clear()
    scene = new Node3D()
    world = new Node3D()
    scene.add_child(world)
    fairground = new Fairground(scene, world)
    transparent = []
    passthrough = false
  })
  afterEach(() => scene.free())

  it('the three pieces of the kit where `placements()` puts them, the crowd and the Ferris wheel', () => {
    const all = placements()
    expect(fairground.counts).toEqual({
      pieces: Object.fromEntries(PIECES.map((p) => [p, all.filter((c) => c.piece === p).length])),
      silhouettes: crowdSpots().length,
      cabins: WHEEL_CABIN_COUNT,
    })
  })

  it('the colour of the pieces of the kit is that of their vertices', () => {
    const stall = fairground.venue.find_child('Pieces-puesto', true, false) as MultiMeshInstance3D
    expect((stall.material_override as StandardMaterial3D).vertex_color_use_as_albedo).toBe(true)
    expect(stall.multimesh!.instance_count).toBe(placements().filter((c) => c.piece === 'puesto').length)
  })

  it('with the streak the bulbs get brighter and the Ferris wheel turns', () => {
    const garlands = fairground.venue.find_child('Garlands', true, false) as MultiMeshInstance3D
    const material = garlands.material_override as StandardMaterial3D
    const before = material.albedo_color.r + material.albedo_color.g
    for (let i = 0; i < 120; i++) fairground.update(1 / 60, 12)
    expect(material.albedo_color.r + material.albedo_color.g).toBeGreaterThan(before)
    const wheel = fairground.venue.find_child('Wheel', true, false) as Node3D
    expect(wheel.rotation.z).toBeGreaterThan(0)
  })

  it('without augmented reality the square is seen even if the hall asks for the room; with it, the room', () => {
    gameStorage()?.setItem('xrcade:scenery', 'room')
    const scenery = new SceneryRig({ mostrar: (on) => fairground.inSquare(on), vista: view })
    scenery.actualizar()
    expect([fairground.venue.visible, transparent]).toEqual([true, [false]])
    passthrough = true
    scenery.releer()
    scenery.actualizar()
    expect([fairground.venue.visible, transparent]).toEqual([false, [false, true]])
    scenery.elegir('place')
    scenery.actualizar()
    expect(fairground.venue.visible).toBe(true)
  })
})

describe('the hints', () => {
  let machine: Node3D
  let controller: RealController
  let hints: GameHints
  beforeEach(() => {
    machine = new Node3D()
    controller = new RealController({ mano: 'right', dir: CONTROLLERS_DIR, perfil: profile })
    hints = new GameHints(machine, [controller])
  })
  afterEach(() => machine.free())

  const nothingDone = { grab: false, falling: false }

  it('without a headset none comes up', () => {
    for (let i = 0; i < 60; i++) hints.update(1 / 60, { showing: false, facts: nothingDone, hoop: MACHINE_HEIGHT, hand: 'right' })
    expect(hints.visible()).toEqual([])
  })

  it('with a headset the three of the script come up, and they go off with what is done', () => {
    for (let i = 0; i < 60; i++) hints.update(1 / 60, { showing: true, facts: nothingDone, hoop: MACHINE_HEIGHT, hand: 'right' })
    expect(hints.visible()).toEqual(HINT_SCRIPT.map((a) => a.id))
    for (let i = 0; i < 60; i++) hints.update(1 / 60, { showing: true, facts: { grab: false, falling: true }, hoop: MACHINE_HEIGHT, hand: 'right' })
    expect(hints.visible()).toEqual(['ground'])
    for (let i = 0; i < 60; i++) hints.update(1 / 60, { showing: true, facts: { grab: true, falling: true }, hoop: MACHINE_HEIGHT, hand: 'right' })
    expect(hints.visible()).toEqual([])
  })

  it('the ghost stick falls from the front stick like `ghostFall`', () => {
    let clock = 0
    for (let i = 0; i < 50; i++) {
      hints.update(1 / 60, { showing: true, facts: nothingDone, hoop: MACHINE_HEIGHT, hand: 'right' })
      clock += 1 / 60
    }
    const ghost = hints.node.find_child('GhostStick', true, false) as MeshInstance3D
    const [, y] = ghostStick(MACHINE_HEIGHT)
    const { drop } = ghostFall((clock % 2.4) / 2.4)
    expect(ghost.position.y).toBeCloseTo(y - drop, 3)
  })
})

describe('what travels in the package is the web\'s, byte for byte', () => {
  const fromRepo = (path: string) => FileAccess.get_file_as_bytes(`${ProjectSettings.globalize_path('res://')}../${path}`)
  const fromPackage = (path: string) => FileAccess.get_file_as_bytes(`res://games/stick-rush/${path}`)

  it.each([...PIECES])('the kit piece %s', (piece) => {
    const web = fromRepo(`public/models/kit/${piece}.glb`)
    expect(web.size()).toBeGreaterThan(0)
    expect(fromPackage(`feria/${piece}.glb`).hex_encode()).toBe(web.hex_encode())
  })

  it.each(Object.values(WOOD_TEXTURES))('the wood map %s', (path) => {
    const web = fromRepo(`public/${path}`)
    expect(web.size()).toBeGreaterThan(0)
    expect(FileAccess.get_file_as_bytes(texturePath(path)).hex_encode()).toBe(web.hex_encode())
  })

  it('the sky and the music', () => {
    for (const [packaged, web] of [
      ['hdri/plaza_pueblo_1k.exr', 'public/hdri/plaza_pueblo_1k.exr'],
      ['music/feria.mp3', 'public/audio/feria.mp3'],
    ]) {
      const bytes = fromRepo(web)
      expect(bytes.size(), web).toBeGreaterThan(0)
      expect(fromPackage(packaged).hex_encode(), web).toBe(bytes.hex_encode())
    }
  })

  it.each(['meta-quest-touch-plus', 'oculus-touch-v3'])('the controller %s, its two hands and its profile', (p) => {
    for (const f of ['profile.json', 'left.glb', 'right.glb']) {
      const web = fromRepo(`public/webxr-profiles/${p}/${f}`)
      expect(web.size(), f).toBeGreaterThan(0)
      expect(fromPackage(`mandos/${p}/${f}`).hex_encode(), f).toBe(web.hex_encode())
    }
  })
})
