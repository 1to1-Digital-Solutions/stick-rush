'use client'

import { useEffect, useRef, useState } from 'react'
import { type GameState, useGame } from '../../lib/gameStore'
import { MEDALS, thresholdCrossed } from '../../lib/goal'
import { createSoundEngine, type RoundOutcome, type SoundEngine } from '../../lib/sound'

/**
 * Puts sound to the run: on catching, on missing and in the countdown.
 *
 * It listens to the state of the game instead of hooking onto the components, so
 * it sounds the same with the mouse as with the headset's controllers —which is where it is most
 * needed, because there there is no scoreboard to look at without taking the eyes off the sticks.
 *
 * It is mounted only once, in `GameScene`. With the effects at zero in the hall's
 * settings (`muted` of the store) it never gets to touch the Web Audio API.
 */
export function useGameSound() {
  const {
    gameState,
    countdown,
    score,
    resolved,
    streak,
    muted,
    sfxVolume,
    celebrates,
    duel,
    levelResult,
    lives,
    medal,
  } = useGame()
  const engineRef = useRef<SoundEngine | null>(null)
  // The hall's effects volume, kept apart to be able to apply it to the
  // engine without changing it creating it again.
  const sfxVolumeRef = useRef(sfxVolume)
  // The browser does not let anything play until the player has touched the page. It is
  // state and not a ref because creating the audio depends on it, and the gesture may
  // be the mute button itself: noting it in a render lets the
  // effect see both things at once and not open a context to close it right
  // afterwards.
  const [interacted, setInteracted] = useState(false)
  const previous = useRef({
    score: 0,
    missed: 0,
    countdown: 0,
    gameState: 'menu' as GameState,
  })

  useEffect(() => {
    if (interacted) return

    // The click and not the `pointerdown`: the game's buttons are activated on
    // click, so attending to the gesture in that same event lets React see
    // «has already interacted» and «wants silence» in the same render. With
    // `pointerdown` they would arrive in different events and muting with the first
    // click of the page would open an audio context to close it right
    // afterwards. The keyboard goes through here too: activating a button with Enter
    // fires its click. And in the headset the gesture is the button to enter the
    // session, which is still DOM.
    const remember = () => setInteracted(true)
    window.addEventListener('click', remember)

    return () => window.removeEventListener('click', remember)
  }, [interacted])

  // Moving the volume in the hall's settings does not rebuild the audio: it touches the master
  // node and that is it. Recreating it closed the context and opened another at each step of the
  // slider, which is a cut in the sound for every nudge. And the ref keeps the
  // value for the engine that does not exist yet: in silence there is none, and
  // when the sound comes back it has to be born at the volume chosen meanwhile.
  useEffect(() => {
    sfxVolumeRef.current = sfxVolume
    engineRef.current?.setVolume(sfxVolume)
  }, [sfxVolume])

  useEffect(() => {
    // In silence the Web Audio API is not touched: no context, no nodes, no
    // playback permission to ask for. And on muting mid-run, the
    // clean-up of this effect closes the context it may have opened.
    if (!interacted || muted) return

    // Without Web Audio (old browser, test environment) the game is played in silence.
    const AudioContextClass = window.AudioContext
    if (AudioContextClass == null) return

    const context = new AudioContextClass()
    engineRef.current = createSoundEngine(context, sfxVolumeRef.current)
    // The browser refusing to resume it is a foreseen outcome —its
    // autoplay policy— and it means playing without sound.
    void context.resume().catch(() => {})

    return () => {
      engineRef.current?.dispose()
      engineRef.current = null
      if (context.state !== 'closed') void context.close()
    }
  }, [interacted, muted])

  const missed = resolved - score

  useEffect(() => {
    const engine = engineRef.current
    const before = previous.current
    previous.current = { score, missed, countdown, gameState }
    if (engine == null) return

    // The counters only go up inside a run, so comparing with the
    // previous value is enough to know what has just happened. If two sticks are
    // resolved in the same React batch it sounds once: two copies of the same
    // sound at once are not heard as two, they are heard as one louder one.
    if (score > before.score) engine.play({ name: 'catch', streak })
    if (missed > before.missed) engine.play({ name: 'miss' })

    if (gameState === 'countdown' && countdown > 0 && countdown !== before.countdown) {
      engine.play({ name: 'countdown', secondsLeft: countdown })
    }
    // Playing is only entered by running out the countdown; going back to the menu on the
    // way cuts it with no go.
    if (gameState === 'playing' && before.gameState === 'countdown') {
      engine.play({ name: 'go' })
    }

    // The end. The last stick finished and nothing sounded: the end screen
    // arrived without warning, and with the headset on the scoreboard is where one is not
    // always looking.
    if (gameState === 'finished' && before.gameState !== 'finished') {
      // The end of a match for two sounds like winning: one of those in front wins it, or
      // they tie, and it is celebrated even if the second has run out of lives.
      const duelEnds = duel != null && duel.points[1] != null
      engine.play({ name: 'over', outcome: duelEnds ? 'win' : roundOutcome(levelResult, lives) })
      // The record goes on top of the close and not in its place: beating the best
      // can happen winning or just finishing, and both things have to be heard.
      if (celebrates) engine.play({ name: 'record' })
    }
  }, [score, missed, countdown, gameState, streak, celebrates, duel, levelResult, lives])

  // The medal threshold that has just been crossed: the short sound of the sign's celebration.
  // It comes from the same medal the sign looks at, so it sounds when the sign changes colour.
  const previousMedal = useRef(medal)

  useEffect(() => {
    const crossed = thresholdCrossed(previousMedal.current, medal)
    previousMedal.current = medal
    if (crossed != null) engineRef.current?.play({ name: 'medal', rank: MEDALS.indexOf(crossed) as 0 | 1 | 2 })
  }, [medal])
}

/**
 * How this run has ended, to choose the close.
 *
 * In Levels you pass or you do not; in the challenge you lose by running out of lives; in practice
 * there is nothing to win or lose and the close only says «se acabó».
 */
function roundOutcome(
  levelResult: { passed: boolean } | null,
  lives: number | null,
): RoundOutcome {
  if (levelResult != null) return levelResult.passed ? 'win' : 'loss'
  if (lives != null) return lives > 0 ? 'win' : 'loss'
  return 'close'
}
