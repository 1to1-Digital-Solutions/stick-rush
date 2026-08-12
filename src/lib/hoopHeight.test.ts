import { describe, expect, it, vi } from 'vitest'
import {
  DIFFICULTY_SPEEDS,
  MACHINE_HEIGHT,
  PLAYER_SHOULDER_HEIGHT,
  STICK_CORD_LENGTH,
  STICK_LENGTH,
  STICK_MISS_Y,
  machinePoint,
  PLAYER_POSITION,
} from './gameConfig'
import {
  HOOP_ADJUST_KEY,
  HOOP_ADJUST_RANGE,
  HOOP_ADJUST_STEP,
  HOOP_MAX_HEIGHT,
  HOOP_MIN_HEIGHT,
  HOOP_REFERENCE_EYE_HEIGHT,
  HOOP_RISE_ABOVE_EYES,
  MAX_EYE_HEIGHT,
  MIN_EYE_HEIGHT,
  clampHoopAdjustment,
  headsetEyeHeight,
  hoopFallSpeed,
  hoopHeightFor,
  parseHoopAdjustment,
  readHoopAdjustment,
  writeHoopAdjustment,
} from './hoopHeight'

/** Alcance cómodo del brazo desde el hombro, el mismo de `xrInteraction.test.ts`. */
const ARM_REACH = 0.75

/**
 * Altura de hombro de quien tiene los ojos ahí. Sale de la pareja con la que se
 * diseñó la máquina (1.60 de ojos, 1.45 de hombro), así que un jugador más bajo
 * arrastra su hombro con él.
 */
function shoulderHeightFor(eyeHeight: number): number {
  return eyeHeight - (HOOP_REFERENCE_EYE_HEIGHT - PLAYER_SHOULDER_HEIGHT)
}

/** Lo lejos que le queda al jugador el palo colgado del punto `t` del aro. */
function reachTo(t: number, hoopHeight: number, eyeHeight: number): number {
  const [x, y, z] = machinePoint(t, hoopHeight)
  const [px, , pz] = PLAYER_POSITION
  const center = y - STICK_CORD_LENGTH - STICK_LENGTH / 2
  return Math.hypot(x - px, center - shoulderHeightFor(eyeHeight), z - pz)
}

/** Estaturas de prueba: sentado, bajo, de referencia y muy alto. */
const EYE_HEIGHTS = [1.05, 1.35, HOOP_REFERENCE_EYE_HEIGHT, 1.9]

describe('altura de ojos que entrega el visor', () => {
  it('con el espacio referido al suelo vale lo que mide la cabeza', () => {
    expect(headsetEyeHeight(1.72, true)).toBe(1.72)
    expect(headsetEyeHeight(1.1, true)).toBe(1.1)
  })

  it('sin espacio referido al suelo no hay dato que valga', () => {
    // En un espacio `local` la cabeza nace en el cero: su cota mide desde donde
    // arrancó la sesión, no desde el suelo, y tomarla por una estatura pondría
    // el aro a la altura de las rodillas.
    expect(headsetEyeHeight(1.72, false)).toBeNull()
    expect(headsetEyeHeight(0.02, false)).toBeNull()
  })

  it('descarta lo que no puede ser una persona', () => {
    expect(headsetEyeHeight(0, true)).toBeNull()
    expect(headsetEyeHeight(-1.6, true)).toBeNull()
    expect(headsetEyeHeight(42, true)).toBeNull()
    expect(headsetEyeHeight(Number.NaN, true)).toBeNull()
    expect(headsetEyeHeight(Number.POSITIVE_INFINITY, true)).toBeNull()
  })

  it('acepta los extremos del rango, que son personas reales', () => {
    expect(headsetEyeHeight(MIN_EYE_HEIGHT, true)).toBe(MIN_EYE_HEIGHT)
    expect(headsetEyeHeight(MAX_EYE_HEIGHT, true)).toBe(MAX_EYE_HEIGHT)
  })
})

describe('altura del aro', () => {
  it('sin dato del visor deja el aro donde ha estado siempre', () => {
    // Es lo que hace que el escritorio y una sesión sin suelo se jueguen igual
    // que antes de que la altura fuera ajustable.
    expect(hoopHeightFor({})).toBeCloseTo(MACHINE_HEIGHT, 6)
    expect(hoopHeightFor({ eyeHeight: null })).toBeCloseTo(MACHINE_HEIGHT, 6)
    expect(hoopHeightFor({ eyeHeight: undefined })).toBeCloseTo(MACHINE_HEIGHT, 6)
  })

  it('sube el aro con quien juega y lo baja con quien está sentado', () => {
    const tall = hoopHeightFor({ eyeHeight: 1.9 })
    const seated = hoopHeightFor({ eyeHeight: 1.1 })

    expect(tall).toBeCloseTo(1.9 + HOOP_RISE_ABOVE_EYES, 6)
    expect(seated).toBeCloseTo(1.1 + HOOP_RISE_ABOVE_EYES, 6)
    expect(seated).toBeLessThan(MACHINE_HEIGHT)
    expect(tall).toBeGreaterThan(MACHINE_HEIGHT)
  })

  it('una medida absurda no mueve el aro de su sitio', () => {
    // Un visor dejado sobre la mesa, un espacio mal calibrado o alguien
    // trasteando: mejor la altura de siempre que uno inalcanzable.
    for (const absurd of [0, -3, 50, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(hoopHeightFor({ eyeHeight: absurd })).toBeCloseTo(MACHINE_HEIGHT, 6)
    }
  })

  it('la corrección manual suma metros sobre lo que dice el visor', () => {
    const base = hoopHeightFor({ eyeHeight: 1.5 })
    expect(hoopHeightFor({ eyeHeight: 1.5, adjustment: 0.1 })).toBeCloseTo(
      base + 0.1,
      6,
    )
    expect(hoopHeightFor({ eyeHeight: 1.5, adjustment: -0.1 })).toBeCloseTo(
      base - 0.1,
      6,
    )
  })

  it('la corrección manual no se sale de su rango', () => {
    expect(clampHoopAdjustment(5)).toBe(HOOP_ADJUST_RANGE)
    expect(clampHoopAdjustment(-5)).toBe(-HOOP_ADJUST_RANGE)
    expect(clampHoopAdjustment(Number.NaN)).toBe(0)
    expect(clampHoopAdjustment(Number.NEGATIVE_INFINITY)).toBe(0)

    // Y el cálculo la acota aunque le llegue sin acotar.
    expect(hoopHeightFor({ eyeHeight: 1.6, adjustment: 99 })).toBeCloseTo(
      MACHINE_HEIGHT + HOOP_ADJUST_RANGE,
      6,
    )
  })

  it('nunca deja el aro dentro del suelo ni por las nubes', () => {
    const extremes = [
      { eyeHeight: MIN_EYE_HEIGHT, adjustment: -HOOP_ADJUST_RANGE },
      { eyeHeight: MAX_EYE_HEIGHT, adjustment: HOOP_ADJUST_RANGE },
      { eyeHeight: 0, adjustment: -99 },
      { eyeHeight: 99, adjustment: 99 },
    ]

    for (const input of extremes) {
      const height = hoopHeightFor(input)
      expect(height).toBeGreaterThanOrEqual(HOOP_MIN_HEIGHT)
      expect(height).toBeLessThanOrEqual(HOOP_MAX_HEIGHT)
      // Y con recorrido de caída de sobra: un aro a la altura a la que el palo
      // ya cuenta como perdido no dejaría jugar ninguna partida.
      expect(height).toBeGreaterThan(STICK_MISS_Y + 0.5)
    }
  })

  it('el aro queda por encima de la cabeza a cualquier estatura', () => {
    // Incluso bajándolo del todo: si cayera por debajo de los ojos, los palos
    // colgarían delante de la cara en vez de alrededor.
    for (const eyeHeight of EYE_HEIGHTS) {
      const height = hoopHeightFor({ eyeHeight, adjustment: -HOOP_ADJUST_RANGE })
      expect(height).toBeGreaterThan(eyeHeight)
    }
  })

  it('ningún palo queda fuera del brazo, se ponga el aro donde se ponga', () => {
    // El invariante que hace jugable la máquina (`xrInteraction.test.ts` lo fija
    // para la altura por defecto): si el ajuste pudiera sacar los palos del
    // alcance, el menú del visor sería una forma de romper la partida.
    for (const eyeHeight of EYE_HEIGHTS) {
      for (const adjustment of [-HOOP_ADJUST_RANGE, 0, HOOP_ADJUST_RANGE]) {
        const height = hoopHeightFor({ eyeHeight, adjustment })
        for (let i = 0; i <= 20; i++) {
          expect(reachTo(i / 20, height, eyeHeight)).toBeLessThanOrEqual(
            ARM_REACH,
          )
        }
      }
    }
  })

  it('se mueve en pasos que se notan sin pasarse', () => {
    // Un paso demasiado fino obliga a machacar el botón; uno demasiado grueso
    // salta por encima de la altura buena.
    expect(HOOP_ADJUST_STEP).toBeGreaterThanOrEqual(0.02)
    expect(HOOP_ADJUST_STEP).toBeLessThanOrEqual(HOOP_ADJUST_RANGE / 2)
  })
})

describe('velocidad de caída con el aro movido', () => {
  it('cada dificultad dura lo mismo esté el aro donde esté', () => {
    // Sin esto, quien juega de pie tendría más margen de reacción que quien
    // juega sentado, con la misma dificultad elegida.
    const reference =
      (MACHINE_HEIGHT - STICK_MISS_Y) / DIFFICULTY_SPEEDS.medium

    for (const eyeHeight of EYE_HEIGHTS) {
      const height = hoopHeightFor({ eyeHeight })
      const speed = hoopFallSpeed(DIFFICULTY_SPEEDS.medium, height)
      expect((height - STICK_MISS_Y) / speed).toBeCloseTo(reference, 6)
    }
  })

  it('a la altura de siempre no toca la velocidad', () => {
    expect(hoopFallSpeed(DIFFICULTY_SPEEDS.hard, MACHINE_HEIGHT)).toBeCloseTo(
      DIFFICULTY_SPEEDS.hard,
      6,
    )
  })

  it('una altura imposible deja la velocidad como estaba', () => {
    // Antes que devolver 0 (el palo se quedaría colgando para siempre) o un
    // negativo (subiría), se juega con la velocidad de la dificultad.
    expect(hoopFallSpeed(1.2, STICK_MISS_Y)).toBe(1.2)
    expect(hoopFallSpeed(1.2, Number.NaN)).toBe(1.2)
  })
})

/** Almacenamiento de mentira, con lo justo que usa la altura del aro. */
function fakeStorage(initial?: string): Storage {
  const values = new Map<string, string>()
  if (initial !== undefined) values.set(HOOP_ADJUST_KEY, initial)
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => void values.set(key, value),
  } as unknown as Storage
}

/** El que tienen los navegadores en modo privado: lanza en vez de fallar. */
function blockedStorage(): Storage {
  return {
    getItem: () => {
      throw new DOMException('bloqueado', 'SecurityError')
    },
    setItem: () => {
      throw new DOMException('cuota agotada', 'QuotaExceededError')
    },
  } as unknown as Storage
}

describe('la corrección se recuerda entre visitas', () => {
  it('lee lo guardado', () => {
    expect(readHoopAdjustment(fakeStorage('-0.15'))).toBeCloseTo(-0.15, 6)
    expect(readHoopAdjustment(fakeStorage('0.1'))).toBeCloseTo(0.1, 6)
  })

  it('descarta lo que no es una corrección', () => {
    expect(parseHoopAdjustment(null)).toBe(0)
    expect(parseHoopAdjustment('')).toBe(0)
    expect(parseHoopAdjustment('   ')).toBe(0)
    expect(parseHoopAdjustment('un palmo')).toBe(0)
    expect(parseHoopAdjustment('Infinity')).toBe(0)
  })

  it('acota lo guardado a mano desde el navegador', () => {
    // Editarlo desde las herramientas del navegador no puede colocar el aro
    // fuera de lo que el propio menú permite.
    expect(parseHoopAdjustment('99')).toBe(HOOP_ADJUST_RANGE)
    expect(parseHoopAdjustment('-99')).toBe(-HOOP_ADJUST_RANGE)
  })

  it('escribe la corrección en su clave', () => {
    const storage = fakeStorage()
    writeHoopAdjustment(storage, -0.1)
    expect(storage.getItem(HOOP_ADJUST_KEY)).toBe('-0.1')
  })

  it('no guarda nada que la lectura fuera a descartar', () => {
    const storage = fakeStorage()
    const setItem = vi.spyOn(storage, 'setItem')

    writeHoopAdjustment(storage, Number.NaN)
    writeHoopAdjustment(storage, Number.POSITIVE_INFINITY)

    expect(setItem).not.toHaveBeenCalled()
  })

  it('guarda acotado lo que se pase de rango', () => {
    const storage = fakeStorage()
    writeHoopAdjustment(storage, 5)
    expect(storage.getItem(HOOP_ADJUST_KEY)).toBe(String(HOOP_ADJUST_RANGE))
  })

  it('sin almacenamiento se juega con el aro donde lo deje el visor', () => {
    expect(readHoopAdjustment(null)).toBe(0)
    expect(() => writeHoopAdjustment(null, 0.1)).not.toThrow()
  })

  it('un almacenamiento bloqueado no rompe la partida', () => {
    expect(readHoopAdjustment(blockedStorage())).toBe(0)
    expect(() => writeHoopAdjustment(blockedStorage(), 0.1)).not.toThrow()
  })
})
