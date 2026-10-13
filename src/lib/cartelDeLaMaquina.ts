/**
 * El cartel del objetivo en este juego: dónde se lee y qué partida le cuenta.
 *
 * El cartel es común a todos los juegos del salón (`objetivo.ts` y `CartelDeObjetivo.tsx`); lo
 * que es de Stick Rush está aquí: que va **de frente y bajo la máquina**, encima del marcador
 * (`XR_CARTEL_POSITION`), y que la partida que cuenta es el reto —los trece palos a velocidad
 * media, con tres vidas—.
 *
 * Sin three ni React: la escena coloca lo que sale de aquí y los tests lo miden.
 */

import { AHORA_CUENTA, CALENTAMIENTO } from './calentamiento'
import { PLAYER_COUNT_LABELS } from './duel'
import { CHALLENGE_LIVES, CHALLENGE_SETUP, GAME_MODE_LABELS, type GameMode } from './gameMode'
import { REFERENCE_EYE_HEIGHT } from './hoopHeight'
import { MEDALS, countsForMedal, type Medal, type Goal, type Run, type Translate } from './goal'
import { plural } from './menuWords'
import { stickPoints } from './scoring'
import { distanceFromEyes, eyesAt, pointOnPanel, tiltTowardEyes, type PanelPose, type Point } from './panelReading'
import { pulsesFor, type HandSide, type HandPulse, type HapticEvent } from './hapticFeedback'
import { XR_CARTEL_POSITION, type Vec3 } from './xrLayout'

/** El modo del que salen el récord de la cabina y las medallas del salón. */
export const MODO_DE_LAS_MEDALLAS: GameMode = 'challenge'

/**
 * Lo que se aparta de la mirada al frente algo que todavía se lee **sin girar la cabeza**, en
 * grados: bajando o subiendo los ojos se llega cómodo hasta ahí, y el visor enseña bastante más
 * (unos 48° hacia abajo). A CALIBRAR CON EL VISOR.
 */
export const VISTA_SIN_GIRAR = 35

/** Lo que mide el cartel por cada metro de distancia de lectura: su ancho y su alto. */
export interface ProporcionDelCartel {
  readonly width: number
  readonly height: number
}

/** Dónde queda el cartel y cómo se orienta. */
export interface SitioDelCartel {
  /** Su centro, en el espacio de la interfaz (`−Z` es hacia donde se mira). */
  readonly position: Vec3
  /** Como el `rotation` de three: inclinado hacia los ojos, para leerse de frente. */
  readonly rotation: readonly [number, number, number]
  /** De los ojos al centro del cartel, en metros: de ahí sale su tamaño. */
  readonly distancia: number
}

/**
 * Dónde va el cartel: en `XR_CARTEL_POSITION`, de cara a los ojos de quien juega.
 *
 * Se coloca para la persona de referencia y sube o baja con el resto de la interfaz
 * (`xrUiRise`), así que respecto de los ojos queda siempre igual.
 */
export function sitioDelCartel(ojos: number = REFERENCE_EYE_HEIGHT): SitioDelCartel {
  const desde = eyesAt(ojos)
  return {
    position: XR_CARTEL_POSITION,
    rotation: [tiltTowardEyes(XR_CARTEL_POSITION, desde), 0, 0],
    distancia: distanceFromEyes(XR_CARTEL_POSITION, desde),
  }
}

/** El cartel como panel, para medir lo que ocupa en el ojo lo que lleva escrito (`panelReading.ts`). */
export function poseDelCartel(sitio: SitioDelCartel = sitioDelCartel()): PanelPose {
  return { position: sitio.position, rotation: sitio.rotation }
}

/** Las cuatro esquinas del cartel ya colocado, en el espacio de quien juega. */
export function esquinasDelCartel(proporcion: ProporcionDelCartel, sitio: SitioDelCartel = sitioDelCartel()): Point[] {
  const pose = poseDelCartel(sitio)
  const ancho = proporcion.width * sitio.distancia
  const alto = proporcion.height * sitio.distancia
  return [-1, 1].flatMap((x) => [-1, 1].map((y) => pointOnPanel(pose, (x * ancho) / 2, (y * alto) / 2)))
}

/** Cuántos grados se aparta ese punto de la mirada al frente (horizontal, hacia `−Z`). */
export function apartadoDeLaMirada(punto: Point, ojos: number = REFERENCE_EYE_HEIGHT): number {
  const hacia = { x: punto.x, y: punto.y - ojos, z: punto.z }
  return (Math.acos(-hacia.z / Math.hypot(hacia.x, hacia.y, hacia.z)) * 180) / Math.PI
}

/**
 * La misión del reto en una frase. Los palos salen de las reglas; las vidas van escritas, y un
 * test avisa si dejan de ser tres.
 *
 * **Corta a propósito**: el cartel escribe una sola línea y la encoge hasta que cabe. «Atrapa los
 * 13 palos. Tres al suelo y se acaba» salía a 0,82° y su versión inglesa a 0,69°, por debajo de lo
 * que se lee; así queda en un grado, como los tres listones de debajo
 * (`cartelDeLaMaquina.legible.test.ts`).
 */
export const MISION_DEL_RETO = 'Catch {sticks} sticks. Drop three and out'

/** Lo que queda, como se escribe en el cartel: «Lives ♥♥♡ · Sticks 9». */
export function loQueQueda(vidas: number, palos: number, t: Translate): string {
  const gastadas = Math.max(0, CHALLENGE_LIVES - vidas)
  return `${t('Lives')} ${'♥'.repeat(CHALLENGE_LIVES - gastadas)}${'♡'.repeat(gastadas)} · ${t('Sticks')} ${palos}`
}

/**
 * Lo que da un palo atrapado en el reto sin racha ni reflejos: lo menos que vale un palo. Es la
 * vara con la que se cuentan en palos los puntos de un listón.
 */
export const PUNTOS_DE_UN_PALO = stickPoints({ difficulty: CHALLENGE_SETUP.difficulty, streak: 1, fallProgress: 1 })

/** Cuántos palos hay que atrapar, como mucho, para llegar a esos puntos: el bronce 1900 son 13. */
export function palosPara(puntos: number): number {
  return Math.ceil(puntos / PUNTOS_DE_UN_PALO)
}

/**
 * Los puntos de un listón dichos en palos, ya traducidos: `1900` → «≈ 13 palos». Es el `contable`
 * del cartel: la misión cuenta palos y el récord, puntos, y quien empieza no sabe cuánto es 1900.
 */
export function enPalos(t: Translate): (puntos: number) => string {
  return (puntos) => {
    const n = palosPara(puntos)
    return t(plural(n, '≈ {n} stick', '≈ {n} sticks'), { n })
  }
}

/** Lo que el cartel necesita saber de lo que se está jugando. */
export interface LoQueSeJuega {
  /** Lo que pasó el salón, si lo pasó. */
  objetivo?: Goal | null
  gameMode: GameMode
  /** Si se juega a dos pasándose el mando: una tanda a dos no es la marca de nadie. */
  aDos: boolean
  gameState: 'menu' | 'countdown' | 'playing' | 'finished'
  points: number
  /** Las vidas que quedan, o `null` en un modo que no se juega con ellas. */
  lives: number | null
  /** Palos ya resueltos, atrapados o perdidos. */
  resolved: number
  /** Palos que se pusieron en juego. */
  stickCount: number
  /** El récord del reto guardado aquí al empezar; cero si no hay. */
  record: number
  /** La lección corre sobre el reto: lo que pasa aún no cuenta (`calentamiento.ts`). */
  calentando?: boolean
  /** La lección se acaba de cerrar y el reto empieza de cero: hasta el primer palo, se avisa. */
  ahoraCuenta?: boolean
}

/**
 * La partida que se le cuenta al cartel, o `null` si no hay nada que colgar.
 *
 * La que cuenta es el reto —o el modo que diga el salón—, jugado solo: durante la cuenta atrás y
 * hasta que se resuelve el primer palo, la misión y los listones; después, el listón que falta,
 * las vidas y los palos que quedan; al acabar, lo que faltó. En cualquier otro modo, y a dos,
 * dentro del salón el cartel dice bajito que no cuenta para medalla mientras se juega; con el
 * juego abierto suelto no hay medalla de la que hablar y no se cuelga. En el menú, tampoco.
 *
 * **El calentamiento** dice bajito que no cuenta, con salón y sin él; y al cerrarse la lección, la
 * cuenta atrás del reto que empieza de cero dice «Ahora cuenta para medalla» en lugar de la misión
 * —que ya se ha jugado—, con los listones debajo.
 */
export function partidaDelCartel(juego: LoQueSeJuega, t: Translate): Run | null {
  const { gameMode, gameState } = juego
  if (gameState === 'menu') return null
  const objetivo = juego.objetivo ?? null
  if (juego.calentando === true) {
    // Sin salón el cartel solo dice la misión, así que la misión es ya la frase entera.
    const modo = t(CALENTAMIENTO)
    const mision = t('{mode} · does not count for a medal', { mode: modo })
    return { goal: objetivo, phase: 'playing', points: juego.points, mission: mision, counts: false, mode: modo }
  }
  const mision = t(MISION_DEL_RETO, { sticks: CHALLENGE_SETUP.stickCount })
  const cuenta =
    gameMode === MODO_DE_LAS_MEDALLAS && !juego.aDos && juego.lives != null && countsForMedal(objetivo, gameMode)
  if (!cuenta) {
    if (objetivo == null || gameState === 'finished') return null
    const modo = t(juego.aDos ? PLAYER_COUNT_LABELS[2] : GAME_MODE_LABELS[gameMode])
    return { goal: objetivo, phase: 'playing', points: 0, mission: mision, counts: false, mode: modo }
  }
  const sinEmpezar = gameState === 'countdown' || juego.resolved === 0
  return {
    goal: objetivo,
    phase: gameState === 'finished' ? 'end' : sinEmpezar ? 'before' : 'playing',
    points: juego.points,
    mission: juego.ahoraCuenta === true && sinEmpezar ? t(AHORA_CUENTA) : mision,
    remaining: loQueQueda(juego.lives as number, juego.stickCount - juego.resolved, t),
    record: juego.record > 0 ? juego.record : null,
    // La primera vez, el bronce en palos. Con un bronce de un palo o menos, la cifra: «≈ 1 palo»
    // es el primer atrape y no dice hasta dónde hay que llegar.
    asCount: objetivo != null && palosPara(objetivo.medals.bronze) > 1 ? enPalos(t) : null,
  }
}

/** Si el cartel de esa partida dice ya los puntos y las vidas: entonces el marcador los calla. */
export function llevaLaCuenta(partida: Run | null): partida is Run {
  return partida != null && partida.counts !== false
}

/**
 * Lo que tarda en notarse el listón después del atrape que lo cruzó, en milisegundos.
 *
 * El palo que cruza el listón ya vibra al cogerlo (`haptics.ts`) y `pulse()` no encola: los dos a
 * la vez serían uno. Con este hueco se sienten como dos toques. A CALIBRAR CON EL VISOR.
 */
export const RETARDO_DEL_LISTON = 90

/**
 * Lo que se siente en la mano al cruzar un listón: algo ha llegado, más fuerte cuanto mejor es
 * la medalla. A CALIBRAR CON EL VISOR.
 */
export function tactoDelListon(medalla: Medal, mano: HandSide): HapticEvent {
  return { type: 'arrival', hand: mano, strength: 0.5 + 0.25 * MEDALS.indexOf(medalla) }
}

/** Los pulsos del listón cruzado, ya con su hueco tras el atrape. */
export function pulsosDelListon(medalla: Medal, mano: HandSide): HandPulse[] {
  return pulsesFor(tactoDelListon(medalla, mano)).map((pulso) => ({ ...pulso, delay: pulso.delay + RETARDO_DEL_LISTON }))
}
