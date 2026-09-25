// @vitest-environment node
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import {
  ALTURAS,
  BANDEROLA_EN_LA_FAROLA,
  GIRO_DEL_MODELO,
  PIEZAS,
  anclaEnLaBase,
  colocaciones,
  escalaPara,
  rutaDePieza,
  type Caja,
  type Pieza,
} from './feriaKit'
import { GROUND_Y, MACHINE_HEIGHT } from './gameConfig'
import {
  GARLAND_POST_COUNT,
  GARLAND_POST_HEIGHT,
  GARLAND_RING_RADIUS,
  SCENERY_CLEARANCE,
  STALL_COUNT,
  STALL_RING_RADIUS,
  facingRotationY,
} from './sceneryLayout'

/**
 * Las piezas del kit en el recinto: que los modelos sean lo que se cree que son, y que
 * colocados a su tamaño ninguno entre en el hueco del jugador.
 *
 * Las medidas salen de los `.glb` de verdad, leídos de su cabecera: si el kit rehace una pieza
 * más ancha, esto salta antes de que un puesto se meta donde el jugador mueve los brazos.
 */

const PUBLIC = join(import.meta.dirname, '../../public')

/** La caja de los vértices de la única malla de un `.glb`, leída de su cabecera JSON. */
function cajaDe(pieza: Pieza): Caja {
  const glb = readFileSync(join(PUBLIC, rutaDePieza(pieza)))
  const largo = glb.readUInt32LE(12)
  const gltf = JSON.parse(glb.subarray(20, 20 + largo).toString('utf8')) as {
    meshes: { primitives: { attributes: { POSITION: number } }[] }[]
    accessors: Caja[]
  }
  expect(gltf.meshes, `${pieza} trae más de una malla`).toHaveLength(1)
  expect(gltf.meshes[0].primitives, `${pieza} trae más de una primitiva`).toHaveLength(1)
  return gltf.accessors[gltf.meshes[0].primitives[0].attributes.POSITION]
}

/** Lo que se aleja la pieza de su punto de apoyo, a su tamaño en el recinto y vista desde arriba. */
function vueloDe(pieza: Pieza): number {
  const { min, max } = cajaDe(pieza)
  const escala = escalaPara(ALTURAS[pieza], max[1] - min[1])
  return (Math.hypot(max[0] - min[0], max[2] - min[2]) / 2) * escala
}

/** Hacia dónde encara el +Z local de una pieza girada `giro`, en el mundo. */
function frente(giro: number): [number, number] {
  return [Math.sin(giro), Math.cos(giro)]
}

describe('las piezas del kit', () => {
  it.each(PIEZAS)('%s está en public/ y es una sola malla', (pieza) => {
    expect(existsSync(join(PUBLIC, rutaDePieza(pieza)))).toBe(true)
    const { min, max } = cajaDe(pieza)
    expect(max[1] - min[1]).toBeGreaterThan(0)
  })

  it('la banderola es una tela: fina en X y ancha en Z, que es lo que gira su cuarto de vuelta', () => {
    const { min, max } = cajaDe('banderola')
    expect(max[0] - min[0]).toBeLessThan((max[2] - min[2]) / 4)
  })
})

describe('el recinto', () => {
  const todas = colocaciones()
  const de = (pieza: Pieza) => todas.filter((c) => c.pieza === pieza)

  it('pone un puesto por caseta, y una farola y una banderola por poste', () => {
    expect(de('puesto')).toHaveLength(STALL_COUNT)
    expect(de('farol')).toHaveLength(GARLAND_POST_COUNT)
    expect(de('banderola')).toHaveLength(GARLAND_POST_COUNT)
    for (const { pieza, altura } of todas) expect(altura).toBe(ALTURAS[pieza])
  })

  it('planta los puestos en su anillo y las farolas en el de las guirnaldas', () => {
    for (const { posicion: [x, y, z] } of de('puesto')) {
      expect(Math.hypot(x, z)).toBeCloseTo(STALL_RING_RADIUS, 6)
      expect(y).toBe(GROUND_Y)
    }
    for (const { posicion: [x, y, z] } of de('farol')) {
      expect(Math.hypot(x, z)).toBeCloseTo(GARLAND_RING_RADIUS, 6)
      expect(y).toBe(GROUND_Y)
    }
  })

  it('la farola llega justo a donde se cuelgan las guirnaldas', () => {
    expect(ALTURAS.farol).toBe(GARLAND_POST_HEIGHT)
  })

  it('ningún puesto ni farola entra en el hueco del jugador', () => {
    for (const { pieza, posicion: [x, , z] } of todas) {
      expect(Math.hypot(x, z) - vueloDe(pieza), pieza).toBeGreaterThanOrEqual(
        SCENERY_CLEARANCE,
      )
    }
  })

  it('cada pieza mira al jugador, con el giro propio de su modelo', () => {
    for (const { pieza, posicion, giro } of todas) {
      const [fx, fz] = frente(giro - GIRO_DEL_MODELO[pieza])
      const [ex, ez] = frente(facingRotationY(posicion))
      expect(fx * ex + fz * ez, pieza).toBeCloseTo(1, 6)
    }
  })

  it('cuelga cada banderola de su farola, por delante y por encima de la máquina', () => {
    const faroles = de('farol')
    de('banderola').forEach(({ posicion: [x, y, z] }, indice) => {
      const [fx, , fz] = faroles[indice].posicion
      // Por delante: entre la farola y el centro, lo que se adelanta.
      expect(Math.hypot(fx, fz) - Math.hypot(x, z)).toBeCloseTo(BANDEROLA_EN_LA_FAROLA.adelanto, 6)
      expect(Math.atan2(x, z)).toBeCloseTo(Math.atan2(fx, fz), 6)
      // Por encima de la máquina y por debajo de la punta, de donde salen las guirnaldas.
      expect(y).toBeGreaterThan(MACHINE_HEIGHT)
      expect(y + ALTURAS.banderola).toBeLessThan(GARLAND_POST_HEIGHT)
    })
  })
})

describe('escalaPara', () => {
  it('lleva la caja del modelo a la altura pedida', () => {
    expect(escalaPara(2.8, 1.4)).toBeCloseTo(2)
    expect(escalaPara(0.5, 0.25)).toBeCloseTo(2)
  })
})

describe('anclaEnLaBase', () => {
  it('lleva el centro de la base de la caja al origen', () => {
    expect(anclaEnLaBase({ min: [0.375, 0.16, -0.25], max: [0.425, 1, 0.25] })).toEqual([
      -0.4, -0.16, -0,
    ])
    expect(anclaEnLaBase({ min: [-0.5, 0, -0.5], max: [0.5, 1, 0.5] })).toEqual([-0, -0, -0])
  })
})
