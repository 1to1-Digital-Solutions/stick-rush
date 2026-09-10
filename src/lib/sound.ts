/**
 * Sonido del juego.
 *
 * Los sonidos se **sintetizan** con la Web Audio API en vez de reproducir
 * ficheros. No es una floritura: el juego tiene que funcionar en un visor sin
 * salida a internet y la CSP cierra el paso a cualquier CDN, así que un
 * `.mp3` habría que servirlo desde `public/` y añadir `media-src` a la
 * política. Cuatro osciladores no pesan nada, no se descargan y suenan igual
 * dentro de la sesión inmersiva que en el navegador.
 *
 * Este módulo es la **receta**: qué voces tiene cada sonido y con qué forma.
 * Son datos puros, así que se pueden probar sin navegador; el `SoundEngine`
 * de abajo es lo único que toca la Web Audio API.
 */

/** Qué acaba de pasar en la partida. */
export type Sound =
  /** Palo atrapado. Sube de tono con la racha. */
  | { name: 'catch'; streak: number }
  /** Palo perdido: ha tocado el suelo. */
  | { name: 'miss' }
  /** Un segundo de la cuenta atrás. */
  | { name: 'countdown'; secondsLeft: number }
  /** Se acabó la cuenta: empieza a caer el primer palo. */
  | { name: 'go' }

/** Una voz del sonido: un oscilador con su envolvente. */
export interface ToneSpec {
  type: OscillatorType
  /** Frecuencia inicial, en Hz. */
  from: number
  /** Frecuencia final: si difiere de `from`, el tono se desliza hasta ella. */
  to: number
  /** Cuánto suena, en segundos. */
  duration: number
  /** Volumen de pico, de 0 a 1, relativo al volumen general. */
  gain: number
  /** Retardo desde que se dispara el sonido, en segundos. */
  delay: number
}

/**
 * Volumen general, de 0 a 1.
 *
 * **El mismo número en los trece juegos**, y ese es el punto: el volumen de efectos se elige
 * una vez en el arcade y saltar de cabina no puede cambiar lo que se oye. Estaba en 0,28 en
 * ocho, 0,40 en tres y 0,45 en dos —con este mismo comentario en todos—, así que la misma
 * posición del deslizador sonaba tres o cuatro decibelios distinta según el juego.
 *
 * Por debajo de la mitad a propósito: se juega con un visor puesto y el sonido va a un palmo
 * de las orejas. Si un juego suena flojo o fuerte comparado con los demás, lo que hay que
 * mover es **su receta**, no este número: moverlo aquí vuelve a descuadrar los trece.
 */
export const MASTER_GAIN = 0.35

/** Frecuencia `semitones` semitonos por encima de `base`. */
function transpose(base: number, semitones: number): number {
  return base * Math.pow(2, semitones / 12)
}

/** Nota del primer palo atrapado. */
const CATCH_ROOT_HZ = 660
/** Cuánto sube el acierto por cada palo encadenado. */
const CATCH_STEP_SEMITONES = 1
/**
 * Tope de la subida: una quinta por encima de la nota inicial, o sea 989 Hz.
 * Sin él, una racha de 13 palos llegaría a 1320 Hz y su armónico —una octava
 * más arriba— a 2640, ya en la banda que más taladra; y en el visor el sonido
 * va pegado a los oídos. Con el tope la racha deja de subir en el octavo palo,
 * que es donde el oído ya ha dado la subida por buena.
 */
const CATCH_MAX_SEMITONES = 7

/** Nota del primer tic de la cuenta atrás. */
const COUNTDOWN_ROOT_HZ = 494
/** Cuánto sube el tic por cada segundo que se acerca la salida. */
const COUNTDOWN_STEP_SEMITONES = 2
/**
 * Cuántos tics de subida hay antes de la salida. Los segundos anteriores
 * comparten el tono grave: la tensión empieza a contar en los tres últimos,
 * que es lo que dura la cuenta.
 */
const COUNTDOWN_STEPS = 2

/**
 * Nota del acierto según la racha: cada palo encadenado sube un semitono hasta
 * el tope. Es la única confirmación sonora de que la racha sigue viva.
 *
 * @param streak palos consecutivos atrapados **incluido** el actual
 */
export function catchFrequency(streak: number): number {
  if (!Number.isFinite(streak)) return CATCH_ROOT_HZ
  const steps = Math.max(0, Math.round(streak) - 1) * CATCH_STEP_SEMITONES
  return transpose(CATCH_ROOT_HZ, Math.min(steps, CATCH_MAX_SEMITONES))
}

/**
 * Nota del tic de la cuenta atrás: sube conforme se acerca la salida, para que
 * el jugador sepa cuánto queda sin mirar el número (que en el visor, además, no
 * existe: allí la cuenta son anillos).
 *
 * @param secondsLeft segundos que faltan para el primer palo
 */
export function countdownFrequency(secondsLeft: number): number {
  if (!Number.isFinite(secondsLeft)) return COUNTDOWN_ROOT_HZ
  const remaining = Math.max(1, Math.round(secondsLeft))
  const step = Math.min(COUNTDOWN_STEPS, remaining - 1)
  return transpose(
    COUNTDOWN_ROOT_HZ,
    (COUNTDOWN_STEPS - step) * COUNTDOWN_STEP_SEMITONES,
  )
}

/**
 * Las voces que componen un sonido.
 *
 * Acierto y fallo se distinguen por más de una cosa a la vez —el acierto sube,
 * es agudo y breve; el fallo baja, es grave y áspero—, igual que en la escena
 * el acierto es un destello verde y el fallo un palo rojo en el suelo. Con el
 * visor puesto no siempre se está mirando al palo que cae.
 */
export function soundVoices(sound: Sound): ToneSpec[] {
  switch (sound.name) {
    case 'catch': {
      const root = catchFrequency(sound.streak)
      return [
        // Un "ding" que salta a la quinta, con un armónico encima que le da el
        // brillo del metal sin tener que subir el volumen.
        { type: 'triangle', from: root, to: root * 1.5, duration: 0.16, gain: 0.7, delay: 0 },
        { type: 'sine', from: root * 1.5, to: root * 2, duration: 0.11, gain: 0.3, delay: 0.01 },
      ]
    }
    case 'miss':
      return [
        // Cae y se apaga: dura casi el doble que el acierto, así que un fallo
        // se oye aunque llegue en medio de una racha.
        { type: 'sawtooth', from: 320, to: 110, duration: 0.34, gain: 0.45, delay: 0 },
        { type: 'sine', from: 160, to: 72, duration: 0.38, gain: 0.35, delay: 0 },
      ]
    case 'countdown': {
      // Seco y corto, como un metrónomo: marca el segundo sin taparlo.
      const tick = countdownFrequency(sound.secondsLeft)
      return [
        { type: 'square', from: tick, to: tick, duration: 0.07, gain: 0.35, delay: 0 },
      ]
    }
    case 'go':
      return [
        // La salida: sube, y es lo más largo y sonoro del juego.
        { type: 'triangle', from: 880, to: 1320, duration: 0.26, gain: 0.6, delay: 0 },
        { type: 'sine', from: 440, to: 660, duration: 0.3, gain: 0.35, delay: 0 },
      ]
  }
}

/** Reproduce los sonidos del juego. Lo único que habla con Web Audio. */
export interface SoundEngine {
  play(sound: Sound): void
  /** Suelta el nodo maestro. El contexto lo cierra quien lo creó. */
  dispose(): void
  /**
   * Cuánto de todo esto se oye, de 0 a 1: el volumen de efectos de los ajustes
   * del arcade. Multiplica al maestro del juego y no lo sustituye.
   */
  setVolume(volume: number): void
}

/** Ataque de la envolvente, en segundos. */
const ATTACK_SECONDS = 0.012

/**
 * Suelo de las rampas de volumen. No es 0 porque
 * `exponentialRampToValueAtTime(0)` lanza excepción, y una rampa exponencial es
 * lo que hace que el sonido se apague como lo oye el oído en vez de cortarse.
 */
const SILENCE = 0.0001

/**
 * @param volume de 0 a 1, el volumen de efectos de los ajustes del arcade. Va
 *   multiplicando al maestro del juego y no sustituyéndolo: `MASTER_GAIN` dice
 *   cuánto pega este juego en relación con los demás, y esto cuánto de eso
 *   quiere oír quien juega.
 */
export function createSoundEngine(context: AudioContext, volume = 1): SoundEngine {
  const master = context.createGain()
  let volumen = Math.min(1, Math.max(0, volume))
  master.gain.value = MASTER_GAIN * volumen
  master.connect(context.destination)

  return {
    play(sound: Sound) {
      // Solo suena un contexto en marcha. Cerrado (se abandona la página) ya no
      // acepta nodos; suspendido —el jugador se ha quitado el visor, o el
      // sistema le ha quitado el foco al navegador— sí los acepta, pero con el
      // reloj parado: los sonidos de media partida se amontonarían todos en el
      // mismo instante y sonarían de golpe, y a todo volumen, al reanudarlo.
      // Callar ese sonido y pedir el audio de vuelta deja el juego mudo un
      // momento en vez de dar un bocinazo en los oídos.
      if (context.state !== 'running') {
        if (context.state !== 'closed') void context.resume().catch(() => {})
        return
      }

      const now = context.currentTime
      for (const voice of soundVoices(sound)) {
        const oscillator = context.createOscillator()
        const envelope = context.createGain()
        const start = now + voice.delay
        const end = start + voice.duration
        const attack = Math.min(ATTACK_SECONDS, voice.duration / 3)

        oscillator.type = voice.type
        oscillator.frequency.setValueAtTime(voice.from, start)
        if (voice.to !== voice.from) {
          oscillator.frequency.exponentialRampToValueAtTime(voice.to, end)
        }

        // Sin ataque, pasar de silencio a volumen de golpe suena a chasquido.
        envelope.gain.setValueAtTime(SILENCE, start)
        envelope.gain.exponentialRampToValueAtTime(voice.gain, start + attack)
        envelope.gain.exponentialRampToValueAtTime(SILENCE, end)

        oscillator.connect(envelope)
        envelope.connect(master)
        oscillator.start(start)
        oscillator.stop(end)
        // Cada palo crea nodos nuevos: si no se sueltan al callar, una partida
        // de 13 los deja todos colgando del maestro.
        oscillator.onended = () => {
          oscillator.disconnect()
          envelope.disconnect()
        }
      }
    },

    /** Ver `setVolume` en la interfaz. */
    setVolume(value: number) {
      volumen = Math.min(1, Math.max(0, value))
      master.gain.value = MASTER_GAIN * volumen
    },

    dispose() {
      master.disconnect()
    },
  }
}
