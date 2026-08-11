import { describe, expect, it } from 'vitest'
import { GROUND_Y, MACHINE_HEIGHT } from './gameConfig'
import {
  GARLAND_BULBS_PER_SPAN,
  GARLAND_POST_COUNT,
  GARLAND_POST_HEIGHT,
  GARLAND_RING_RADIUS,
  SCENERY_CLEARANCE,
  STALL_RING_RADIUS,
  STALL_SIZE,
  WHEEL_CABIN_DROP,
  WHEEL_CENTER,
  WHEEL_RADIUS,
  facingRotationY,
  garlandBulbs,
  ringSlots,
  type Vec3,
} from './sceneryLayout'

/** Hacia dónde encara una pieza girada `rotationY`: su +Z local, en el mundo. */
function facingDirection(rotationY: number): [number, number] {
  return [Math.sin(rotationY), Math.cos(rotationY)]
}

describe('ringSlots', () => {
  it('planta todas las piezas a la distancia pedida', () => {
    for (const slot of ringSlots(6, 6.4)) {
      const [x, y, z] = slot.position
      expect(Math.hypot(x, z)).toBeCloseTo(6.4, 6)
      expect(y).toBe(GROUND_Y)
    }
  })

  it('las reparte a intervalos iguales', () => {
    const angles = ringSlots(8, 3)
      .map(({ position: [x, , z] }) => Math.atan2(x, z))
      // atan2 salta de +π a −π a mitad de vuelta: se normaliza a [0, 2π).
      .map((angle) => (angle + Math.PI * 2) % (Math.PI * 2))
      .sort((a, b) => a - b)

    const gaps = angles.slice(1).map((angle, i) => angle - angles[i])
    for (const gap of gaps) {
      expect(gap).toBeCloseTo((Math.PI * 2) / 8, 6)
    }
  })

  it('deja cada pieza mirando al jugador y no de espaldas', () => {
    for (const slot of ringSlots(5, 6.4, 0.3)) {
      const [fx, fz] = facingDirection(slot.rotationY)
      const [x, , z] = slot.position
      const distance = Math.hypot(x, z)
      // El frente de la pieza y la dirección hacia el centro son el mismo
      // vector: su producto escalar vale 1.
      expect(fx * (-x / distance) + fz * (-z / distance)).toBeCloseTo(1, 6)
    }
  })

  it('no se rompe con un anillo vacío', () => {
    expect(ringSlots(0, 5)).toEqual([])
  })

  it('es puro: dos llamadas iguales dan el mismo anillo', () => {
    expect(ringSlots(6, 6.4, 0.2)).toEqual(ringSlots(6, 6.4, 0.2))
  })
})

describe('facingRotationY', () => {
  it('gira media vuelta lo que está justo delante del jugador', () => {
    // Delante es −Z; encararle desde ahí es mirar hacia +Z, o sea sin giro.
    const [fx, fz] = facingDirection(facingRotationY([0, 0, -5]))
    expect(fx).toBeCloseTo(0, 6)
    expect(fz).toBeCloseTo(1, 6)
  })
})

describe('recinto', () => {
  it('deja libre el espacio de juego alrededor del jugador', () => {
    // La pieza más cercana al centro es la esquina delantera de la caseta.
    const halfDiagonal = Math.hypot(STALL_SIZE.width / 2, STALL_SIZE.depth / 2)
    expect(STALL_RING_RADIUS - halfDiagonal).toBeGreaterThanOrEqual(
      SCENERY_CLEARANCE,
    )
    expect(GARLAND_RING_RADIUS).toBeGreaterThanOrEqual(SCENERY_CLEARANCE)
  })

  it('no mete las casetas dentro de la noria', () => {
    const [x, , z] = WHEEL_CENTER
    expect(Math.hypot(x, z) - WHEEL_RADIUS).toBeGreaterThan(STALL_RING_RADIUS)
  })

  it('deja girar la noria sin arrastrar las cabinas por el suelo', () => {
    // La cabina más baja es la del punto inferior del aro, con todo su vuelo.
    expect(
      WHEEL_CENTER[1] - WHEEL_RADIUS - WHEEL_CABIN_DROP,
    ).toBeGreaterThan(GROUND_Y)
  })

  it('asoma la noria por encima de las casetas', () => {
    expect(WHEEL_CENTER[1] + WHEEL_RADIUS).toBeGreaterThan(STALL_SIZE.height * 2)
  })

  it('cuelga las guirnaldas por dentro del anillo de casetas', () => {
    expect(GARLAND_RING_RADIUS).toBeLessThan(STALL_RING_RADIUS)
  })
})

describe('garlandBulbs', () => {
  const spans = ringSlots(GARLAND_POST_COUNT, GARLAND_RING_RADIUS).map(
    (slot, index, slots): [Vec3, Vec3] => {
      const next = slots[(index + 1) % slots.length]
      const top = (slot: { position: Vec3 }): Vec3 => [
        slot.position[0],
        GARLAND_POST_HEIGHT,
        slot.position[2],
      ]
      return [top(slot), top(next)]
    },
  )

  it('cuelga una bombilla por hueco, sin ponerlas sobre los postes', () => {
    const bulbs = garlandBulbs({ from: [0, 3, 0], to: [4, 3, 0], count: 3 })
    expect(bulbs).toHaveLength(3)
    expect(bulbs.map(([x]) => x)).toEqual([1, 2, 3])
  })

  it('hunde el tramo por el centro, no lo deja tirante', () => {
    const bulbs = garlandBulbs({ from: [0, 3, 0], to: [4, 3, 0], count: 3, sag: 0.5 })
    const heights = bulbs.map(([, y]) => y)
    expect(heights[1]).toBeCloseTo(3 - 0.5, 6)
    // Simétrico: las dos puntas cuelgan igual y por encima del centro.
    expect(heights[0]).toBeCloseTo(heights[2], 6)
    expect(heights[0]).toBeGreaterThan(heights[1])
  })

  it('sigue el desnivel entre dos postes de distinta altura', () => {
    const bulbs = garlandBulbs({ from: [0, 2, 0], to: [4, 4, 0], count: 3, sag: 0 })
    expect(bulbs.map(([, y]) => y)).toEqual([2.5, 3, 3.5])
  })

  it('mantiene las bombillas por encima de la máquina', () => {
    // Si un tramo cuelga hasta la altura del aro, el jugador se encuentra
    // bombillas justo donde busca palos.
    for (const [from, to] of spans) {
      for (const [, y] of garlandBulbs({ from, to })) {
        expect(y).toBeGreaterThan(MACHINE_HEIGHT)
      }
    }
  })

  it('tiende una guirnalda entre cada dos postes, cerrando el círculo', () => {
    expect(spans).toHaveLength(GARLAND_POST_COUNT)
    const bulbs = spans.flatMap(([from, to]) => garlandBulbs({ from, to }))
    expect(bulbs).toHaveLength(GARLAND_POST_COUNT * GARLAND_BULBS_PER_SPAN)
    // Ninguna se sale del recinto ni se cuela dentro de él: van por la cuerda,
    // que va de poste a poste.
    for (const [x, , z] of bulbs) {
      expect(Math.hypot(x, z)).toBeLessThanOrEqual(GARLAND_RING_RADIUS + 1e-9)
      expect(Math.hypot(x, z)).toBeGreaterThan(SCENERY_CLEARANCE * 0.9)
    }
  })

  it('no se rompe con un tramo sin bombillas', () => {
    expect(garlandBulbs({ from: [0, 3, 0], to: [1, 3, 0], count: 0 })).toEqual([])
  })
})
