import { GROUND_Y } from './gameConfig'

/**
 * Recinto de feria que rodea al jugador cuando el escenario está puesto.
 *
 * Hasta aquí el decorado era solo el HDRI: una foto de una plaza de noche
 * envolviendo la escena. De lejos funciona, pero en el visor se delata en
 * cuanto el jugador mueve la cabeza —una foto no tiene paralaje— y la máquina
 * queda plantada en mitad de la nada. Esto añade volumen alrededor: casetas,
 * guirnaldas de bombillas y una noria al fondo, con la foto detrás haciendo de
 * cielo y de luz.
 *
 * Aquí vive **dónde** va cada cosa, que es lo que puede estropear la partida
 * (decorado dentro del alcance del brazo, bombillas a la altura de la cara), y
 * por eso se prueba aparte. Los componentes solo pintan.
 */

export type Vec3 = [number, number, number]

/**
 * Radio libre alrededor del jugador: ahí dentro no entra ni una pieza del
 * decorado. La máquina, con sus postes abiertos y sus riostras, llega a ~1.7 m
 * (el pie del tirante, ver `legs` en `StickMachine`); el resto es sitio para
 * moverse y para que nada aparezca pegado a la cara al girarse.
 */
export const SCENERY_CLEARANCE = 3

/** Casetas del recinto, repartidas en círculo mirando al jugador. */
export const STALL_COUNT = 6
export const STALL_RING_RADIUS = 6.4
/**
 * Ancho, alto y fondo de una caseta, en metros, más el vuelo del toldo por
 * delante de ella. El toldo va aquí y no en el componente porque es la pieza de
 * la caseta que más se acerca al jugador, y por tanto la que manda en el hueco
 * libre que se le deja.
 */
export const STALL_SIZE = {
  width: 2.8,
  height: 2.35,
  depth: 1.6,
  awningReach: 0.9,
} as const

/**
 * Guirnaldas de bombillas: postes en círculo, más cerca que las casetas, con un
 * tramo colgando entre cada dos. Son lo que convierte un descampado con puestos
 * en un recinto: cierran el espacio por arriba sin tapar el cielo.
 */
export const GARLAND_POST_COUNT = 8
export const GARLAND_RING_RADIUS = 4.6
export const GARLAND_POST_HEIGHT = 3.4
/** Cuánto baja el punto medio del tramo respecto a los postes. */
export const GARLAND_SAG = 0.5
export const GARLAND_BULBS_PER_SPAN = 7

/**
 * Noria al fondo, fuera del recinto: da escala y profundidad, que es justo lo
 * que una foto de fondo no puede dar. Va desviada del frente para no quedar
 * detrás de la máquina, y lo bastante alta como para asomar por encima de las
 * casetas.
 */
export const WHEEL_CENTER: Vec3 = [-7.4, 7.4, -10.6]
export const WHEEL_RADIUS = 5.6
export const WHEEL_CABIN_COUNT = 12
/**
 * Cuánto baja el **centro** de una cabina por debajo del punto del aro del que
 * cuelga. Lo que roza el suelo es su fondo, media góndola más abajo.
 */
export const WHEEL_CABIN_DROP = 1.05
/** Alto de la góndola de una cabina. */
export const WHEEL_CABIN_HEIGHT = 0.6
/** Velocidad de giro en radianes por segundo: una vuelta cada ~85 s. */
export const WHEEL_SPEED = 0.074

/** Giro en Y que deja mirando al centro del recinto a lo que esté en `position`. */
export function facingRotationY([x, , z]: Vec3): number {
  // El frente de una pieza es su +Z local, y un giro de `angle` lo lleva a
  // (sin, cos). Media vuelta más y apunta al revés: hacia el centro.
  return Math.atan2(x, z) + Math.PI
}

/** Sitio de una pieza del recinto: dónde se planta y hacia dónde encara. */
export interface RingSlot {
  /** Punto del anillo, a ras de suelo. */
  position: Vec3
  /** Giro en Y que deja la pieza mirando al jugador. */
  rotationY: number
}

/**
 * Reparte `count` piezas en un anillo alrededor del jugador, todas encarándole.
 *
 * El anillo se recorre desde `startAngle`, que es lo que permite girar las
 * casetas respecto a los postes de las guirnaldas y que no queden unas justo
 * detrás de otros.
 */
export function ringSlots(
  count: number,
  radius: number,
  startAngle = 0,
): RingSlot[] {
  return Array.from({ length: Math.max(count, 0) }, (_, index) => {
    const angle = startAngle + (index / count) * Math.PI * 2
    const position: Vec3 = [
      Math.sin(angle) * radius,
      GROUND_Y,
      Math.cos(angle) * radius,
    ]
    return { position, rotationY: facingRotationY(position) }
  })
}

/**
 * Bombillas de un tramo de guirnalda colgado entre dos postes.
 *
 * La curva es una parábola y no una catenaria de verdad: a esta distancia no se
 * distingue una de otra, y la parábola se lee de un vistazo. Los extremos no
 * llevan bombilla —ahí está la punta del poste— así que se reparten por dentro
 * del vano.
 */
export function garlandBulbs({
  from,
  to,
  count = GARLAND_BULBS_PER_SPAN,
  sag = GARLAND_SAG,
}: {
  from: Vec3
  to: Vec3
  count?: number
  sag?: number
}): Vec3[] {
  return Array.from({ length: Math.max(count, 0) }, (_, index) => {
    const t = (index + 1) / (count + 1)
    // 4t(1−t) vale 0 en los postes y 1 en el centro del vano.
    const drop = sag * 4 * t * (1 - t)
    return [
      from[0] + (to[0] - from[0]) * t,
      from[1] + (to[1] - from[1]) * t - drop,
      from[2] + (to[2] - from[2]) * t,
    ]
  })
}
