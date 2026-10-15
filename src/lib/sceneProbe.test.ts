import { afterEach, describe, expect, it } from 'vitest'

import { publishStick, stickProbeRequested } from './sceneProbe'

/**
 * The snapshot of the sticks only exists if someone asks for it.
 *
 * It is what separates a test probe from a leak: the scene writes ninety
 * times per second, so it has to cost zero when nobody looks, and it must not
 * leave a trace in the `window` of a real player.
 */

const A_STICK = { x: 0.1, y: 1.2, z: -0.8, catchable: true }

afterEach(() => {
  delete window.__stickRushSticks
})

describe('the snapshot of the sticks', () => {
  it('nobody asks for it: the scene writes nothing', () => {
    expect(stickProbeRequested()).toBe(false)
    publishStick('1-0', A_STICK)
    expect('__stickRushSticks' in window).toBe(false)
  })

  it('asked for, it publishes each stick under its key', () => {
    window.__stickRushSticks = {}
    expect(stickProbeRequested()).toBe(true)

    publishStick('1-0', A_STICK)
    publishStick('1-1', { ...A_STICK, x: -0.4, catchable: false })

    expect(window.__stickRushSticks).toEqual({
      '1-0': A_STICK,
      '1-1': { ...A_STICK, x: -0.4, catchable: false },
    })
  })

  it('the stick that leaves erases its key', () => {
    // Leaving it in place would tell whoever looks that there is still a stick there,
    // still forever, and a test would go and catch it.
    window.__stickRushSticks = {}
    publishStick('1-0', A_STICK)
    publishStick('1-0', null)

    expect(window.__stickRushSticks).toEqual({})
  })

  it('survives being asked for without the slot being prepared', () => {
    // `window.__stickRushSticks = undefined` creates the property with no object: the
    // probe is asked for and there is nowhere to write.
    window.__stickRushSticks = undefined
    publishStick('1-0', A_STICK)
    expect(window.__stickRushSticks).toEqual({ '1-0': A_STICK })

    window.__stickRushSticks = undefined
    publishStick('1-0', null)
    expect(window.__stickRushSticks).toEqual({})
  })
})
