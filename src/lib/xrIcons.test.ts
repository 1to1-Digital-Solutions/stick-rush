import { describe, expect, it } from 'vitest'
import {
  XR_EXIT_ICON,
  XR_HEART_ICON,
  XR_HOME_ICON,
  XR_MUTED_ICON,
  XR_SOUND_ICON,
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
function crossingsAtY(polygon: Polygon, y: number): number[] {
  return crossings(polygon, 1, y, 0)
}

/** Puntos donde la silueta corta una vertical, ordenados. */
function crossingsAtX(polygon: Polygon, x: number): number[] {
  return crossings(polygon, 0, x, 1)
}

function crossings(
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
function span(hits: number[]): number {
  return hits.length < 2 ? 0 : hits[hits.length - 1] - hits[0]
}

/** Punto dentro de la silueta, por lanzamiento de rayo. */
function contains(polygon: Polygon, [px, py]: IconPoint): boolean {
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
function segmentsCross(
  [ax, ay]: IconPoint,
  [bx, by]: IconPoint,
  [cx, cy]: IconPoint,
  [dx, dy]: IconPoint,
): boolean {
  const side = (
    px: number,
    py: number,
    qx: number,
    qy: number,
    rx: number,
    ry: number,
  ) => Math.sign((qx - px) * (ry - py) - (qy - py) * (rx - px))
  return (
    side(ax, ay, bx, by, cx, cy) !== side(ax, ay, bx, by, dx, dy) &&
    side(cx, cy, dx, dy, ax, ay) !== side(cx, cy, dx, dy, bx, by)
  )
}

function isSimple(polygon: Polygon): boolean {
  const n = polygon.length
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      // Los lados contiguos comparten un extremo: tocarse ahí es normal.
      if (j === (i + 1) % n || i === (j + 1) % n) continue
      const cross = segmentsCross(
        polygon[i],
        polygon[(i + 1) % n],
        polygon[j],
        polygon[(j + 1) % n],
      )
      if (cross) return false
    }
  }
  return true
}

/** Todos los contornos del icono, huecos incluidos. */
function paths(icon: IconShape): Polygon[] {
  return icon.flatMap((path) => [path.outline, ...(path.holes ?? [])])
}

/** Distancia de un punto a un centro. */
function radius([x, y]: IconPoint, [cx, cy]: IconPoint): number {
  return Math.hypot(x - cx, y - cy)
}

/** Extremos del icono a lo largo de un eje. */
function bounds(icon: IconShape, axis: 0 | 1): [number, number] {
  const values = paths(icon)
    .flat()
    .map((point) => point[axis])
  return [Math.min(...values), Math.max(...values)]
}

const ICONS: [string, IconShape][] = [
  ['casa', XR_HOME_ICON],
  ['salida', XR_EXIT_ICON],
  ['sonido', XR_SOUND_ICON],
  ['silencio', XR_MUTED_ICON],
  ['vida', XR_HEART_ICON],
]

describe('las siluetas están bien formadas', () => {
  for (const [name, icon] of ICONS) {
    it(`la ${name} cabe en el cuadro normalizado`, () => {
      for (const polygon of paths(icon)) {
        for (const [x, y] of polygon) {
          expect(Math.abs(x)).toBeLessThanOrEqual(1)
          expect(Math.abs(y)).toBeLessThanOrEqual(1)
        }
      }
    })

    it(`la ${name} aprovecha el cuadro entero`, () => {
      // Sin esto, dos iconos con el mismo `size` se verían de tamaños
      // distintos y la fila de botones parecería descuadrada.
      const [minX, maxX] = bounds(icon, 0)
      const [minY, maxY] = bounds(icon, 1)
      expect(maxX - minX).toBeGreaterThan(1.7)
      expect(maxY - minY).toBeGreaterThan(1.7)
    })

    it(`la ${name} va centrada en su cuadro`, () => {
      // El icono se coloca por su origen, así que si la silueta se descentra
      // dentro del cuadro el dibujo se va del centro de su placa. La holgura
      // deja pasar que la casa se apoye en el suelo del cuadro —el tejado da
      // más alto que el cuerpo— sin que se note dentro del botón.
      const [minX, maxX] = bounds(icon, 0)
      const [minY, maxY] = bounds(icon, 1)
      expect(Math.abs(minX + maxX) / 2).toBeLessThan(0.1)
      expect(Math.abs(minY + maxY) / 2).toBeLessThan(0.1)
    })

    it(`la ${name} no se cruza consigo misma`, () => {
      // Un contorno que se cruza triangula al revés y sale con huecos.
      for (const polygon of paths(icon)) {
        expect(isSimple(polygon)).toBe(true)
      }
    })
  }
})

describe('la casa se lee como una casa', () => {
  const [front] = XR_HOME_ICON
  const outline = front.outline
  const body = span(crossingsAtY(outline, -0.5))

  it('el tejado remata en punta sobre el cuerpo', () => {
    // Medido bajo la cima de la propia silueta, no a una altura fija: si el
    // tejado se aplana, el icono pasa a ser una caja cualquiera.
    const peak = Math.max(...outline.map(([, y]) => y))
    expect(span(crossingsAtY(outline, peak - 0.1))).toBeLessThan(body / 3)
  })

  it('el alero sobresale del cuerpo', () => {
    const eaves = Math.max(...outline.map(([x]) => Math.abs(x))) * 2
    expect(eaves).toBeGreaterThan(body)
  })

  it('la puerta se abre en la fachada, no fuera', () => {
    const [door] = front.holes ?? []
    expect(door).toBeDefined()
    for (const point of door) {
      expect(contains(outline, point)).toBe(true)
    }
    // Y abajo: una puerta a media altura es una ventana.
    expect(Math.max(...door.map(([, y]) => y))).toBeLessThan(0)
  })
})

describe('la salida se lee como una puerta con una flecha', () => {
  const [frame, arrow] = XR_EXIT_ICON

  it('el marco deja abierto el lado por el que se sale', () => {
    // Relleno sería un cartel: lo que lo convierte en puerta es el vano.
    expect(contains(frame.outline, [-0.85, 0])).toBe(true)
    expect(contains(frame.outline, [-0.2, 0])).toBe(false)
  })

  it('la flecha sale de la puerta, no entra', () => {
    const tip = arrow.outline.reduce((best, point) =>
      point[0] > best[0] ? point : best,
    )
    expect(tip[0]).toBeGreaterThan(Math.max(...frame.outline.map(([x]) => x)))
    expect(tip[1]).toBeCloseTo(0)
  })

  it('la punta es más ancha que el asta', () => {
    // El fallo del icono anterior: punta y asta se veían como dos piezas
    // sueltas. Si apenas se ensancha, la flecha se lee como una barra.
    const shaft = span(crossingsAtX(arrow.outline, 0))
    const head = span(crossingsAtX(arrow.outline, 0.43))
    expect(head).toBeGreaterThan(shaft * 2)
  })

  it('la flecha arranca despegada del marco', () => {
    // Pegadas, las dos piezas se funden en una sola mancha.
    const start = Math.min(...arrow.outline.map(([x]) => x))
    const jamb = Math.max(...crossingsAtY(frame.outline, 0))
    expect(start).toBeGreaterThan(jamb + 0.1)
  })
})

describe('la vida se lee como un corazón', () => {
  const [heart] = XR_HEART_ICON
  const outline = heart.outline

  it('tiene dos lóbulos separados arriba', () => {
    // Sin el entrante del centro queda un escudo, que no dice "vida". La
    // horizontal que pasa por encima del valle corta cuatro veces: entra y sale
    // de cada lóbulo.
    expect(crossingsAtY(outline, 0.6)).toHaveLength(4)
    expect(contains(outline, [0, 0.6])).toBe(false)
    expect(contains(outline, [-0.5, 0.6])).toBe(true)
    expect(contains(outline, [0.5, 0.6])).toBe(true)
  })

  it('acaba en punta abajo', () => {
    // El corazón se pinta a cuatro centímetros y tres seguidos: lo que
    // distingue la silueta de un círculo es la punta.
    const waist = span(crossingsAtY(outline, 0.2))
    expect(span(crossingsAtY(outline, -0.7))).toBeLessThan(waist / 4)
  })

  it('es macizo por dentro', () => {
    // Un corazón de contorno hueco se pierde a distancia; el del menú se
    // distingue del gastado por el color de su relleno, no por la silueta.
    expect(contains(outline, [0, 0])).toBe(true)
    expect(contains(outline, [0, 0.4])).toBe(true)
  })
})

/** Boca del altavoz: de ahí salen las ondas, y ahí está el foco de sus arcos. */
function speakerMouth(speaker: Polygon): IconPoint {
  return [Math.max(...speaker.map(([x]) => x)), 0]
}

describe('el sonido se lee como un altavoz sonando', () => {
  const [speaker, near, far] = XR_SOUND_ICON
  const focus = speakerMouth(speaker.outline)
  const [mouthX] = focus

  it('el cono se ensancha hacia donde sale el sonido', () => {
    // Sin cono es una caja, y una caja no es un altavoz.
    const back = span(crossingsAtX(speaker.outline, -0.9))
    const front = span(crossingsAtX(speaker.outline, mouthX - 0.05))
    expect(front).toBeGreaterThan(back * 2)
  })

  it('las ondas salen del altavoz sin pegarse a él', () => {
    for (const wave of [near, far]) {
      const start = Math.min(...wave.outline.map(([x]) => x))
      expect(start).toBeGreaterThan(mouthX + 0.1)
    }
  })

  it('una onda va por fuera de la otra, sin solaparse', () => {
    const inner = Math.max(...near.outline.map((point) => radius(point, focus)))
    const outer = Math.min(...far.outline.map((point) => radius(point, focus)))
    expect(inner).toBeLessThan(outer)
  })

  it('las ondas son arcos, no discos', () => {
    // Rellenas serían dos manchas alrededor del altavoz; lo que se lee como
    // sonido es el hueco entre ellas.
    for (const wave of [near, far]) {
      expect(contains(wave.outline, focus)).toBe(false)
      // Pero el trazo del arco sí tiene cuerpo: a media distancia entre sus
      // dos bordes hay silueta.
      const radii = wave.outline.map((point) => radius(point, focus))
      const middle = (Math.min(...radii) + Math.max(...radii)) / 2
      expect(contains(wave.outline, [focus[0] + middle, 0])).toBe(true)
    }
  })
})

describe('el silencio se lee como el mismo altavoz callado', () => {
  const [speaker, cross] = XR_MUTED_ICON
  const [mouthX] = speakerMouth(speaker.outline)
  const [minX, maxX] = bounds([cross], 0)
  const center: IconPoint = [(minX + maxX) / 2, 0]

  it('es el altavoz del icono de sonido, no otro dibujo', () => {
    // Los dos estados son el mismo control: si las siluetas del altavoz se
    // separan, al alternar el botón parece que cambia de función.
    expect(speaker.outline).toEqual(XR_SOUND_ICON[0].outline)
  })

  it('el aspa ocupa el sitio de las ondas y no cruza el altavoz', () => {
    // Tachar la silueta con una barra del mismo relleno no se ve como un
    // tachón: se ve como una mancha sola.
    expect(minX).toBeGreaterThan(mouthX + 0.1)
  })

  it('los cuatro brazos del aspa van en diagonal', () => {
    // Enderezada sería una cruz, que se lee como "añadir", no como "apagado".
    const arm = 0.3
    const diagonal = arm * Math.SQRT1_2
    for (const [dx, dy] of [
      [1, 1],
      [1, -1],
      [-1, 1],
      [-1, -1],
    ]) {
      expect(
        contains(cross.outline, [
          center[0] + dx * diagonal,
          center[1] + dy * diagonal,
        ]),
      ).toBe(true)
    }
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      expect(
        contains(cross.outline, [center[0] + dx * arm, center[1] + dy * arm]),
      ).toBe(false)
    }
  })
})
