import { describe, expect, it, vi } from 'vitest'
import { MAX_STICKS } from './gameConfig'
import {
  catchFrequency,
  countdownFrequency,
  createSoundEngine,
  MASTER_GAIN,
  soundVoices,
  type Sound,
} from './sound'

/** Todos los sonidos del juego, para las reglas que valen para cualquiera. */
const EVERY_SOUND: Sound[] = [
  { name: 'catch', streak: 1 },
  { name: 'catch', streak: MAX_STICKS },
  { name: 'miss' },
  { name: 'countdown', secondsLeft: 3 },
  { name: 'countdown', secondsLeft: 1 },
  { name: 'go' },
  { name: 'over', outcome: 'win' },
  { name: 'over', outcome: 'loss' },
  { name: 'over', outcome: 'close' },
  { name: 'record' },
]

describe('recetas de los sonidos', () => {
  it('el acierto sube de tono con la racha', () => {
    expect(catchFrequency(2)).toBeGreaterThan(catchFrequency(1))
    expect(catchFrequency(5)).toBeGreaterThan(catchFrequency(4))
  })

  it('la subida del acierto tiene tope', () => {
    // Sin tope, una racha larga acabaría chillando: 13 palos son 12 semitonos,
    // una octava entera, y el armónico se iría por encima de los 2,6 kHz.
    expect(catchFrequency(MAX_STICKS)).toBe(catchFrequency(100))
  })

  it('el tic de la cuenta sube conforme se acerca la salida', () => {
    expect(countdownFrequency(1)).toBeGreaterThan(countdownFrequency(2))
    expect(countdownFrequency(2)).toBeGreaterThan(countdownFrequency(3))
  })

  it('una cuenta atrás más larga no empieza más grave, solo tarda más', () => {
    // La tensión se reparte en los tres últimos segundos; los anteriores
    // comparten tono en vez de arrastrar la nota hacia lo inaudible.
    expect(countdownFrequency(6)).toBe(countdownFrequency(3))
  })

  it('el acierto asciende y el fallo desciende', () => {
    // Que no se distingan solo por el tono: con el visor puesto no siempre se
    // está mirando el palo que cae.
    for (const voice of soundVoices({ name: 'catch', streak: 1 })) {
      expect(voice.to).toBeGreaterThan(voice.from)
    }
    for (const voice of soundVoices({ name: 'miss' })) {
      expect(voice.to).toBeLessThan(voice.from)
    }
  })

  it('el fallo es más grave que el acierto', () => {
    const highestMiss = Math.max(
      ...soundVoices({ name: 'miss' }).map((voice) => voice.from),
    )
    const lowestCatch = Math.min(
      ...soundVoices({ name: 'catch', streak: 1 }).map((voice) => voice.from),
    )
    expect(highestMiss).toBeLessThan(lowestCatch)
  })

  it('el fallo dura más que el acierto: se oye en medio de una racha', () => {
    const missDuration = Math.max(
      ...soundVoices({ name: 'miss' }).map((voice) => voice.duration),
    )
    const catchDuration = Math.max(
      ...soundVoices({ name: 'catch', streak: 1 }).map((voice) => voice.duration),
    )
    expect(missDuration).toBeGreaterThan(catchDuration)
  })

  it('ninguna voz se sale del rango que el oído agradece', () => {
    const streaks = Array.from({ length: MAX_STICKS }, (_, i) => i + 1)
    const sounds: Sound[] = [
      ...EVERY_SOUND,
      ...streaks.map((streak): Sound => ({ name: 'catch', streak })),
    ]

    for (const sound of sounds) {
      for (const voice of soundVoices(sound)) {
        expect(voice.from).toBeGreaterThan(60)
        expect(voice.to).toBeGreaterThan(60)
        expect(voice.from).toBeLessThan(2100)
        expect(voice.to).toBeLessThan(2100)
      }
    }
  })

  it('un dato imposible no deja el sonido en silencio ni en ultrasonidos', () => {
    for (const streak of [Number.NaN, 0, -3]) {
      expect(catchFrequency(streak)).toBeGreaterThan(60)
      expect(catchFrequency(streak)).toBeLessThan(2100)
    }
    for (const seconds of [Number.NaN, 0, -3]) {
      expect(countdownFrequency(seconds)).toBeGreaterThan(60)
      expect(countdownFrequency(seconds)).toBeLessThan(2100)
    }
  })

  it('ningún sonido satura el volumen general', () => {
    // Las voces se suman en el nodo maestro: pasar de 1 recorta la onda y
    // suena a distorsión, no a más volumen. Lo que se suma es lo que suena **a
    // la vez**: un arpegio de tres notas encadenadas no satura nada, y sumarlo
    // entero prohibiría cualquier sonido que no sea un golpe.
    for (const sound of EVERY_SOUND) {
      const voices = soundVoices(sound)
      expect(voices.length).toBeGreaterThan(0)

      const instantes = voices.flatMap((voice) => [voice.delay, voice.delay + voice.duration / 2])
      const simultaneo = Math.max(
        ...instantes.map((t) =>
          voices
            .filter((voice) => t >= voice.delay && t < voice.delay + voice.duration)
            .reduce((sum, voice) => sum + voice.gain, 0),
        ),
      )

      expect(simultaneo).toBeGreaterThan(0)
      expect(simultaneo).toBeLessThanOrEqual(1)
    }
  })

  it('toda voz dura algo', () => {
    for (const sound of EVERY_SOUND) {
      expect(soundVoices(sound).length).toBeGreaterThan(0)
      for (const voice of soundVoices(sound)) {
        expect(voice.duration).toBeGreaterThan(0)
        expect(voice.delay).toBeGreaterThanOrEqual(0)
      }
    }
  })
})

/* --- Doble de la Web Audio API ------------------------------------------ */
// jsdom no la implementa, así que el motor se prueba contra un contexto de
// mentira que anota lo que se le pide.

interface ParamCall {
  method: 'set' | 'ramp'
  value: number
  time: number
}

class FakeParam {
  value = 0
  calls: ParamCall[] = []

  setValueAtTime(value: number, time: number) {
    this.calls.push({ method: 'set', value, time })
    return this
  }

  exponentialRampToValueAtTime(value: number, time: number) {
    this.calls.push({ method: 'ramp', value, time })
    return this
  }
}

class FakeNode {
  connections: FakeNode[] = []
  disconnected = 0

  connect(target: FakeNode) {
    this.connections.push(target)
    return target
  }

  disconnect() {
    this.disconnected++
  }
}

class FakeGain extends FakeNode {
  gain = new FakeParam()
}

class FakeOscillator extends FakeNode {
  type = 'sine'
  frequency = new FakeParam()
  startedAt: number | null = null
  stoppedAt: number | null = null
  onended: (() => void) | null = null

  start(time: number) {
    this.startedAt = time
  }

  stop(time: number) {
    this.stoppedAt = time
  }
}

class FakeAudioContext {
  currentTime = 10
  state: AudioContextState = 'running'
  destination = new FakeNode()
  oscillators: FakeOscillator[] = []
  gains: FakeGain[] = []
  resume = vi.fn(() => Promise.resolve())

  createOscillator() {
    const oscillator = new FakeOscillator()
    this.oscillators.push(oscillator)
    return oscillator
  }

  createGain() {
    const gain = new FakeGain()
    this.gains.push(gain)
    return gain
  }
}

function fakeContext() {
  const context = new FakeAudioContext()
  return { context, engine: createSoundEngine(context as unknown as AudioContext) }
}

describe('motor de sonido', () => {
  it('crea un oscilador por voz y lo programa dentro de su ventana', () => {
    const { context, engine } = fakeContext()
    const voices = soundVoices({ name: 'catch', streak: 1 })

    engine.play({ name: 'catch', streak: 1 })

    expect(context.oscillators).toHaveLength(voices.length)
    context.oscillators.forEach((oscillator, index) => {
      const voice = voices[index]
      expect(oscillator.type).toBe(voice.type)
      expect(oscillator.startedAt).toBe(context.currentTime + voice.delay)
      // Programar la parada es lo que impide que el oscilador siga sonando
      // para siempre: no hay quien lo apague después.
      expect(oscillator.stoppedAt).toBe(
        context.currentTime + voice.delay + voice.duration,
      )
    })
  })

  it('todo lo que suena pasa por el volumen general', () => {
    const { context, engine } = fakeContext()
    const master = context.gains[0]

    engine.play({ name: 'go' })

    expect(master.connections).toContain(context.destination)
    for (const oscillator of context.oscillators) {
      const envelope = oscillator.connections[0]
      expect(envelope.connections).toContain(master)
    }
  })

  it('ninguna rampa exponencial apunta a cero', () => {
    // `exponentialRampToValueAtTime(0)` lanza excepción y deja la partida sin
    // sonido a partir de ahí. Vale para el volumen y para la frecuencia.
    const { context, engine } = fakeContext()

    for (const sound of EVERY_SOUND) engine.play(sound)

    const ramps = [
      ...context.gains.flatMap((gain) => gain.gain.calls),
      ...context.oscillators.flatMap((oscillator) => oscillator.frequency.calls),
    ]
    expect(ramps.length).toBeGreaterThan(0)
    for (const call of ramps) {
      expect(call.value).toBeGreaterThan(0)
    }
  })

  it('suelta los nodos en cuanto el sonido calla', () => {
    // Una partida de 13 palos crea decenas de osciladores; sin esto se quedan
    // todos colgando del maestro.
    const { context, engine } = fakeContext()
    engine.play({ name: 'catch', streak: 3 })

    for (const oscillator of context.oscillators) {
      expect(oscillator.disconnected).toBe(0)
      oscillator.onended?.()
      expect(oscillator.disconnected).toBe(1)
      expect(oscillator.connections[0].disconnected).toBe(1)
    }
  })

  it('con el contexto cerrado no intenta sonar', () => {
    // Pasa al abandonar la página con una partida en marcha.
    const { context, engine } = fakeContext()
    context.state = 'closed'

    engine.play({ name: 'miss' })

    expect(context.oscillators).toHaveLength(0)
    // Un contexto cerrado no se reanuda: pedirlo lanza excepción.
    expect(context.resume).not.toHaveBeenCalled()
  })

  it('con el contexto suspendido calla y pide el audio de vuelta', () => {
    // Pasa al quitarse el visor a media partida: el reloj del contexto se para
    // y todo lo que se programe se amontona en el mismo instante. Sin esto, los
    // palos perdidos mientras tanto sonarían de golpe al volver a ponérselo.
    const { context, engine } = fakeContext()
    context.state = 'suspended'

    engine.play({ name: 'miss' })
    engine.play({ name: 'miss' })

    expect(context.oscillators).toHaveLength(0)
    expect(context.resume).toHaveBeenCalled()
  })
})

describe('soltar el motor de sonido', () => {
  it('suelta el maestro del que cuelga todo', () => {
    // Cada juego montado en el salón trae el suyo: si no se soltara al quitar
    // la escena, los nodos se irían acumulando en el contexto del anfitrión.
    const { context, engine } = fakeContext()
    const master = context.gains[0]

    engine.dispose()

    expect(master.disconnected).toBe(1)
  })
})

describe('el volumen de los efectos del arcade', () => {
  it('nace en el que se eligió, sin tener que tocar nada después', () => {
    const context = new FakeAudioContext()
    createSoundEngine(context as unknown as AudioContext, 0.5)

    // El maestro es el primero que se crea: es el que cuelga del destino.
    expect(context.gains[0].gain.value).toBeCloseTo(MASTER_GAIN * 0.5, 6)
  })

  it('se cambia sin rehacer el audio', () => {
    // Mover el deslizador en el arcade no puede cerrar el contexto y abrir
    // otro: sería un corte de sonido por cada empujón.
    const { context, engine } = fakeContext()

    engine.setVolume(0.25)

    expect(context.gains[0].gain.value).toBeCloseTo(MASTER_GAIN * 0.25, 6)
  })

  it('no se sale de lo que el navegador admite', () => {
    // Lo que llega son ajustes de fuera: un número imposible subiría la
    // ganancia por encima de uno y eso satura, no suena más alto.
    const { context, engine } = fakeContext()

    engine.setVolume(4)
    expect(context.gains[0].gain.value).toBeCloseTo(MASTER_GAIN, 6)

    engine.setVolume(-1)
    expect(context.gains[0].gain.value).toBe(0)
  })
})

describe('el cierre de la partida', () => {
  /** La nota más aguda de un sonido, que es por donde se reconoce a dónde va. */
  const agudo = (sound: Sound) =>
    Math.max(...soundVoices(sound).map((voice) => Math.max(voice.from, voice.to)))
  const grave = (sound: Sound) =>
    Math.min(...soundVoices(sound).map((voice) => Math.min(voice.from, voice.to)))
  const dura = (sound: Sound) =>
    Math.max(...soundVoices(sound).map((voice) => voice.delay + voice.duration))

  it('ganar sube y perder baja, que es lo que el oído entiende solo', () => {
    const ganar = soundVoices({ name: 'over', outcome: 'win' })
    const perder = soundVoices({ name: 'over', outcome: 'loss' })

    // La última voz de ganar es la más aguda de las tres; la de perder, la más grave.
    expect(ganar[ganar.length - 1].to).toBeGreaterThan(ganar[0].from)
    expect(perder[perder.length - 1].to).toBeLessThan(perder[0].from)
  })

  it('terminar sin más no dice ni bien ni mal', () => {
    // En práctica no hay nada que ganar ni que perder: el cierre solo avisa de que se
    // acabó, así que se queda entre los otros dos.
    const cerrar = agudo({ name: 'over', outcome: 'close' })

    expect(cerrar).toBeLessThan(agudo({ name: 'over', outcome: 'win' }))
    expect(grave({ name: 'over', outcome: 'close' })).toBeGreaterThan(
      grave({ name: 'over', outcome: 'loss' }),
    )
  })

  it('los tres duran más que atrapar o perder un palo', () => {
    // Un final que dure lo que un acierto se confunde con un acierto, y con el visor
    // puesto el marcador está donde uno no siempre está mirando.
    const palo = Math.max(dura({ name: 'catch', streak: 1 }), dura({ name: 'miss' }))

    for (const outcome of ['win', 'loss', 'close'] as const) {
      expect(dura({ name: 'over', outcome })).toBeGreaterThan(palo)
    }
  })

  it('el récord suena por encima de todo lo demás y después del cierre', () => {
    // Va aparte del cierre porque batir la marca puede pasar ganando o terminando sin
    // más, y hay que oír las dos cosas.
    const record = soundVoices({ name: 'record' })

    expect(grave({ name: 'record' })).toBeGreaterThan(agudo({ name: 'over', outcome: 'win' }))
    expect(record[0].delay).toBeGreaterThan(0.3)
  })
})
