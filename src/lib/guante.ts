/**
 * La mano que se ve en el visor: un guante que agarra el mando y cierra el puño al apretar.
 *
 * **Por qué.** Con las gafas el jugador pidió «ver las manos, o algo, para saber dónde
 * las tiene uno y con qué agarrar los palos». El mando dibujado dice dónde está el mando, pero
 * no dónde está la mano ni cuándo se cierra, que es de lo que va este juego. El guante cierra
 * el puño con el gatillo lateral: la misma pulsación que atrapa un palo se ve en la mano.
 *
 * Aquí vive lo que el guante **hace** —cuánto se cierra cada dedo según lo que se aprieta, y
 * a qué ritmo—, sin three ni React, para probarlo sin visor. El dibujo está en
 * `components/xr/Guante.tsx`. Sirve de molde para los demás juegos: lo único propio de cada
 * uno es la forma de su mando.
 */

/** Cuánto está cerrado cada grupo de dedos, de 0 (abierto) a 1 (puño). */
export interface Postura {
  /** Corazón, anular y meñique: los que aprietan el gatillo lateral. */
  readonly dedos: number
  /** El índice, que va sobre el gatillo de delante. */
  readonly indice: number
  readonly pulgar: number
}

/** Lo que se lee del mando cada fotograma. Los dos valores van de 0 a 1. */
export interface Lectura {
  /** El gatillo lateral (`xr-standard-squeeze`). */
  readonly agarre: number
  /** El gatillo de delante (`xr-standard-trigger`). */
  readonly gatillo: number
}

/** Lo que dice de un botón el estado del mando de @react-three/xr, reducido a lo que se usa. */
export interface BotonDelMando {
  readonly state: 'default' | 'touched' | 'pressed'
  readonly button?: number
}

/**
 * Cuánto se aprieta un botón, de 0 a 1.
 *
 * El valor analógico si el mando lo da —los gatillos del Quest lo dan—; si no, apretado o no.
 * Un botón que no existe no se aprieta.
 */
export function cuantoAprieta(boton: BotonDelMando | undefined): number {
  if (boton == null) return 0
  if (boton.button != null && Number.isFinite(boton.button)) return acotar(boton.button)
  return boton.state === 'pressed' ? 1 : 0
}

/**
 * Cómo de cerrada está la mano con el mando suelto: los dedos rodean el mango sin apretar.
 * Un guante del todo abierto no parecería estar sosteniendo nada. A CALIBRAR CON EL VISOR.
 */
export const REPOSO = 0.15

/**
 * La postura que pide lo que se está apretando.
 *
 * El lateral cierra el puño entero; el índice sigue a su gatillo, pero se recoge también con
 * el puño —nadie cierra la mano con el índice estirado—; y el pulgar acompaña a medias.
 */
export function posturaDelGuante({ agarre, gatillo }: Lectura): Postura {
  const apretado = acotar(agarre)
  const dedos = REPOSO + (1 - REPOSO) * apretado
  return {
    dedos,
    indice: Math.max(REPOSO + (1 - REPOSO) * acotar(gatillo), dedos * 0.8),
    pulgar: REPOSO + (1 - REPOSO) * apretado * 0.7,
  }
}

/**
 * Lo rápido que la mano va a la postura pedida, como constante de tiempo (1/s). La mano no
 * salta: se cierra; y lo bastante deprisa para que el puño se vea cerrarse en el mismo
 * instante en que se atrapa un palo. A CALIBRAR CON EL VISOR.
 */
export const VELOCIDAD_DE_CIERRE = 18

/** Un paso de la mano hacia la postura pedida, `dt` segundos después. */
export function acercarPostura(
  actual: Postura,
  objetivo: Postura,
  dt: number,
  velocidad = VELOCIDAD_DE_CIERRE,
): Postura {
  const t = Number.isFinite(dt) && dt > 0 ? 1 - Math.exp(-velocidad * dt) : 0
  const paso = (a: number, b: number) => a + (b - a) * t
  return {
    dedos: paso(actual.dedos, objetivo.dedos),
    indice: paso(actual.indice, objetivo.indice),
    pulgar: paso(actual.pulgar, objetivo.pulgar),
  }
}

/**
 * Cuánto se dobla cada articulación de un dedo con el puño cerrado del todo, en radianes: la
 * base, la del medio y la de la punta. Tres falanges que suman algo más de media vuelta, que
 * es lo que rodea un mango de cuatro centímetros.
 */
export const DOBLEZ_MAXIMO = [1.25, 1.35, 0.95] as const

/** Los ángulos de las tres articulaciones de un dedo con ese cierre. */
export function angulosDelDedo(cierre: number): [number, number, number] {
  const c = acotar(cierre)
  return [DOBLEZ_MAXIMO[0] * c, DOBLEZ_MAXIMO[1] * c, DOBLEZ_MAXIMO[2] * c]
}

/**
 * A partir de qué cierre se da la mano por cerrada: las yemas se ponen verdes, que es la
 * confirmación de que el visor está leyendo el gatillo.
 */
export const CERRADA = 0.85

function acotar(x: number): number {
  if (!Number.isFinite(x)) return 0
  return Math.min(1, Math.max(0, x))
}
