/**
 * Vaivén de los palos que cuelgan del aro.
 *
 * Hasta que caía el primer palo no se movía nada: con el visor puesto la
 * máquina parecía congelada mientras el jugador elegía opciones y durante la
 * cuenta atrás. El balanceo es solo decorado —no cambia ni cuándo se suelta un
 * palo ni desde qué altura—, así que se mantiene corto y lento: lo justo para
 * que la escena respire sin distraer de lo que va a caer.
 */

/** Amplitud del vaivén principal, en radianes (~3°). */
export const SWING_AMPLITUDE = 0.055

/**
 * Amplitud del eje perpendicular, en proporción a la principal. Con un solo eje
 * los palos parecen limpiaparabrisas; con los dos describen una elipse lenta,
 * que es como se mueve algo colgado al que le da el aire.
 */
export const SWING_CROSS_RATIO = 0.45

/**
 * Ciclos por segundo del vaivén. Un péndulo real de esta longitud (el hilo más
 * el palo, medio metro) rondaría los 0.7 Hz; se deja algo más lento porque a
 * tres grados ese ritmo se lee como nervioso, no como inercia.
 */
export const SWING_FREQUENCY = 0.55

/** Cuánto varía la frecuencia entre palos: del 85 % al 115 % de la base. */
export const SWING_FREQUENCY_SPREAD = 0.3

/**
 * Frecuencia del eje perpendicular respecto a la principal. No es un múltiplo
 * simple a propósito: si los dos ejes cerraran el ciclo a la vez, el palo
 * repetiría el mismo recorrido una y otra vez y se notaría el bucle.
 */
export const SWING_CROSS_RATE = 0.73

/**
 * A qué ritmo se endereza el palo (1/s) cuando deja de colgar. Al soltarse cae
 * recto en ~0.25 s: un palo cayendo tiene que leerse claro para atraparlo, y
 * arrastrar el balanceo durante la caída lo vuelve difícil de seguir.
 */
export const SWING_RELEASE_DECAY = 4

/** Inclinación del palo respecto a la vertical, en radianes. */
export interface SwingTilt {
  /** Giro sobre X: mece el palo adelante y atrás. */
  x: number
  /** Giro sobre Z: lo mece a los lados. */
  z: number
}

/**
 * Cuánto se inclina un palo que cuelga, `time` segundos después de montarse.
 *
 * `phase` es su hueco propio dentro del ciclo, en [0, 1): decide dónde arranca
 * el vaivén y afina su frecuencia, de modo que trece palos con la misma receta
 * no se muevan como un solo bloque.
 */
export function hangingSwing(time: number, phase: number): SwingTilt {
  const frequency =
    SWING_FREQUENCY * (1 + (phase - 0.5) * SWING_FREQUENCY_SPREAD)
  const speed = 2 * Math.PI * frequency
  const offset = 2 * Math.PI * phase

  return {
    x:
      SWING_AMPLITUDE *
      SWING_CROSS_RATIO *
      Math.sin(speed * SWING_CROSS_RATE * time + offset * 1.7),
    z: SWING_AMPLITUDE * Math.sin(speed * time + offset),
  }
}
