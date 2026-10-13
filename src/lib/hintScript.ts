import type { HintScript } from './hints'
import type { Hand } from './settings'
import {
  MACHINE_RADIUS,
  PLAYER_OFFSET_Z,
  STICK_CORD_LENGTH,
  STICK_LENGTH,
  STICK_RADIUS,
} from './gameConfig'

/**
 * Las ayudas visuales de este juego: qué se enseña al entrar, y qué apaga cada cosa.
 *
 * **Lo que no se ve mirando la máquina** son dos cosas. Dónde ponerse: en el centro del aro,
 * de cara a los palos, que es desde donde se llega a todos sin moverse. Y que un palo **se coge
 * cerrando la mano sobre él mientras cae** —con el botón de agarre—, no apuntándolo con el rayo
 * como un botón del menú, y que se coge **abajo**, a la altura del pecho, por donde pasa al
 * caer, y no arriba, donde cuelga. El tutorial lo cuenta con letras; esto lo enseña antes, sin
 * ninguna.
 *
 * El motor —cuándo se enciende y cuándo se apaga cada una— está en `lib/ayudas.ts`, el mismo
 * fichero en todos los juegos. Aquí está lo de este: el guion y las cotas de lo que se pinta,
 * que salen de aquí y no de dentro de la escena para que el test pueda medir **los mismos
 * números que se pintan** y no una copia suya.
 *
 * Las cotas van en **coordenadas de la máquina**: el centro del aro en el cero, el suelo en
 * `y = 0` y quien juega plantado un paso por detrás del centro, en `z = PLAYER_OFFSET_Z`
 * (`GameWorld` corre el mundo lo contrario). La altura del aro no es fija —sale de los ojos de
 * quien juega (`hoopHeight.ts`)—, así que todo lo que cuelga de ella la recibe.
 */

/**
 * Lo que una ayuda de este juego puede esperar o dar por hecho.
 *
 * - `grab`: el primer palo atrapado. Es el hito del primer paso del tutorial
 *   (`hitosAtrapando`), y lo apunta la partida.
 * - `cae`: que los palos están a punto de empezar a caer —el último segundo de la cuenta
 *   atrás— o ya caen. **Todo lo que flota se tiene que haber ido antes**: por delante del aro,
 *   a la altura del pecho, es exactamente por donde pasa un palo al caer.
 *
 * Los dos se quedan hechos una vez hechos: volver al menú no vuelve a encender lo que ya se
 * aprendió.
 */
export type HechoDeLasAyudas = 'grab' | 'cae'

/**
 * El guion.
 *
 * - **`suelo`**, las dos huellas de dónde ponerse: en el centro del aro, de frente a la máquina.
 *   Se enseñan **desde que se entra en la cabina** —colocarse es lo único que se puede hacer con
 *   el menú delante— y se van con el primer palo atrapado. Van pintadas en el suelo, y ahí
 *   pueden quedarse mientras se juega: no tapan nada que caiga, que los palos caen en el aro,
 *   lejos de los pies.
 * - **`palo`**, el palo fantasma: sale del palo que cuelga delante, envolviéndolo, cae hasta la
 *   altura del pecho y se queda ahí quieto un momento, que es el atrape. Es a la vez «lo que hay
 *   que coger, resaltado» y «el gesto»: que caen, y dónde se cogen.
 * - **`mando`**, el mando de verdad con el botón de agarre latiendo, **al lado de donde el
 *   fantasma se para** (`mandoJuntoAlPalo`): el fantasma dice qué y dónde; el mando, con qué.
 *   No va en la mano, que es donde lo pone el tutorial, así que no hay dos copias del modelo
 *   pisándose, y sale desde la primera vez.
 *
 * **El fantasma y el mando se van antes de que caiga nada** (`cae`): los dos flotan donde se
 * juega, y ahí solo valen mientras no hay palos pasando. Con la cuenta atrás en marcha aún se
 * ven dos segundos, que es cuando se está mirando la máquina.
 */
export const GUION_DE_AYUDAS = [
  { id: 'suelo', until: 'grab', expiresAfter: 14 },
  { id: 'palo', until: 'cae', expiresAfter: 16 },
  { id: 'mando', until: 'cae', expiresAfter: 16 },
] as const satisfies HintScript<HechoDeLasAyudas>

/** Cómo se llama cada una, para que la escena no las pinte por un nombre inventado. */
export type AyudaDeLaMaquina = (typeof GUION_DE_AYUDAS)[number]['id']

/**
 * Si los palos van a empezar a caer: el último segundo de la cuenta atrás, o ya en juego.
 *
 * El último segundo y no el cero porque el fantasma y el mando se desvanecen en medio segundo
 * (`CRUCE`), y el primer palo sale en cuanto se acaba la cuenta: en Imposible, en dos décimas
 * ya está a la altura del pecho.
 */
export function vanACaer(gameState: string, countdown: number): boolean {
  return gameState === 'playing' || (gameState === 'countdown' && countdown <= 1)
}

/* --- Las cotas de lo que se pinta --- */

/**
 * Las dos huellas, donde se planta quien juega y de cara a la máquina, y lo que mide cada una.
 *
 * **De frente y a la par**: los palos caen alrededor, por delante y a los lados, y se cogen
 * sin dar un paso. Van **justo donde el juego planta a quien entra**, así que no piden moverse:
 * dicen «aquí, y mirando a los palos». Separadas el ancho de los hombros.
 */
export const HUELLA = { largo: 0.26, ancho: 0.1 }
export const HUELLAS: readonly { x: number; z: number }[] = [
  { x: -0.11, z: PLAYER_OFFSET_Z },
  { x: 0.11, z: PLAYER_OFFSET_Z },
]

/** A qué altura se pintan las huellas sobre el suelo, antes del sesgo del rasterizado. */
export const HUELLAS_Y = 0.005

/**
 * Dónde cuelga el palo del que sale el fantasma: **el de delante**, en el centro del arco.
 *
 * Es el que se tiene delante de los ojos al entrar, y con un número impar de palos —los cinco
 * del desafío, los trece— hay uno colgando justo ahí, así que el fantasma sale de un palo de
 * verdad. Con un número par sale del hueco del centro, que dice lo mismo.
 */
export function paloDelFantasma(hoopHeight: number): [number, number, number] {
  return [0, hoopHeight - STICK_CORD_LENGTH - STICK_LENGTH / 2, -MACHINE_RADIUS]
}

/**
 * Lo que el palo fantasma envuelve al de verdad: un poco más por cada lado, para que se lea
 * como el palo encendido y no como otro palo metido dentro de él.
 */
export const MARGEN_DEL_FANTASMA = 0.006

/** Radio y largo del palo fantasma: el de verdad más el margen. */
export const FANTASMA = {
  radio: STICK_RADIUS + MARGEN_DEL_FANTASMA,
  largo: STICK_LENGTH + MARGEN_DEL_FANTASMA * 2,
} as const

/**
 * La caída que enseña el fantasma: cuánto baja, cuánto tarda y cómo se reparte la vuelta.
 *
 * **Baja hasta la altura del pecho y se para.** Lo que no se adivina es que el palo se coge
 * por donde pasa y no donde cuelga, así que el tramo que importa es la parada: el fantasma se
 * queda quieto abajo, con el mando al lado latiendo, y solo entonces se desvanece. Vuelve a
 * aparecer arriba en vez de subir, que visto desde los ojos sería un palo trepando.
 */
export const CAIDA = {
  /** Lo que tarda una vuelta entera, en segundos. */
  periodo: 2.4,
  /** Hasta dónde de la vuelta tarda en aparecer, quieto donde cuelga el palo. */
  aparece: 0.12,
  /** Hasta dónde dura la caída. */
  cae: 0.5,
  /** Y desde dónde se desvanece, ya parado abajo. */
  seVa: 0.86,
  /**
   * Lo que baja: del centro del palo colgado a la altura del pecho. El aro va medio metro por
   * encima de los ojos (`HOOP_RISE_ABOVE_EYES`), así que el fantasma acaba unos treinta
   * centímetros por debajo de ellos, donde la mano llega cómoda.
   */
  recorrido: 0.5,
} as const

/**
 * Por dónde va el fantasma en ese momento de su vuelta: cuánto ha bajado, en metros, y cuánto
 * se ve, de 0 a 1.
 *
 * La caída arranca despacio y acelera, como cae algo de verdad; a velocidad fija se leía como
 * un palo que se desliza por un raíl.
 */
export function caidaDelFantasma(avance: number): { bajada: number; se: number } {
  const paso = Math.min(1, Math.max(0, avance))
  if (paso < CAIDA.aparece) return { bajada: 0, se: paso / CAIDA.aparece }
  if (paso < CAIDA.cae) {
    const tramo = (paso - CAIDA.aparece) / (CAIDA.cae - CAIDA.aparece)
    return { bajada: CAIDA.recorrido * tramo * tramo, se: 1 }
  }
  if (paso < CAIDA.seVa) return { bajada: CAIDA.recorrido, se: 1 }
  return { bajada: CAIDA.recorrido, se: 1 - (paso - CAIDA.seVa) / (1 - CAIDA.seVa) }
}

/**
 * El mando de verdad junto al sitio donde el fantasma se para: del lado de la mano buena de
 * quien juega, un palmo hacia fuera y un poco hacia quien lo mira, y crecido lo justo para que
 * el botón se lea.
 *
 * - **Del lado de la mano buena** (`xrcade:hand`, la del salón): aquí se coge con cualquiera de
 *   las dos, y la que se tiende primero es esa.
 * - **A 13 cm del fantasma**: el mando mide unos 12 cm, y entre los dos queda aire para que se
 *   lean como dos cosas.
 * - **Diez centímetros por delante del aro**, hacia quien juega: por delante de la cortina de
 *   palos y no detrás, que desde los ojos quedaría medio tapado.
 *
 * A CALIBRAR CON EL VISOR: las tres cifras.
 */
export const MANDO_JUNTO_AL_PALO = {
  /** Lo que se aparta del fantasma hacia el lado de la mano, en metros. */
  separacion: 0.13,
  /** Lo que se adelanta del aro hacia quien juega, en metros. */
  delante: 0.1,
  /** El mando mide unos 12 cm: a sesenta centímetros de los ojos se agradece crecerlo. */
  escala: 1.3,
} as const

/**
 * Dónde va el mando, en coordenadas de la máquina, y cuánto se gira sobre la vertical (el
 * `rotation.y` de three): lo que deja **el costado del agarre de cara a quien juega**.
 *
 * El modelo se dibuja como un mando en la mano, apuntando a −Z; el agarre del derecho está en su
 * costado izquierdo (−X) y el del izquierdo en el derecho (+X). Girado así se ve de lado, con el
 * botón hacia los ojos, que están sobre las huellas.
 */
export function mandoJuntoAlPalo(
  hoopHeight: number,
  mano: Hand,
): { posicion: [number, number, number]; giro: number } {
  const [x0, y0, z0] = paloDelFantasma(hoopHeight)
  const lado = mano === 'left' ? -1 : 1
  const x = x0 + lado * MANDO_JUNTO_AL_PALO.separacion
  const y = y0 - CAIDA.recorrido
  const z = z0 + MANDO_JUNTO_AL_PALO.delante
  const haciaQuienJuega = PLAYER_OFFSET_Z - z
  const giro = mano === 'left' ? Math.atan2(-haciaQuienJuega, -x) : Math.atan2(haciaQuienJuega, x)
  return { posicion: [x, y, z], giro }
}
