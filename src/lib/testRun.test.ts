import { afterEach, describe, expect, it } from 'vitest'
import { exposeTestRun, isTestRunRequested, type TestRun } from './testRun'

const api: TestRun = { start: () => {}, score: () => {}, end: () => {}, sign: () => null }

afterEach(() => {
  delete window.__runStickRush
})

describe('the run hook', () => {
  it('without asking for it, it leaves nothing', () => {
    expect(isTestRunRequested()).toBe(false)
    exposeTestRun(api)
    expect(window.__runStickRush).toBeUndefined()
  })

  it('asked for, it leaves what is common in the object of the test', () => {
    window.__runStickRush = {}
    expect(isTestRunRequested()).toBe(true)
    exposeTestRun(api)
    expect(window.__runStickRush).toEqual(api)
  })
})
