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

/** All the sounds of the game, for the rules that hold for any of them. */
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
  { name: 'medal', rank: 0 },
  { name: 'medal', rank: 1 },
  { name: 'medal', rank: 2 },
]

describe('recipes of the sounds', () => {
  it('the catch goes up in pitch with the streak', () => {
    expect(catchFrequency(2)).toBeGreaterThan(catchFrequency(1))
    expect(catchFrequency(5)).toBeGreaterThan(catchFrequency(4))
  })

  it('the rise of the catch has a cap', () => {
    // Without a cap, a long streak would end up shrieking: 13 sticks are 12 semitones,
    // a whole octave, and the harmonic would go above 2.6 kHz.
    expect(catchFrequency(MAX_STICKS)).toBe(catchFrequency(100))
  })

  it('the tick of the count goes up as the start gets closer', () => {
    expect(countdownFrequency(1)).toBeGreaterThan(countdownFrequency(2))
    expect(countdownFrequency(2)).toBeGreaterThan(countdownFrequency(3))
  })

  it('a longer countdown does not start lower, it just takes longer', () => {
    // The tension is spread over the last three seconds; the earlier ones
    // share a tone instead of dragging the note towards the inaudible.
    expect(countdownFrequency(6)).toBe(countdownFrequency(3))
  })

  it('the catch ascends and the miss descends', () => {
    // So that they are not told apart only by the pitch: with the headset on you are not
    // always looking at the stick that falls.
    for (const voice of soundVoices({ name: 'catch', streak: 1 })) {
      expect(voice.to).toBeGreaterThan(voice.from)
    }
    for (const voice of soundVoices({ name: 'miss' })) {
      expect(voice.to).toBeLessThan(voice.from)
    }
  })

  it('the miss is lower than the catch', () => {
    const highestMiss = Math.max(
      ...soundVoices({ name: 'miss' }).map((voice) => voice.from),
    )
    const lowestCatch = Math.min(
      ...soundVoices({ name: 'catch', streak: 1 }).map((voice) => voice.from),
    )
    expect(highestMiss).toBeLessThan(lowestCatch)
  })

  it('the miss lasts longer than the catch: it is heard in the middle of a streak', () => {
    const missDuration = Math.max(
      ...soundVoices({ name: 'miss' }).map((voice) => voice.duration),
    )
    const catchDuration = Math.max(
      ...soundVoices({ name: 'catch', streak: 1 }).map((voice) => voice.duration),
    )
    expect(missDuration).toBeGreaterThan(catchDuration)
  })

  it('no voice leaves the range the ear is grateful for', () => {
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

  it('an impossible value does not leave the sound in silence nor in ultrasound', () => {
    for (const streak of [Number.NaN, 0, -3]) {
      expect(catchFrequency(streak)).toBeGreaterThan(60)
      expect(catchFrequency(streak)).toBeLessThan(2100)
    }
    for (const seconds of [Number.NaN, 0, -3]) {
      expect(countdownFrequency(seconds)).toBeGreaterThan(60)
      expect(countdownFrequency(seconds)).toBeLessThan(2100)
    }
  })

  it('no sound saturates the master volume', () => {
    // The voices add up in the master node: going past 1 clips the wave and
    // sounds like distortion, not like more volume. What adds up is what sounds **at
    // the same time**: an arpeggio of three chained notes saturates nothing, and adding it up
    // whole would forbid any sound that is not a hit.
    for (const sound of EVERY_SOUND) {
      const voices = soundVoices(sound)
      expect(voices.length).toBeGreaterThan(0)

      const instants = voices.flatMap((voice) => [voice.delay, voice.delay + voice.duration / 2])
      const simultaneous = Math.max(
        ...instants.map((t) =>
          voices
            .filter((voice) => t >= voice.delay && t < voice.delay + voice.duration)
            .reduce((sum, voice) => sum + voice.gain, 0),
        ),
      )

      expect(simultaneous).toBeGreaterThan(0)
      expect(simultaneous).toBeLessThanOrEqual(1)
    }
  })

  it('every voice lasts something', () => {
    for (const sound of EVERY_SOUND) {
      expect(soundVoices(sound).length).toBeGreaterThan(0)
      for (const voice of soundVoices(sound)) {
        expect(voice.duration).toBeGreaterThan(0)
        expect(voice.delay).toBeGreaterThanOrEqual(0)
      }
    }
  })
})

/* --- Double of the Web Audio API ---------------------------------------- */
// jsdom does not implement it, so the engine is tested against a fake
// context that notes down what it is asked for.

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

describe('sound engine', () => {
  it('creates one oscillator per voice and schedules it within its window', () => {
    const { context, engine } = fakeContext()
    const voices = soundVoices({ name: 'catch', streak: 1 })

    engine.play({ name: 'catch', streak: 1 })

    expect(context.oscillators).toHaveLength(voices.length)
    context.oscillators.forEach((oscillator, index) => {
      const voice = voices[index]
      expect(oscillator.type).toBe(voice.type)
      expect(oscillator.startedAt).toBe(context.currentTime + voice.delay)
      // Scheduling the stop is what prevents the oscillator from going on sounding
      // forever: there is no one to switch it off afterwards.
      expect(oscillator.stoppedAt).toBe(
        context.currentTime + voice.delay + voice.duration,
      )
    })
  })

  it('everything that sounds goes through the master volume', () => {
    const { context, engine } = fakeContext()
    const master = context.gains[0]

    engine.play({ name: 'go' })

    expect(master.connections).toContain(context.destination)
    for (const oscillator of context.oscillators) {
      const envelope = oscillator.connections[0]
      expect(envelope.connections).toContain(master)
    }
  })

  it('no exponential ramp points at zero', () => {
    // `exponentialRampToValueAtTime(0)` throws an exception and leaves the run without
    // sound from there on. It holds for the volume and for the frequency.
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

  it('disposes of the nodes as soon as the sound goes silent', () => {
    // A run of 13 sticks creates dozens of oscillators; without this they all stay
    // hanging from the master.
    const { context, engine } = fakeContext()
    engine.play({ name: 'catch', streak: 3 })

    for (const oscillator of context.oscillators) {
      expect(oscillator.disconnected).toBe(0)
      oscillator.onended?.()
      expect(oscillator.disconnected).toBe(1)
      expect(oscillator.connections[0].disconnected).toBe(1)
    }
  })

  it('with the context closed it does not try to sound', () => {
    // It happens on leaving the page with a run in progress.
    const { context, engine } = fakeContext()
    context.state = 'closed'

    engine.play({ name: 'miss' })

    expect(context.oscillators).toHaveLength(0)
    // A closed context is not resumed: asking for it throws an exception.
    expect(context.resume).not.toHaveBeenCalled()
  })

  it('with the context suspended it stays silent and asks for the audio back', () => {
    // It happens on taking the headset off in the middle of a run: the context's clock stops
    // and everything that is scheduled piles up at the same instant. Without this, the
    // sticks missed in the meantime would sound all at once on putting it back on.
    const { context, engine } = fakeContext()
    context.state = 'suspended'

    engine.play({ name: 'miss' })
    engine.play({ name: 'miss' })

    expect(context.oscillators).toHaveLength(0)
    expect(context.resume).toHaveBeenCalled()
  })
})

describe('disposing of the sound engine', () => {
  it('disposes of the master everything hangs from', () => {
    // Each game mounted in the hall brings its own: if it were not disposed of on removing
    // the scene, the nodes would pile up in the host's context.
    const { context, engine } = fakeContext()
    const master = context.gains[0]

    engine.dispose()

    expect(master.disconnected).toBe(1)
  })
})

describe('the volume of the arcade effects', () => {
  it('is born at the one that was chosen, without having to touch anything afterwards', () => {
    const context = new FakeAudioContext()
    createSoundEngine(context as unknown as AudioContext, 0.5)

    // The master is the first one created: it is the one that hangs from the destination.
    expect(context.gains[0].gain.value).toBeCloseTo(MASTER_GAIN * 0.5, 6)
  })

  it('is changed without rebuilding the audio', () => {
    // Moving the slider in the arcade cannot close the context and open
    // another: it would be a cut in the sound for each nudge.
    const { context, engine } = fakeContext()

    engine.setVolume(0.25)

    expect(context.gains[0].gain.value).toBeCloseTo(MASTER_GAIN * 0.25, 6)
  })

  it('does not leave what the browser accepts', () => {
    // What arrives are settings from outside: an impossible number would raise the
    // gain above one and that saturates, it does not sound louder.
    const { context, engine } = fakeContext()

    engine.setVolume(4)
    expect(context.gains[0].gain.value).toBeCloseTo(MASTER_GAIN, 6)

    engine.setVolume(-1)
    expect(context.gains[0].gain.value).toBe(0)
  })
})

describe('the closing of the run', () => {
  /** The highest note of a sound, which is how you recognise where it is going. */
  const highest = (sound: Sound) =>
    Math.max(...soundVoices(sound).map((voice) => Math.max(voice.from, voice.to)))
  const lowest = (sound: Sound) =>
    Math.min(...soundVoices(sound).map((voice) => Math.min(voice.from, voice.to)))
  const lasts = (sound: Sound) =>
    Math.max(...soundVoices(sound).map((voice) => voice.delay + voice.duration))

  it('winning goes up and losing goes down, which is what the ear understands on its own', () => {
    const win = soundVoices({ name: 'over', outcome: 'win' })
    const loss = soundVoices({ name: 'over', outcome: 'loss' })

    // The last voice of winning is the highest of the three; that of losing, the lowest.
    expect(win[win.length - 1].to).toBeGreaterThan(win[0].from)
    expect(loss[loss.length - 1].to).toBeLessThan(loss[0].from)
  })

  it('just finishing says neither good nor bad', () => {
    // In practice there is nothing to win nor to lose: the closing only warns that it is
    // over, so it stays between the other two.
    const closing = highest({ name: 'over', outcome: 'close' })

    expect(closing).toBeLessThan(highest({ name: 'over', outcome: 'win' }))
    expect(lowest({ name: 'over', outcome: 'close' })).toBeGreaterThan(
      lowest({ name: 'over', outcome: 'loss' }),
    )
  })

  it('the three last longer than catching or missing a stick', () => {
    // An ending that lasts what a catch does is confused with a catch, and with the headset
    // on the scoreboard is where one is not always looking.
    const stick = Math.max(lasts({ name: 'catch', streak: 1 }), lasts({ name: 'miss' }))

    for (const outcome of ['win', 'loss', 'close'] as const) {
      expect(lasts({ name: 'over', outcome })).toBeGreaterThan(stick)
    }
  })

  it('the record sounds above everything else and after the closing', () => {
    // It goes apart from the closing because beating the best can happen winning or just
    // finishing, and both things have to be heard.
    const record = soundVoices({ name: 'record' })

    expect(lowest({ name: 'record' })).toBeGreaterThan(highest({ name: 'over', outcome: 'win' }))
    expect(record[0].delay).toBeGreaterThan(0.3)
  })
})

describe('the medal threshold', () => {
  const notes = (rank: 0 | 1 | 2) => soundVoices({ name: 'medal', rank })

  it('is two short notes upwards, a fifth', () => {
    for (const rank of [0, 1, 2] as const) {
      const [first, second] = notes(rank)
      expect(notes(rank)).toHaveLength(2)
      expect(second.from).toBeCloseTo(first.from * 1.5)
      expect(second.delay).toBeGreaterThan(first.delay)
    }
  })

  it('higher the better the medal, without going past 2 kHz', () => {
    expect(notes(1)[0].from).toBeGreaterThan(notes(0)[0].from)
    expect(notes(2)[0].from).toBeGreaterThan(notes(1)[0].from)
    for (const rank of [0, 1, 2] as const) {
      for (const voice of notes(rank)) expect(Math.max(voice.from, voice.to)).toBeLessThan(2000)
    }
  })

  it('sounds after the catch that crossed it and ends long before a closing', () => {
    const catchVoices = soundVoices({ name: 'catch', streak: 1 })
    const catchEnd = Math.max(...catchVoices.map((voice) => voice.delay + voice.duration))
    const end = (voices: ReturnType<typeof soundVoices>) => Math.max(...voices.map((voice) => voice.delay + voice.duration))

    expect(notes(0)[0].delay).toBeGreaterThanOrEqual(catchEnd)
    expect(end(notes(2))).toBeLessThan(end(soundVoices({ name: 'over', outcome: 'win' })))
    expect(end(notes(2))).toBeLessThan(0.5)
  })
})
