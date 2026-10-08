import { describe, expect, it } from 'vitest'
import { CylinderGeometry, Euler, Vector3 } from 'three'
import {
  XR_CHECK_ICON,
  XR_HEART_ICON,
  XR_HOME_ICON,
  XR_MUTED_ICON,
  XR_SOUND_ICON,
  XR_TRIANGLE_CENTER,
  XR_TRIANGLE_ROTATION,
  sceneMountains,
  type IconPoint,
  type IconShape,
  type TriangleTip,
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
  ['sonido', XR_SOUND_ICON],
  ['silencio', XR_MUTED_ICON],
  ['vida', XR_HEART_ICON],
  ['confirmación', XR_CHECK_ICON],
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

describe('la confirmación se lee como una marca de verificación', () => {
  const [check] = XR_CHECK_ICON
  const outline = check.outline
  const elbow = outline.reduce((best, point) => (point[1] < best[1] ? point : best))

  it('el codo cae abajo y a la izquierda', () => {
    // Con el vértice centrado sería una V, que no dice "hecho".
    expect(elbow[0]).toBeLessThan(0)
    expect(elbow[1]).toBeCloseTo(-1)
  })

  it('un brazo es mucho más largo que el otro', () => {
    const tip = outline.reduce((best, point) => (point[0] > best[0] ? point : best))
    const start = outline.reduce((best, point) => (point[0] < best[0] ? point : best))
    const long = Math.hypot(tip[0] - elbow[0], tip[1] - elbow[1])
    const short = Math.hypot(start[0] - elbow[0], start[1] - elbow[1])
    expect(long).toBeGreaterThan(short * 1.5)
  })

  it('es un trazo con hueco, no una cuña rellena', () => {
    // Lo que se lee a un metro es la línea quebrada; rellena por dentro sería
    // una mancha triangular, indistinguible del avión de al lado.
    expect(contains(outline, [0, 0.4])).toBe(false)
    // Pero el trazo tiene cuerpo: sobre la línea del brazo corto hay silueta.
    expect(contains(outline, [-0.8, 0.15])).toBe(true)
  })
})

/**
 * Los triángulos no son siluetas: se pintan con un prisma de tres lados y lo
 * único que hay que acertar es el giro. Se comprueba aquí porque a ojo una
 * composición mala no se distingue de la buena en el código —y en el visor sí:
 * el botón de empezar enseñaba el canto del prisma, un centímetro de grosor en
 * lugar del símbolo de reproducir—.
 */
describe('los triángulos encaran al jugador', () => {
  const TIPS: TriangleTip[] = ['up', 'down', 'right']

  /** Hacia dónde tiene que caer la punta de cada uno. */
  const TIP_DIRECTION: Record<TriangleTip, Vector3> = {
    up: new Vector3(0, 1, 0),
    down: new Vector3(0, -1, 0),
    right: new Vector3(1, 0, 0),
  }

  /** Esquinas del prisma tal como lo genera three, de radio 1. */
  function prismCorners(): Vector3[] {
    const geometry = new CylinderGeometry(1, 1, 0.2, 3)
    const position = geometry.attributes.position
    const point = new Vector3()
    const unique = new Map<string, Vector3>()

    for (let i = 0; i < position.count; i++) {
      point.fromBufferAttribute(position, i)
      // El centro de cada tapa cae sobre el eje y no es una esquina.
      if (Math.hypot(point.x, point.z) < 0.5) continue
      // La vuelta se cierra repitiendo el primer vértice con un pelo de error
      // de coma flotante, así que se redondea antes de contarlo como distinto.
      const key = [point.x, point.y, point.z]
        .map((n) => (Math.abs(n) < 1e-6 ? 0 : n).toFixed(3))
        .join(':')
      unique.set(key, point.clone())
    }
    return [...unique.values()]
  }

  /**
   * Las tres esquinas del dibujo que ve el jugador, en unidades de `size`: una
   * sola cara del prisma, ya girada y recolocada por su centro.
   */
  function triangleCorners(tip: TriangleTip): Vector3[] {
    const rotation = new Euler(...XR_TRIANGLE_ROTATION[tip])
    const [cx, cy] = XR_TRIANGLE_CENTER[tip]
    return prismCorners()
      .filter((corner) => corner.y > 0)
      .map((corner) => corner.applyEuler(rotation).sub(new Vector3(cx, cy, 0)))
  }

  it('el prisma de three nace en vertical y con un vértice al frente', () => {
    // Es la convención de la que cuelga todo lo demás: si three cambiara por
    // dónde empieza a repartir los vértices, los giros de aquí llevarían la
    // punta a otro sitio sin que nada más se enterase.
    const corners = prismCorners()
    expect(corners).toHaveLength(6)

    const front = corners.filter((corner) => corner.z > 0.99)
    expect(front).toHaveLength(2)
    for (const corner of front) expect(corner.x).toBeCloseTo(0)
  })

  it.each(TIPS)('«%s» deja el grosor hacia el jugador, no de canto', (tip) => {
    // El eje del prisma es su grosor: mirando al jugador, el dibujo se ve
    // entero; apuntando a un lado, se ve la lasca de un centímetro que tenía el
    // botón de empezar.
    const axis = new Vector3(0, 1, 0).applyEuler(
      new Euler(...XR_TRIANGLE_ROTATION[tip]),
    )
    expect(Math.abs(axis.z)).toBeCloseTo(1)

    // Y el dibujo ocupa de verdad las dos direcciones que se ven.
    const corners = triangleCorners(tip)
    for (const axisName of ['x', 'y'] as const) {
      const values = corners.map((corner) => corner[axisName])
      expect(Math.max(...values) - Math.min(...values)).toBeGreaterThan(1)
    }
  })

  it.each(TIPS)('«%s» apunta hacia donde dice su nombre', (tip) => {
    const forward = TIP_DIRECTION[tip]
    const across = new Vector3(-forward.y, forward.x, 0)
    const corners = triangleCorners(tip)

    // Una sola esquina se adelanta: esa es la punta, y cae sobre el eje.
    const ahead = corners.filter((corner) => corner.dot(forward) > 0)
    expect(ahead).toHaveLength(1)
    expect(ahead[0].dot(across)).toBeCloseTo(0)

    // Las otras dos forman el lado plano, simétrico respecto de ese mismo eje.
    const behind = corners.filter((corner) => corner.dot(forward) < 0)
    expect(behind).toHaveLength(2)
    expect(behind[0].dot(across) + behind[1].dot(across)).toBeCloseTo(0)
  })

  it.each(TIPS)('«%s» queda centrado en su placa', (tip) => {
    // A igual `position`, un triángulo y una silueta tienen que caer en el
    // mismo sitio del botón: sin recolocarlo, el dibujo se corre hacia la punta
    // un cuarto de su medida.
    const corners = triangleCorners(tip)
    for (const axis of ['x', 'y'] as const) {
      const values = corners.map((corner) => corner[axis])
      expect((Math.min(...values) + Math.max(...values)) / 2).toBeCloseTo(0)
    }
  })
})

/**
 * El icono de escenario tuvo el fallo de manual: las dos montañas con el vértice hacia
 * abajo, o sea dos cuñas invertidas y una luna. Se comprueba contra la geometría real de
 * three porque a ojo, en el código, una punta arriba y una punta abajo se escriben igual.
 */
describe('las montañas del icono de escenario', () => {
  const SIZE = 0.04

  /** Las tres esquinas de una montaña ya girada y colocada, en el plano del jugador. */
  function corners(m: { radio: number; x: number; y: number }): Vector3[] {
    const rotation = new Euler(...XR_TRIANGLE_ROTATION.up)
    const geometry = new CylinderGeometry(m.radio, m.radio, 0.01, 3)
    const position = geometry.attributes.position
    const point = new Vector3()
    const unique = new Map<string, Vector3>()
    for (let i = 0; i < position.count; i++) {
      point.fromBufferAttribute(position, i)
      if (Math.hypot(point.x, point.z) < m.radio * 0.5) continue
      if (point.y < 0) continue
      const girado = point.clone().applyEuler(rotation)
      // El cero con signo cuenta como otra esquina si no se normaliza, igual que arriba.
      const key = [girado.x, girado.y]
        .map((n) => (Math.abs(n) < 1e-6 ? 0 : n).toFixed(4))
        .join(':')
      unique.set(key, girado.add(new Vector3(m.x, m.y, 0)))
    }
    return [...unique.values()]
  }

  it('apuntan hacia arriba, no hacia abajo', () => {
    for (const m of sceneMountains(SIZE)) {
      const ys = corners(m).map((c) => c.y)
      const cima = Math.max(...ys)
      const base = Math.min(...ys)
      // Una montaña tiene UN vértice arriba y DOS abajo. Del revés es justo al contrario,
      // y esa cuenta es la que distingue las dos formas.
      const arriba = ys.filter((y) => y > (cima + base) / 2)
      expect(arriba).toHaveLength(1)
    }
  })

  it('se apoyan en el mismo suelo', () => {
    // Con radios distintos, centrarlas a la misma altura las deja a alturas distintas: una
    // montaña flotando sobre la otra es medio paisaje.
    const bases = sceneMountains(SIZE).map((m) => Math.min(...corners(m).map((c) => c.y)))
    for (const base of bases) expect(base).toBeCloseTo(bases[0], 6)
  })

  it('la luna queda por encima de las dos cimas', () => {
    // Si no, no es una luna: es una piedra encajada en la ladera.
    const LUNA_Y = SIZE * 0.85 - SIZE * 0.2
    for (const m of sceneMountains(SIZE)) {
      const cima = Math.max(...corners(m).map((c) => c.y))
      expect(LUNA_Y).toBeGreaterThan(cima)
    }
  })
})
