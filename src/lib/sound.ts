/**
 * Sound of the game.
 *
 * The sounds are **synthesised** with the Web Audio API instead of playing
 * files. It is not a flourish: the game has to work in a headset with no
 * way out to the internet and the CSP shuts out any CDN, so an
 * `.mp3` would have to be served from `public/` and `media-src` added to the
 * policy. Four oscillators weigh nothing, are not downloaded and sound the same
 * inside the immersive session as in the browser.
 *
 * This module is the **recipe**: which voices each sound has and with what shape.
 * They are pure data, so they can be tested without a browser; the `SoundEngine`
 * below is the only thing that touches the Web Audio API.
 */

/** What has just happened in the run. */
export type Sound =
  /** Stick caught. It goes up in pitch with the streak. */
  | { name: 'catch'; streak: number }
  /** Stick missed: it has touched the floor. */
  | { name: 'miss' }
  /** One second of the countdown. */
  | { name: 'countdown'; secondsLeft: number }
  /** The count is over: the first stick starts to fall. */
  | { name: 'go' }
  /**
   * The run is over. `outcome` says how, because not all end the same: a
   * level is passed or not, a challenge is lost by running out of lives, and in
   * practice it simply ends.
   */
  | { name: 'over'; outcome: RoundOutcome }
  /** And on top of the closing, if the run has beaten the best. */
  | { name: 'record' }
  /** A medal threshold is crossed: 0 the bronze, 1 the silver, 2 the gold. */
  | { name: 'medal'; rank: 0 | 1 | 2 }

/** How the run has ended. */
export type RoundOutcome = 'win' | 'loss' | 'close'

/** A voice of the sound: an oscillator with its envelope. */
export interface ToneSpec {
  type: OscillatorType
  /** Starting frequency, in Hz. */
  from: number
  /** Final frequency: if it differs from `from`, the tone glides to it. */
  to: number
  /** How long it sounds, in seconds. */
  duration: number
  /** Peak volume, from 0 to 1, relative to the master volume. */
  gain: number
  /** Delay from when the sound is triggered, in seconds. */
  delay: number
}

/**
 * Master volume, from 0 to 1.
 *
 * **The same number in the thirteen games**, and that is the point: the effects volume is chosen
 * once in the arcade and hopping cabinets cannot change what is heard. It was at 0.28 in
 * eight, 0.40 in three and 0.45 in two —with this same comment in all of them—, so the same
 * position of the slider sounded three or four decibels different depending on the game.
 *
 * Below half on purpose: you play with a headset on and the sound goes a hand's breadth
 * from the ears. If a game sounds weak or loud compared with the others, what has to
 * move is **its recipe**, not this number: moving it here throws the thirteen out of line again.
 */
export const MASTER_GAIN = 0.35

/** Frequency `semitones` semitones above `base`. */
function transpose(base: number, semitones: number): number {
  return base * Math.pow(2, semitones / 12)
}

/** Note of the first stick caught. */
const CATCH_ROOT_HZ = 660
/** How much the catch goes up for each chained stick. */
const CATCH_STEP_SEMITONES = 1
/**
 * Cap of the rise: a fifth above the starting note, that is 989 Hz.
 * Without it, a streak of 13 sticks would reach 1320 Hz and its harmonic —an octave
 * higher— 2640, already in the band that drills the most; and in the headset the sound
 * goes right against the ears. With the cap the streak stops rising at the eighth stick,
 * which is where the ear has already taken the rise as given.
 */
const CATCH_MAX_SEMITONES = 7

/** Note of the first tick of the countdown. */
const COUNTDOWN_ROOT_HZ = 494
/** How much the tick goes up for each second the start gets closer. */
const COUNTDOWN_STEP_SEMITONES = 2
/**
 * How many rising ticks there are before the start. The earlier seconds
 * share the low tone: the tension starts counting in the last three,
 * which is how long the count lasts.
 */
const COUNTDOWN_STEPS = 2

/**
 * Note of the catch according to the streak: each chained stick goes up a semitone up to
 * the cap. It is the only audible confirmation that the streak is still alive.
 *
 * @param streak consecutive sticks caught **including** the current one
 */
export function catchFrequency(streak: number): number {
  if (!Number.isFinite(streak)) return CATCH_ROOT_HZ
  const steps = Math.max(0, Math.round(streak) - 1) * CATCH_STEP_SEMITONES
  return transpose(CATCH_ROOT_HZ, Math.min(steps, CATCH_MAX_SEMITONES))
}

/**
 * Note of the countdown tick: it goes up as the start gets closer, so that
 * the player knows how much is left without looking at the number (which in the headset, besides, does
 * not exist: there the count is rings).
 *
 * @param secondsLeft seconds left until the first stick
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
 * The voices that make up a sound.
 *
 * Catch and miss are told apart by more than one thing at once —the catch goes up,
 * is high and brief; the miss goes down, is low and rough—, just as in the scene
 * the catch is a green flash and the miss a red stick on the floor. With the
 * headset on you are not always looking at the stick that falls.
 */
export function soundVoices(sound: Sound): ToneSpec[] {
  switch (sound.name) {
    case 'catch': {
      const root = catchFrequency(sound.streak)
      return [
        // A "ding" that jumps to the fifth, with a harmonic on top that gives it the
        // shine of metal without having to raise the volume.
        { type: 'triangle', from: root, to: root * 1.5, duration: 0.16, gain: 0.7, delay: 0 },
        { type: 'sine', from: root * 1.5, to: root * 2, duration: 0.11, gain: 0.3, delay: 0.01 },
      ]
    }
    case 'miss':
      return [
        // It falls and fades: it lasts almost twice as long as the catch, so a miss
        // is heard even if it comes in the middle of a streak.
        { type: 'sawtooth', from: 320, to: 110, duration: 0.34, gain: 0.45, delay: 0 },
        { type: 'sine', from: 160, to: 72, duration: 0.38, gain: 0.35, delay: 0 },
      ]
    case 'countdown': {
      // Dry and short, like a metronome: it marks the second without covering it.
      const tick = countdownFrequency(sound.secondsLeft)
      return [
        { type: 'square', from: tick, to: tick, duration: 0.07, gain: 0.35, delay: 0 },
      ]
    }
    case 'go':
      return [
        // The start: it goes up, and it is the longest and most sonorous thing in the game.
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

/** What is waited for the catch that crossed the threshold to sound, in seconds. */
const MEDAL_DELAY = 0.18
/** The note of each threshold, in semitones over the root: the third and the fifth of the winning chord. */
const MEDAL_SEMITONES = [0, 4, 7] as const

/**
 * The threshold crossed: two short notes upwards, a fifth, higher the better the
 * medal. Short on purpose —the run goes on and the sticks do not wait— and below the closing,
 * which is the one that ends. The gold stays at 1,978 Hz: without going past 2 kHz, like everything else.
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
 * The closing of the run.
 *
 * **Finishing was silence.** The last stick was over and nothing sounded: the end
 * screen appeared without warning, and with the headset on it is even worse, because the scoreboard is where
 * one is not always looking. An ending has to be heard as an ending.
 *
 * The three are told apart by **where they go**, which is what the ear understands without having
 * learned it: winning goes up, losing goes down, and just finishing stays where it is. And they are long and
 * of three notes so that they are not confused with a catch or a miss, which last a sigh.
 */
function closingVoices(outcome: RoundOutcome): ToneSpec[] {
  const root = 440
  if (outcome === 'win') {
    // Major chord going up: the third, the fifth and the octave.
    return [
      // The notes overlap at the tails, so each one goes below what it would on its
      // own: what saturates the master is what sounds **at the same time**, not the whole sound.
      { type: 'triangle', from: root, to: root, duration: 0.22, gain: 0.35, delay: 0 },
      { type: 'triangle', from: transpose(root, 4), to: transpose(root, 4), duration: 0.22, gain: 0.35, delay: 0.12 },
      { type: 'triangle', from: transpose(root, 7), to: transpose(root, 12), duration: 0.42, gain: 0.4, delay: 0.24 },
      { type: 'sine', from: transpose(root, 12), to: transpose(root, 12), duration: 0.5, gain: 0.18, delay: 0.24 },
    ]
  }
  if (outcome === 'loss') {
    // Going down and low, with the sawtooth of the miss: it is the same sound world as
    // losing a stick, but twice as long and a third lower.
    return [
      { type: 'sawtooth', from: transpose(root, -5), to: transpose(root, -5), duration: 0.26, gain: 0.34, delay: 0 },
      { type: 'sawtooth', from: transpose(root, -9), to: transpose(root, -12), duration: 0.55, gain: 0.36, delay: 0.16 },
      { type: 'sine', from: transpose(root, -21), to: transpose(root, -24), duration: 0.6, gain: 0.26, delay: 0.16 },
    ]
  }
  // Just finishing: two notes that resolve, without going up nor falling. It says
  // «it's over» without saying «good» or «bad», which in practice there is none of.
  return [
    { type: 'triangle', from: transpose(root, 7), to: transpose(root, 7), duration: 0.2, gain: 0.4, delay: 0 },
    { type: 'triangle', from: root, to: root, duration: 0.4, gain: 0.42, delay: 0.14 },
  ]
}

/**
 * The record, on top of the closing.
 *
 * It goes **apart** and not as a fourth closing: beating the best can happen winning or just
 * finishing, and what has to be heard is both things. It sounds on top, higher than anything in the
 * game and with a delay that lets it drop when the closing is already fading.
 */
const RECORD_VOICES: ToneSpec[] = [
  // Without going past 2 kHz, like everything else: in the headset the sound goes a hand's breadth from the
  // ears and up there it stops being shine and starts to drill.
  { type: 'sine', from: 1320, to: 1320, duration: 0.12, gain: 0.3, delay: 0.42 },
  { type: 'sine', from: 1568, to: 1568, duration: 0.12, gain: 0.3, delay: 0.52 },
  { type: 'sine', from: 1760, to: 1976, duration: 0.34, gain: 0.32, delay: 0.62 },
]

/** Plays the sounds of the game. The only thing that talks to Web Audio. */
export interface SoundEngine {
  play(sound: Sound): void
  /** Disposes of the master node. The context is closed by whoever created it. */
  dispose(): void
  /**
   * How much of all this is heard, from 0 to 1: the effects volume of the arcade's
   * settings. It multiplies the game's master and does not replace it.
   */
  setVolume(volume: number): void
}

/** Attack of the envelope, in seconds. */
const ATTACK_SECONDS = 0.012

/**
 * Floor of the volume ramps. It is not 0 because
 * `exponentialRampToValueAtTime(0)` throws an exception, and an exponential ramp is
 * what makes the sound fade the way the ear hears it instead of being cut off.
 */
const SILENCE = 0.0001

/**
 * @param volume from 0 to 1, the effects volume of the arcade's settings. It goes
 *   multiplying the game's master and not replacing it: `MASTER_GAIN` says
 *   how hard this game hits in relation to the others, and this how much of that
 *   whoever plays wants to hear.
 */
export function createSoundEngine(context: AudioContext, volume = 1): SoundEngine {
  const master = context.createGain()
  let level = Math.min(1, Math.max(0, volume))
  master.gain.value = MASTER_GAIN * level
  master.connect(context.destination)

  return {
    play(sound: Sound) {
      // Only a running context sounds. Closed (the page is being left) it no longer
      // accepts nodes; suspended —the player has taken the headset off, or the
      // system has taken the focus away from the browser— it does accept them, but with the
      // clock stopped: the sounds of half a run would all pile up at the
      // same instant and sound all at once, and at full volume, on resuming it.
      // Silencing that sound and asking for the audio back leaves the game mute for a
      // moment instead of blasting a horn in the ears.
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

        // Without an attack, going from silence to volume all at once sounds like a click.
        envelope.gain.setValueAtTime(SILENCE, start)
        envelope.gain.exponentialRampToValueAtTime(voice.gain, start + attack)
        envelope.gain.exponentialRampToValueAtTime(SILENCE, end)

        oscillator.connect(envelope)
        envelope.connect(master)
        oscillator.start(start)
        oscillator.stop(end)
        // Each stick creates new nodes: if they are not disposed of on going silent, a run
        // of 13 leaves them all hanging from the master.
        oscillator.onended = () => {
          oscillator.disconnect()
          envelope.disconnect()
        }
      }
    },

    /** See `setVolume` in the interface. */
    setVolume(value: number) {
      level = Math.min(1, Math.max(0, value))
      master.gain.value = MASTER_GAIN * level
    },

    dispose() {
      master.disconnect()
    },
  }
}
