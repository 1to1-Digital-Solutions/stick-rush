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
  /**
   * Se acabó la partida. `outcome` dice cómo, porque no todas acaban igual: un
   * nivel se aprueba o no, un desafío se pierde quedándose sin vidas, y en
   * práctica simplemente se termina.
   */
  | { name: 'over'; outcome: RoundOutcome }
  /** Y encima del cierre, si la partida ha batido la marca. */
  | { name: 'record' }
  /** Se cruza un listón de medalla: 0 el bronce, 1 la plata, 2 el oro. */
  | { name: 'medal'; rank: 0 | 1 | 2 }

/** Cómo ha acabado la partida. */
export type RoundOutcome = 'win' | 'loss' | 'close'

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
    case 'over':
      return closingVoices(sound.outcome)
    case 'record':
      return RECORD_VOICES
    case 'medal':
      return medalVoices(sound.rank)
  }
}

/** Lo que se espera a que suene el atrape que cruzó el listón, en segundos. */
const MEDAL_DELAY = 0.18
/** La nota de cada listón, en semitonos sobre la raíz: la tercera y la quinta del acorde de ganar. */
const MEDAL_SEMITONES = [0, 4, 7] as const

/**
 * El listón cruzado: dos notas cortas hacia arriba, una quinta, más agudas cuanto mejor es la
 * medalla. Corto a propósito —la partida sigue y los palos no esperan— y por debajo del cierre,
 * que es el que acaba. El oro se queda en 1.978 Hz: sin pasar de los 2 kHz, como todo lo demás.
 */
function medalVoices(rank: 0 | 1 | 2): ToneSpec[] {
  const base = transpose(880, MEDAL_SEMITONES[rank])
  return [base, base * 1.5].map((hz, index) => ({
    type: 'sine',
    from: hz,
    to: hz,
    duration: index === 0 ? 0.09 : 0.2,
    gain: 0.3,
    delay: MEDAL_DELAY + index * 0.09,
  }))
}

/**
 * El cierre de la partida.
 *
 * **Terminar era silencio.** Se acababa el último palo y no sonaba nada: la pantalla de fin
 * aparecía sin avisar, y con el visor puesto es peor todavía, porque el marcador está donde
 * uno no siempre está mirando. Un final tiene que oírse como un final.
 *
 * Los tres se distinguen por **hacia dónde van**, que es lo que el oído entiende sin haberlo
 * aprendido: ganar sube, perder baja, y terminar sin más se queda donde está. Y son largos y
 * de tres notas para que no se confundan con un acierto o un fallo, que duran un suspiro.
 */
function closingVoices(outcome: RoundOutcome): ToneSpec[] {
  const raiz = 440
  if (outcome === 'win') {
    // Acorde mayor subiendo: la tercera, la quinta y la octava.
    return [
      // Las notas se solapan por las colas, así que cada una va por debajo de lo que iría
      // sola: lo que satura el maestro es lo que suena **a la vez**, no el sonido entero.
      { type: 'triangle', from: raiz, to: raiz, duration: 0.22, gain: 0.35, delay: 0 },
      { type: 'triangle', from: transpose(raiz, 4), to: transpose(raiz, 4), duration: 0.22, gain: 0.35, delay: 0.12 },
      { type: 'triangle', from: transpose(raiz, 7), to: transpose(raiz, 12), duration: 0.42, gain: 0.4, delay: 0.24 },
      { type: 'sine', from: transpose(raiz, 12), to: transpose(raiz, 12), duration: 0.5, gain: 0.18, delay: 0.24 },
    ]
  }
  if (outcome === 'loss') {
    // Bajando y grave, con el sierra del fallo: es el mismo mundo sonoro que
    // perder un palo, pero el doble de largo y una tercera más abajo.
    return [
      { type: 'sawtooth', from: transpose(raiz, -5), to: transpose(raiz, -5), duration: 0.26, gain: 0.34, delay: 0 },
      { type: 'sawtooth', from: transpose(raiz, -9), to: transpose(raiz, -12), duration: 0.55, gain: 0.36, delay: 0.16 },
      { type: 'sine', from: transpose(raiz, -21), to: transpose(raiz, -24), duration: 0.6, gain: 0.26, delay: 0.16 },
    ]
  }
  // Terminar sin más: dos notas que se resuelven, sin subir ni caerse. Dice
  // «se acabó» sin decir «bien» ni «mal», que en práctica no lo hay.
  return [
    { type: 'triangle', from: transpose(raiz, 7), to: transpose(raiz, 7), duration: 0.2, gain: 0.4, delay: 0 },
    { type: 'triangle', from: raiz, to: raiz, duration: 0.4, gain: 0.42, delay: 0.14 },
  ]
}

/**
 * El récord, encima del cierre.
 *
 * Va **aparte** y no como un cuarto cierre: batir la marca puede pasar ganando o terminando
 * sin más, y lo que hay que oír son las dos cosas. Suena por encima, más agudo que nada del
 * juego y con un retardo que lo deja caer cuando el cierre ya se está apagando.
 */
const RECORD_VOICES: ToneSpec[] = [
  // Sin pasar de los 2 kHz, como todo lo demás: en el visor el sonido va a un palmo de las
  // orejas y ahí arriba deja de ser brillo y empieza a taladrar.
  { type: 'sine', from: 1320, to: 1320, duration: 0.12, gain: 0.3, delay: 0.42 },
  { type: 'sine', from: 1568, to: 1568, duration: 0.12, gain: 0.3, delay: 0.52 },
  { type: 'sine', from: 1760, to: 1976, duration: 0.34, gain: 0.32, delay: 0.62 },
]

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
