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
 * Corazón: una vida.
 *
 * Es lo que el modo desafío pone en juego, y lo único que lo explica en el
 * visor: tres corazones encendidos en el menú son las tres vidas con las que se
 * empieza, y en el marcador las que quedan. Se dibuja de una pieza —dos lóbulos
 * arriba y punta abajo— porque a un metro de distancia dos medios círculos y un
 * triángulo se leen como tres objetos sueltos, que es lo que ya falló con los
 * primeros iconos del menú.
 */
export const XR_HEART_ICON: IconShape = [
  {
    outline: [
      [0, 0.471],
      [0.011, 0.533],
      [0.082, 0.682],
      [0.242, 0.835],
      [0.478, 0.904],
      [0.731, 0.842],
      [0.927, 0.66],
      [1, 0.409],
      [0.927, 0.143],
      [0.731, -0.107],
      [0.478, -0.335],
      [0.242, -0.544],
      [0.082, -0.726],
      [0.011, -0.856],
      [0, -0.904],
      [-0.011, -0.856],
      [-0.082, -0.726],
      [-0.242, -0.544],
      [-0.478, -0.335],
      [-0.731, -0.107],
      [-0.927, 0.143],
      [-1, 0.409],
      [-0.927, 0.66],
      [-0.731, 0.842],
      [-0.478, 0.904],
      [-0.242, 0.835],
      [-0.082, 0.682],
      [-0.011, 0.533],
    ],
  },
]

/**
 * Cuerpo del altavoz, común al icono de sonido y al de silencio: caja y cono.
 *
 * Los dos estados comparten silueta a propósito. Lo que cambia es lo que sale
 * del cono —ondas u aspa—, así que el botón se lee como el mismo control en dos
 * posiciones y no como dos botones distintos.
 */
const SPEAKER_OUTLINE: readonly IconPoint[] = [
  [-0.95, -0.3],
  [-0.45, -0.3],
  [-0.05, -0.88],
  [-0.05, 0.88],
  [-0.45, 0.3],
  [-0.95, 0.3],
]

/**
 * Altavoz con ondas: el juego suena.
 *
 * Las ondas son dos arcos concéntricos al vértice del cono, despegados de él y
 * entre sí: pegados se funden en una mancha y el icono deja de leerse a un
 * metro, que es el fallo que ya tuvieron los primeros iconos del menú.
 */
export const XR_SOUND_ICON: IconShape = [
  { outline: SPEAKER_OUTLINE },
  {
    outline: [
      [0.26, -0.49],
      [0.46, -0.28],
      [0.53, 0],
      [0.46, 0.28],
      [0.26, 0.49],
      [0.16, 0.34],
      [0.3, 0.19],
      [0.35, 0],
      [0.3, -0.19],
      [0.16, -0.34],
    ],
  },
  {
    outline: [
      [0.47, -0.83],
      [0.81, -0.48],
      [0.93, 0],
      [0.81, 0.48],
      [0.47, 0.83],
      [0.37, 0.68],
      [0.65, 0.39],
      [0.75, 0],
      [0.65, -0.39],
      [0.37, -0.68],
    ],
  },
]

/**
 * Altavoz con un aspa: el juego está en silencio.
 *
 * El aspa ocupa el sitio de las ondas en vez de cruzar el altavoz. Tachar la
 * silueta con una barra del mismo color no se ve como un tachón: se ve como una
 * sola mancha, porque el relleno de las dos piezas es el mismo.
 */
export const XR_MUTED_ICON: IconShape = [
  { outline: SPEAKER_OUTLINE },
  {
    // Aspa de una pieza: una cruz girada 45°, con sus cuatro brazos en diagonal.
    outline: [
      [0.53, 0.23],
      [0.73, 0.43],
      [0.96, 0.21],
      [0.76, 0],
      [0.96, -0.21],
      [0.73, -0.43],
      [0.53, -0.23],
      [0.33, -0.43],
      [0.1, -0.21],
      [0.3, 0],
      [0.1, 0.21],
      [0.33, 0.43],
    ],
  },
]

/**
 * Avión de papel: compartir el resultado.
 *
 * De una sola pieza, como el resto: el símbolo habitual de compartir son tres
 * nodos unidos por dos líneas, y cinco piezas sueltas a un metro de distancia
 * son cinco manchas. El avión conserva el significado —enviar esto a alguien—
 * con un contorno cerrado, y lo que lo distingue de un triángulo cualquiera es
 * la muesca de la cola.
 */
export const XR_SHARE_ICON: IconShape = [
  {
    outline: [
      // Morro, cola de arriba, muesca y cola de abajo.
      [1, 1],
      [-1, 0.05],
      [-0.3, -0.15],
      [-0.05, -1],
    ],
  },
]

/**
 * Marca de verificación: hecho.
 *
 * Confirma que el resultado salió del visor —compartido o, al menos, copiado—,
 * porque dentro de la sesión no hay ningún aviso del sistema que lo diga. Es un
 * trazo con cuerpo y no una línea: a un metro, un trazo fino desaparece.
 */
export const XR_CHECK_ICON: IconShape = [
  {
    outline: [
      [-0.647, 0.272],
      [-0.246, -0.364],
      [0.65, 1],
      [0.938, 0.811],
      [-0.251, -1],
      [-0.938, 0.088],
    ],
  },
]

/**
 * Aspa: no se pudo.
 *
 * La misma figura que tacha el altavoz del icono de silencio, aquí sola y a
 * tamaño completo. Sirve para avisar de que el resultado no salió del visor: un
 * botón que se pulsa y no cambia nada se lee como una avería del juego.
 */
export const XR_CROSS_ICON: IconShape = [
  {
    outline: [
      [0, 0.529],
      [0.46, 0.989],
      [0.989, 0.483],
      [0.529, 0],
      [0.989, -0.483],
      [0.46, -0.989],
      [0, -0.529],
      [-0.46, -0.989],
      [-0.989, -0.483],
      [-0.529, 0],
      [-0.989, 0.483],
      [-0.46, 0.989],
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

/**
 * Los triángulos del menú —el de empezar, los de subir y bajar el aro— no son
 * siluetas: salen de un prisma de tres lados (`cylinderGeometry` con tres
 * segmentos), que es una pieza sólida y no un contorno. Ahí lo único que hay
 * que acertar es el giro, y es justo lo que se torció en el botón de empezar:
 * al componer dos cuartos de vuelta, el eje del prisma acababa apuntando a un
 * lado, así que en vez del símbolo de reproducir se veía su canto, una lasca de
 * un centímetro.
 *
 * El prisma nace con el eje en vertical y un vértice al frente, de modo que el
 * giro tiene que llevar ese eje hacia el jugador —para que el grosor quede de
 * frente y el dibujo se vea entero— y el vértice hacia donde caiga la punta.
 */
export type TriangleTip = 'up' | 'down' | 'right'

/** Giro que deja el triángulo de frente con la punta hacia cada lado. */
export const XR_TRIANGLE_ROTATION: Record<
  TriangleTip,
  readonly [number, number, number]
> = {
  up: [-Math.PI / 2, 0, 0],
  down: [Math.PI / 2, 0, 0],
  // De frente y luego un cuarto de vuelta sobre el eje que mira al jugador: la
  // punta pasa de arriba a la derecha, como en cualquier botón de reproducir.
  right: [-Math.PI / 2, Math.PI / 2, 0],
}

/**
 * Dónde queda el centro del dibujo respecto al eje del prisma, en unidades de
 * `size`.
 *
 * La punta sale a un radio del eje y el lado opuesto se queda a medio, así que
 * un triángulo colocado por su eje se ve corrido hacia la punta. Quien lo pinta
 * resta esto para que a igual `position` todos los iconos caigan en el mismo
 * sitio de su placa, como ya pasa con las siluetas.
 */
export const XR_TRIANGLE_CENTER: Record<
  TriangleTip,
  readonly [number, number]
> = {
  up: [0, 0.25],
  down: [0, -0.25],
  right: [0.25, 0],
}
