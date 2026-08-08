/**
 * Siluetas de los iconos de la interfaz inmersiva.
 *
 * En VR/AR no hay letras: `<Text>` de drei descarga las fuentes de un CDN que la
 * CSP bloquea, así que cada botón se explica con un dibujo. Los primeros iconos
 * se montaron apilando primitivas (un prisma triangular junto a una caja) y en
 * el visor no se leían: dos piezas próximas se ven como dos objetos, no como una
 * figura. Aquí un icono es un **contorno cerrado** —una sola silueta— del que se
 * saca la geometría; lo que se dibuja es exactamente lo que se ve.
 *
 * Los puntos van en el cuadro normalizado [-1, 1], así que el `size` del
 * componente es la mitad del lado del icono y dos iconos con el mismo `size` se
 * ven del mismo tamaño. Vive en `lib` y no en el componente porque la forma es
 * comprobable sin navegador: que el tejado corone la casa o que la punta de la
 * flecha sea más ancha que el asta son justo los fallos que se vieron con las
 * gafas puestas.
 */

/** Punto del contorno, en el cuadro normalizado [-1, 1]. */
export type IconPoint = readonly [number, number]

/** Una pieza del icono: su contorno y, si los tiene, sus huecos. */
export type IconPath = {
  readonly outline: readonly IconPoint[]
  readonly holes?: readonly (readonly IconPoint[])[]
}

/** Un icono es una o más piezas independientes. */
export type IconShape = readonly IconPath[]

/**
 * Casa: volver al menú.
 *
 * Silueta de una pieza (tejado, alero y cuerpo) con la puerta como hueco. El
 * alero sobresale del cuerpo para que el tejado se lea aunque el icono sea de
 * cinco centímetros a un metro de distancia.
 */
export const XR_HOME_ICON: IconShape = [
  {
    outline: [
      [0, 1],
      [1, 0.06],
      [0.66, 0.06],
      [0.66, -0.88],
      [-0.66, -0.88],
      [-0.66, 0.06],
      [-1, 0.06],
    ],
    holes: [
      [
        [-0.25, -0.84],
        [0.25, -0.84],
        [0.25, -0.16],
        [-0.25, -0.16],
      ],
    ],
  },
]

/**
 * Puerta con una flecha saliendo: salir del visor.
 *
 * Distinto de la casa a propósito: los dos botones compartían icono y hacían
 * cosas muy distintas —uno vuelve al menú del juego, el otro cierra la sesión y
 * devuelve al navegador—. El marco se dibuja abierto por el lado por el que sale
 * la flecha, que es lo que convierte un rectángulo en una puerta.
 */
export const XR_EXIT_ICON: IconShape = [
  {
    // Marco en forma de C, abierto a la derecha.
    outline: [
      [-1, 1],
      [0.05, 1],
      [0.05, 0.66],
      [-0.6, 0.66],
      [-0.6, -0.66],
      [0.05, -0.66],
      [0.05, -1],
      [-1, -1],
    ],
  },
  {
    // Flecha de una sola pieza: la punta nace del asta, no se apoya en ella.
    outline: [
      [1, 0],
      [0.42, 0.52],
      [0.42, 0.2],
      [-0.35, 0.2],
      [-0.35, -0.2],
      [0.42, -0.2],
      [0.42, -0.52],
    ],
  },
]
