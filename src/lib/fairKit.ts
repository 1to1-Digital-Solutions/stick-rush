import {
  GARLAND_POST_COUNT,
  GARLAND_POST_HEIGHT,
  GARLAND_RING_RADIUS,
  STALL_COUNT,
  STALL_RING_RADIUS,
  ringSlots,
  type Vec3,
} from './sceneryLayout'

/**
 * Las piezas del kit de xrcade que forman el recinto: los puestos del anillo, las farolas de
 * las que cuelgan las guirnaldas y una banderola en cada farola.
 *
 * Son del Fantasy Town Kit de Kenney (CC0; ver `public/CREDITS.md`), preparadas en el kit
 * compartido del salón, y se pintan con un `InstancedMesh` por tipo: una llamada de dibujo por
 * pieza y no una por puesto. Aquí solo está **dónde** va cada una, sin three, para poder
 * probar sin escena lo que importa al jugar: que nada entra en el hueco del jugador ni en la
 * máquina.
 *
 * Los sitios son los del recinto (`sceneryLayout.ts`): los puestos, en el anillo de casetas y
 * mirando al jugador; las farolas, donde estaban los postes de las guirnaldas, que siguen
 * tendiéndose de punta a punta.
 */

/** Las piezas del kit que usa el recinto; cada una es `public/models/kit/<pieza>.glb`. */
export const PIEZAS = ['puesto', 'farol', 'banderola'] as const

export type Pieza = (typeof PIEZAS)[number]

/** Ruta de una pieza dentro de `public/`, para `assetUrl`. */
export function rutaDePieza(pieza: Pieza): string {
  return `models/kit/${pieza}.glb`
}

/**
 * Lo que mide de alto cada pieza en el recinto, en metros.
 *
 * - **Puesto**, 2,8 m hasta la punta del toldo: lo bastante para leerse como una caseta a
 *   seis metros y medio, y bajo para que la noria asome por encima.
 * - **Farol**, la altura de los postes de las guirnaldas: los tramos de bombillas se cuelgan
 *   de su punta, así que tiene que llegar justo ahí.
 * - **Banderola**, un metro: se lee desde el centro sin tapar la farola ni las bombillas.
 */
export const ALTURAS: Record<Pieza, number> = {
  puesto: 2.8,
  farol: GARLAND_POST_HEIGHT,
  banderola: 1,
}

/**
 * Cuánto hay que girar cada modelo para que su frente quede en +Z, que es hacia donde el
 * anillo encara las piezas (ver `ringSlots`). La banderola es una tela fina en X y ancha en Z:
 * sin el cuarto de vuelta, el jugador la vería de canto.
 */
export const GIRO_DEL_MODELO: Record<Pieza, number> = {
  puesto: 0,
  farol: 0,
  banderola: -Math.PI / 2,
}

/**
 * Dónde cuelga la banderola de su farola: cuánto se adelanta hacia el centro del recinto
 * —lo justo para no meterse en el poste— y a qué altura queda su borde de abajo: por encima
 * de la máquina, para que no se lea como algo del juego, y por debajo del farol.
 */
export const BANDEROLA_EN_LA_FAROLA = { adelanto: 0.2, bajo: 2 } as const

/** Una pieza ya colocada. */
export interface Colocacion {
  pieza: Pieza
  /** Dónde va el centro de la base de su caja, en metros del mundo. */
  posicion: Vec3
  /** Alto de la caja, de abajo arriba, en metros. */
  altura: number
  /** Giro sobre el eje vertical, en radianes, que deja el frente del modelo mirando al jugador. */
  giro: number
}

/** El recinto entero: seis puestos, ocho farolas y sus ocho banderolas. */
export function colocaciones(): Colocacion[] {
  const puestos = ringSlots(STALL_COUNT, STALL_RING_RADIUS).map(
    ({ position, rotationY }): Colocacion => ({
      pieza: 'puesto',
      posicion: position,
      altura: ALTURAS.puesto,
      giro: rotationY + GIRO_DEL_MODELO.puesto,
    }),
  )

  // Desfasadas medio hueco respecto a los puestos, como iban los postes, para que no queden
  // unas justo delante de otros.
  const farolas = ringSlots(GARLAND_POST_COUNT, GARLAND_RING_RADIUS, Math.PI / GARLAND_POST_COUNT)
  const faroles = farolas.map(
    ({ position, rotationY }): Colocacion => ({
      pieza: 'farol',
      posicion: position,
      altura: ALTURAS.farol,
      giro: rotationY + GIRO_DEL_MODELO.farol,
    }),
  )
  const banderolas = farolas.map(({ position: [x, y, z], rotationY }): Colocacion => {
    // Hacia el centro: la farola está a `GARLAND_RING_RADIUS` y el centro, en el origen.
    const haciaDentro = BANDEROLA_EN_LA_FAROLA.adelanto / GARLAND_RING_RADIUS
    return {
      pieza: 'banderola',
      posicion: [x - x * haciaDentro, y + BANDEROLA_EN_LA_FAROLA.bajo, z - z * haciaDentro],
      altura: ALTURAS.banderola,
      giro: rotationY + GIRO_DEL_MODELO.banderola,
    }
  })

  return [...puestos, ...faroles, ...banderolas]
}

/**
 * La escala que deja una pieza a la altura pedida, dado lo que mide su caja en el modelo.
 *
 * Se mide la caja del modelo que llega y no se apunta un número aquí: si el kit rehace una
 * pieza con otro tamaño, el recinto sigue midiendo lo mismo.
 */
export function escalaPara(altura: number, altoDeLaCaja: number): number {
  return altura / altoDeLaCaja
}

/** La caja de los vértices de un modelo, en sus unidades. */
export interface Caja {
  min: Vec3
  max: Vec3
}

/**
 * Lo que hay que mover el modelo, en sus unidades, para que el centro de la base de su caja
 * quede en su origen.
 *
 * Las piezas de rejilla de Kenney no están centradas: la banderola está pegada al borde de su
 * casilla (x ≈ 0,4). Sin esto colgaría a medio metro de su farola, y a otro lado según el
 * giro.
 */
export function anclaEnLaBase({ min, max }: Caja): Vec3 {
  return [-(min[0] + max[0]) / 2, -min[1], -(min[2] + max[2]) / 2]
}
