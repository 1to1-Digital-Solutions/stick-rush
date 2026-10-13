import { MAX_STICKS } from './gameConfig'
import { HOOP_ADJUST_RANGE } from './hoopHeight'
import type { GameResult } from './seed'
import { gameStorage } from './storage'

/**
 * Las hazañas de Stick Rush: lo que un logro de Steam necesita saber y la partida no contaba.
 *
 * Son las tres marcadas con ➕ en `xrcade/docs/logros-de-steam.md`. El juego no sabe de Steam: solo
 * cuenta, guarda lo conseguido y, al acabar la partida, le dice al salón qué ha conseguido **por
 * primera vez** (`hazanas` del resultado). Quien lo convierte en logro es el hub.
 *
 * Todo es puro y sin React: lo alimentan el store de la web (`gameStore.ts`) y la partida de Godot
 * (`godot/scene/juego/partida.ts`) en los mismos sitios —al atrapar un palo y al resolverse una
 * tanda—, con los mismos números.
 */

/** Los nombres de API de Steamworks. No se cambian una vez publicados. */
export const HAZANAS = {
  /** Atrapar los trece palos de una tanda, con la máquina llena, sin que se escape ninguno. */
  tandaLimpia: 'SR_CLEAN_SWEEP',
  /** Con el aro bajado todo lo que deja el ajuste, atrapar una tanda entera sin que se escape ninguno. */
  aroAlMinimo: 'SR_LOW_HOOP',
  /** Oculto: atrapar un palo de espaldas a él. */
  deEspaldas: 'SR_BEHIND_BACK',
} as const

/** Todas, para no aceptar del guardado nada que no exista. */
const TODAS: readonly string[] = Object.values(HAZANAS)

/**
 * Cuánto tiene que estar girada la cabeza respecto al palo, en horizontal, para que el atrape sea
 * «de espaldas»: 120°. A 90° el palo queda a un lado, que es mirar de reojo y no dar la espalda;
 * pasado 120° ya está detrás del hombro.
 */
export const GIRO_DE_ESPALDAS = (2 * Math.PI) / 3

/**
 * Lo poco que puede separarse el palo de la cabeza en horizontal para que haya un «delante» y un
 * «detrás»: con el palo justo encima de la cabeza la dirección no dice nada.
 */
const SEPARACION_MINIMA = 0.05

/** Un punto o una dirección en el suelo: `x` y `z` del espacio del mundo (`y` hacia arriba). */
export interface EnElSuelo {
  readonly x: number
  readonly z: number
}

/**
 * Si un palo se ha cogido de espaldas: más de `GIRO_DE_ESPALDAS` entre hacia dónde mira la cabeza
 * y dónde está el palo, los dos llevados al suelo. Se mira en horizontal porque inclinar la cabeza
 * hacia arriba o hacia abajo no es darse la vuelta.
 *
 * @param cabeza Dónde están los ojos.
 * @param mirada Hacia dónde miran (no hace falta que sea unitaria).
 * @param palo Dónde está el palo que se coge (o el puño que lo coge, que viene a ser lo mismo).
 */
export function deEspaldas({
  cabeza,
  mirada,
  palo,
}: {
  cabeza: EnElSuelo
  mirada: EnElSuelo
  palo: EnElSuelo
}): boolean {
  const hx = palo.x - cabeza.x
  const hz = palo.z - cabeza.z
  const hacia = Math.hypot(hx, hz)
  const mira = Math.hypot(mirada.x, mirada.z)
  // Mirando al cielo o al suelo no hay «delante», y con el palo encima tampoco hay «dónde».
  if (hacia < SEPARACION_MINIMA || mira < 1e-6) return false
  const coseno = (hx * mirada.x + hz * mirada.z) / (hacia * mira)
  return coseno < Math.cos(GIRO_DE_ESPALDAS)
}

/** Lo conseguido en la partida en curso, sin mirar si ya estaba conseguido de antes. */
export interface CuentaDeHazanas {
  readonly logradas: readonly string[]
}

export const SIN_HAZANAS: CuentaDeHazanas = { logradas: [] }

function lograr(cuenta: CuentaDeHazanas, api: string): CuentaDeHazanas {
  return cuenta.logradas.includes(api) ? cuenta : { logradas: [...cuenta.logradas, api] }
}

/** Un palo atrapado. `espaldas` sale de `deEspaldas`; sin visor no se puede dar la espalda. */
export function contarAtrape(cuenta: CuentaDeHazanas, { espaldas }: { espaldas: boolean }): CuentaDeHazanas {
  return espaldas ? lograr(cuenta, HAZANAS.deEspaldas) : cuenta
}

/**
 * ¿Está el aro todo lo abajo que deja bajarlo el ajuste? Con margen de redondeo: el ajuste se
 * guarda como la suma de pasos de 5 cm.
 */
export function aroAlMinimo(ajusteDelAro: number): boolean {
  return ajusteDelAro <= -HOOP_ADJUST_RANGE + 1e-9
}

/**
 * Una tanda resuelta **entera**: todos sus palos atrapados o en el suelo. La que se deja a medias
 * —quedarse sin vidas en el desafío, terminar la partida sin fin a mitad de tanda— no llega aquí.
 *
 * @param palos Los palos que colgaban de la máquina en la tanda.
 * @param atrapados Los que se cogieron de ellos.
 * @param ajusteDelAro La corrección manual del aro con la que se jugó (`hoopHeight.ts`).
 */
export function contarTanda(
  cuenta: CuentaDeHazanas,
  { palos, atrapados, ajusteDelAro }: { palos: number; atrapados: number; ajusteDelAro: number },
): CuentaDeHazanas {
  if (palos <= 0 || atrapados < palos) return cuenta
  let siguiente = cuenta
  if (palos >= MAX_STICKS) siguiente = lograr(siguiente, HAZANAS.tandaLimpia)
  if (aroAlMinimo(ajusteDelAro)) siguiente = lograr(siguiente, HAZANAS.aroAlMinimo)
  return siguiente
}

/** Dónde se guardan las ya conseguidas: una lista de nombres de API, en JSON. */
export const HAZANAS_KEY = 'stick-rush:hazanas'

/** Las conseguidas en alguna partida. Lo ilegible o lo que no es una hazaña de aquí, no cuenta. */
export function leerHazanas(storage: Storage | null = gameStorage()): readonly string[] {
  if (storage == null) return []
  try {
    const leido: unknown = JSON.parse(storage.getItem(HAZANAS_KEY) ?? '[]')
    return Array.isArray(leido) ? TODAS.filter((api) => leido.includes(api)) : []
  } catch {
    return []
  }
}

/**
 * Las conseguidas en esta partida que **no** lo estaban de antes, y las deja guardadas.
 *
 * Es lo que va en el resultado: el salón celebra la primera vez y no las siguientes. Con el
 * almacenamiento bloqueado todas parecen nuevas cada vez; darlas de más es inofensivo (Steam no
 * desbloquea dos veces) y callarlas no lo sería.
 */
export function estrenarHazanas(
  logradas: readonly string[],
  storage: Storage | null = gameStorage(),
): string[] {
  const antes = leerHazanas(storage)
  const nuevas = logradas.filter((api) => TODAS.includes(api) && !antes.includes(api))
  if (nuevas.length > 0 && storage != null) {
    try {
      storage.setItem(HAZANAS_KEY, JSON.stringify([...antes, ...nuevas]))
    } catch {
      // Cuota agotada o escritura prohibida: se vuelven a dar la próxima vez, que no hace daño.
    }
  }
  return nuevas
}

/**
 * Lo que la escena le cuenta al salón al acabar, con las hazañas estrenadas en la partida.
 *
 * El campo es opcional y solo va cuando hay alguna: el `Resultado` común (`semilla.ts`) es el
 * mismo en los diecisiete juegos y un salón que no lo lea sigue recibiendo lo de siempre.
 */
export type ResultadoConHazanas = GameResult & {
  /** Los nombres de API conseguidos por primera vez en esta partida. */
  readonly feats?: readonly string[]
}

/** El resultado con sus hazañas, o tal cual si no se estrenó ninguna. */
export function conHazanas(resultado: GameResult, nuevas: readonly string[]): ResultadoConHazanas {
  return nuevas.length > 0 ? { ...resultado, feats: [...nuevas] } : resultado
}
