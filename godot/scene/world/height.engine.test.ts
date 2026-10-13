/**
 * La altura fina del salón (`xrcade:play-height-offset`) llega al decorado de este juego.
 *
 * La lee el jugador del kit del guardado del juego, sin que el port la pida: esto comprueba que
 * la clave que escribe el salón es la que lee este juego y que sube o baja su mundo, con los
 * ficheros comunes de este repo (`xrLayout.ts` como `uiHeight` y `hostAnchor.ts`).
 */
import { Engine, Node3D, SceneTree } from 'godot'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { IDENTIDAD, vec } from '@kit/lib/xr/pose'
import { aTransform } from '@kit/runtime/xr/pose-godot'
import { XRPlayer } from '@kit/runtime/xr/player'
import { simulateControllers, type Simulation } from '@kit/runtime/xr/simulated'

import { PLAY_HEIGHT_OFFSET_KEY } from '@/lib/settings'
import * as hostAnchor from '@/lib/hostAnchor'
import { gameStorage } from '@/lib/storage'
import * as xrLayout from '@/lib/xrLayout'

let raiz: Node3D
let sim: Simulation

/** El jugador como lo monta `main.ts`, de pie y con la cabeza a 1,70. */
function subidaDelMundo(): number {
  const jugador = new XRPlayer(raiz, { common: { uiHeight: xrLayout, hostAnchor }, anclaje: null })
  sim.cabeza(aTransform({ ...IDENTIDAD, origen: vec(0, 1.7, 0) }))
  jugador.update(1 / 72)
  expect(jugador.mundo.global_position.y).toBeCloseTo(jugador.subida, 6)
  return jugador.subida
}

describe('la altura fina del salón', () => {
  beforeEach(() => {
    gameStorage()?.clear()
    raiz = new Node3D()
    ;(Engine.get_main_loop() as SceneTree).root!.add_child(raiz)
    sim = simulateControllers()
  })

  afterEach(() => {
    sim.quitar()
    raiz.queue_free()
    gameStorage()?.clear()
  })

  it('sin la clave el mundo se queda donde está', () => {
    expect(subidaDelMundo()).toBeCloseTo(0, 6)
  })

  it('con −15 el mundo baja quince centímetros', () => {
    gameStorage()!.setItem(PLAY_HEIGHT_OFFSET_KEY, '-15')
    expect(subidaDelMundo()).toBeCloseTo(-0.15, 6)
  })
})
