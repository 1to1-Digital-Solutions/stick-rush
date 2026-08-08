import { describe, expect, it } from 'vitest'
import {
  XR_EXIT_ICON,
  XR_HOME_ICON,
  type IconPoint,
  type IconShape,
} from './xrIcons'

/**
 * Los iconos de la interfaz inmersiva son lo único que explica cada botón: sin
 * fuentes no hay etiqueta que valga, y un dibujo que no se entiende deja al
 * jugador atascado dentro del visor. Lo que se comprueba aquí es la forma —que
 * la casa tenga tejado, que la flecha tenga punta, que la puerta esté abierta—,
 * porque es exactamente lo que falló al probarlo con las gafas puestas.
 */

type Polygon = readonly IconPoint[]

/** Puntos donde la silueta corta una horizontal, ordenados. */
function cortesEnY(polygon: Polygon, y: number): number[] {
  return cortes(polygon, 1, y, 0)
}

/** Puntos donde la silueta corta una vertical, ordenados. */
function cortesEnX(polygon: Polygon, x: number): number[] {
  return cortes(polygon, 0, x, 1)
}

function cortes(
  polygon: Polygon,
  axis: 0 | 1,
  at: number,
  other: 0 | 1,
): number[] {
  const hits: number[] = []
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i]
    const b = polygon[(i + 1) % polygon.length]
    if (a[axis] === b[axis]) continue
    const t = (at - a[axis]) / (b[axis] - a[axis])
    if (t < 0 || t > 1) continue
    hits.push(a[other] + t * (b[other] - a[other]))
  }
  return hits.sort((p, q) => p - q)
}

/** Cuánto abarca la silueta a lo largo de una recta. */
function tramo(hits: number[]): number {
  return hits.length < 2 ? 0 : hits[hits.length - 1] - hits[0]
}

/** Punto dentro de la silueta, por lanzamiento de rayo. */
function dentro(polygon: Polygon, [px, py]: IconPoint): boolean {
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i]
    const [xj, yj] = polygon[j]
    const crosses =
      yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi
    if (crosses) inside = !inside
  }
  return inside
}

/** ¿Se cruzan dos segmentos? */
function seCruzan(
  [ax, ay]: IconPoint,
  [bx, by]: IconPoint,
  [cx, cy]: IconPoint,
  [dx, dy]: IconPoint,
): boolean {
  const lado = (
    px: number,
    py: number,
    qx: number,
    qy: number,
    rx: number,
    ry: number,
  ) => Math.sign((qx - px) * (ry - py) - (qy - py) * (rx - px))
  return (
    lado(ax, ay, bx, by, cx, cy) !== lado(ax, ay, bx, by, dx, dy) &&
    lado(cx, cy, dx, dy, ax, ay) !== lado(cx, cy, dx, dy, bx, by)
  )
}

function esSimple(polygon: Polygon): boolean {
  const n = polygon.length
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      // Los lados contiguos comparten un extremo: tocarse ahí es normal.
      if (j === (i + 1) % n || i === (j + 1) % n) continue
      const cruce = seCruzan(
        polygon[i],
        polygon[(i + 1) % n],
        polygon[j],
        polygon[(j + 1) % n],
      )
      if (cruce) return false
    }
  }
  return true
}

/** Todos los contornos del icono, huecos incluidos. */
function piezas(icon: IconShape): Polygon[] {
  return icon.flatMap((path) => [path.outline, ...(path.holes ?? [])])
}

const ICONOS: [string, IconShape][] = [
  ['casa', XR_HOME_ICON],
  ['salida', XR_EXIT_ICON],
]

describe('las siluetas están bien formadas', () => {
  for (const [nombre, icon] of ICONOS) {
    it(`la ${nombre} cabe en el cuadro normalizado`, () => {
      for (const polygon of piezas(icon)) {
        for (const [x, y] of polygon) {
          expect(Math.abs(x)).toBeLessThanOrEqual(1)
          expect(Math.abs(y)).toBeLessThanOrEqual(1)
        }
      }
    })

    it(`la ${nombre} aprovecha el cuadro entero`, () => {
      // Sin esto, dos iconos con el mismo `size` se verían de tamaños
      // distintos y la fila de botones parecería descuadrada.
      const puntos = piezas(icon).flat()
      const xs = puntos.map(([x]) => x)
      const ys = puntos.map(([, y]) => y)
      expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(1.7)
      expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThan(1.7)
    })

    it(`la ${nombre} no se cruza consigo misma`, () => {
      // Un contorno que se cruza triangula al revés y sale con huecos.
      for (const polygon of piezas(icon)) {
        expect(esSimple(polygon)).toBe(true)
      }
    })
  }
})

describe('la casa se lee como una casa', () => {
  const [fachada] = XR_HOME_ICON
  const silueta = fachada.outline
  const cuerpo = tramo(cortesEnY(silueta, -0.5))

  it('el tejado remata en punta sobre el cuerpo', () => {
    // Medido bajo la cima de la propia silueta, no a una altura fija: si el
    // tejado se aplana, el icono pasa a ser una caja cualquiera.
    const cima = Math.max(...silueta.map(([, y]) => y))
    expect(tramo(cortesEnY(silueta, cima - 0.1))).toBeLessThan(cuerpo / 3)
  })

  it('el alero sobresale del cuerpo', () => {
    const alero = Math.max(...silueta.map(([x]) => Math.abs(x))) * 2
    expect(alero).toBeGreaterThan(cuerpo)
  })

  it('la puerta se abre en la fachada, no fuera', () => {
    const [puerta] = fachada.holes ?? []
    expect(puerta).toBeDefined()
    for (const punto of puerta) {
      expect(dentro(silueta, punto)).toBe(true)
    }
    // Y abajo: una puerta a media altura es una ventana.
    expect(Math.max(...puerta.map(([, y]) => y))).toBeLessThan(0)
  })
})

describe('la salida se lee como una puerta con una flecha', () => {
  const [marco, flecha] = XR_EXIT_ICON

  it('el marco deja abierto el lado por el que se sale', () => {
    // Relleno sería un cartel: lo que lo convierte en puerta es el vano.
    expect(dentro(marco.outline, [-0.85, 0])).toBe(true)
    expect(dentro(marco.outline, [-0.2, 0])).toBe(false)
  })

  it('la flecha sale de la puerta, no entra', () => {
    const punta = flecha.outline.reduce((best, point) =>
      point[0] > best[0] ? point : best,
    )
    expect(punta[0]).toBeGreaterThan(Math.max(...marco.outline.map(([x]) => x)))
    expect(punta[1]).toBeCloseTo(0)
  })

  it('la punta es más ancha que el asta', () => {
    // El fallo del icono anterior: punta y asta se veían como dos piezas
    // sueltas. Si apenas se ensancha, la flecha se lee como una barra.
    const asta = tramo(cortesEnX(flecha.outline, 0))
    const punta = tramo(cortesEnX(flecha.outline, 0.43))
    expect(punta).toBeGreaterThan(asta * 2)
  })

  it('la flecha arranca despegada del marco', () => {
    // Pegadas, las dos piezas se funden en una sola mancha.
    const arranque = Math.min(...flecha.outline.map(([x]) => x))
    const jamba = Math.max(...cortesEnY(marco.outline, 0))
    expect(arranque).toBeGreaterThan(jamba + 0.1)
  })
})
