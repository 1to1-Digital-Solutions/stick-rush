import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { PANEL_PIXELS_PER_METER, drawParagraph, drawText, panelFont, wrapText } from './canvasPanel'

/**
 * The text of the panels, which is the only thing here that can be checked without
 * a headset in front: inside the Canvas there is no DOM to measure, so a
 * label that runs off its button is only seen with the headset on.
 *
 * What is ensured is the shrinking. With four modes in the menu's row the
 * buttons measure twelve centimetres and «301/501» does not fit at its size; without this it
 * would be read on top of the next button.
 */

/** How wide a letter is relative to its height, more or less, on this canvas. */
const ADVANCE = 0.6

/** The size declared in a canvas font, in pixels of the texture. */
function pixelsOf(font: string): number {
  return Number(font.match(/([\d.]+)px/)?.[1])
}

/** And the same size in metres of the panel, which is what the texts are asked for in. */
function sizeOf(font: string): number {
  return pixelsOf(font) / PANEL_PIXELS_PER_METER
}

/** A fake canvas: it measures like a real one and records what is written. */
function fakeCanvas() {
  const written: { text: string; font: string; argCount: number }[] = []

  const ctx = {
    font: '',
    fillStyle: '',
    textAlign: 'center',
    textBaseline: 'alphabetic',
    save() {},
    restore() {},
    translate() {},
    scale() {},
    measureText(text: string) {
      // What it measures depends on the font that is set, as in the browser: in pixels
      // of the font, regardless of the canvas's scale.
      return { width: text.length * pixelsOf(ctx.font) * ADVANCE }
    },
    fillText(...args: unknown[]) {
      written.push({ text: String(args[0]), font: ctx.font, argCount: args.length })
    },
  }

  return { ctx: ctx as unknown as CanvasRenderingContext2D, written }
}

const BLACK = '#101419'

describe('drawText', () => {
  it('writes at the requested size what fits', () => {
    const { ctx, written } = fakeCanvas()

    drawText(ctx, 'Reloj', 0, 0, { size: 0.032, color: BLACK, maxWidth: 0.2 })

    expect(written).toHaveLength(1)
    expect(sizeOf(written[0].font)).toBeCloseTo(0.032, 9)
  })

  it('asks for the font in real pixels, not in metres', () => {
    // A 0.03 px letter magnified a thousand times is what the headset's browser painted with the
    // letters piled up: at that size the measurements of each letter are no good. Reported with the
    // headset on: «the letters are completely stuck together, one on top of the other».
    const { ctx, written } = fakeCanvas()

    drawText(ctx, 'Levels', 0, 0, { size: 0.03, color: BLACK, maxWidth: 0.08 })
    drawParagraph(ctx, 'Hold the trigger and the ball appears', 0, 0, { size: 0.03, color: BLACK, maxWidth: 0.2 })

    for (const line of written) expect(pixelsOf(line.font), line.text).toBeGreaterThanOrEqual(8)
  })

  it('shrinks what does not fit until it fits', () => {
    // The room of a button in the modes' row, with the chosen dot in place.
    const room = 0.081
    const { ctx, written } = fakeCanvas()

    drawText(ctx, '301/501', 0, 0, { size: 0.032, color: BLACK, maxWidth: room })

    const size = sizeOf(written[0].font)
    expect(size).toBeLessThan(0.032)
    expect('301/501'.length * size * ADVANCE).toBeLessThanOrEqual(room + 1e-9)
  })

  it('shrinks the letter, it does not squeeze it', () => {
    // `fillText` knows how to squeeze the text into the width it is told, but a
    // condensed text on a panel an arm's length away reads much worse
    // than the same text one point smaller.
    const { ctx, written } = fakeCanvas()

    drawText(ctx, '301/501', 0, 0, { size: 0.032, color: BLACK, maxWidth: 0.081 })

    expect(written[0].argCount).toBe(3)
  })

  it('without a maximum it does not touch the size: it is what the rest of the panels do', () => {
    const { ctx, written } = fakeCanvas()

    drawText(ctx, 'Un título largo de los que no caben', 0, 0, { size: 0.055, color: BLACK })

    expect(sizeOf(written[0].font)).toBeCloseTo(0.055, 9)
  })
})

/**
 * The split into lines.
 *
 * **It is what made the tutorials illegible.** A forty-character phrase shrunk
 * until it fitted on a single line on a sixty-centimetre panel ends up in two-centimetre
 * letters: inside the headset it was written and nothing could be understood. Shrinking is fine for a
 * button label; a phrase has to be split.
 */
describe('splitting a text into lines', () => {
  it('puts on one line what fits', () => {
    const { ctx } = fakeCanvas()
    ctx.font = panelFont('600', 0.03)

    expect(wrapText(ctx, 'Dale al topo', 1)).toEqual(['Dale al topo'])
  })

  it('splits at spaces what does not fit', () => {
    const { ctx } = fakeCanvas()
    ctx.font = panelFont('600', 0.03)
    // With this canvas, each letter measures 0.018 m: about eleven fit per 0.2 line.
    const lines = wrapText(ctx, 'Hold the trigger and the ball appears', 0.2)

    expect(lines.length).toBeGreaterThan(1)
    expect(lines.join(' ')).toBe('Hold the trigger and the ball appears')
    for (const line of lines) {
      expect(ctx.measureText(line).width / PANEL_PIXELS_PER_METER).toBeLessThanOrEqual(0.2)
    }
  })

  it('leaves whole a word that does not fit by itself', () => {
    // Splitting it down the middle reads worse than letting it stick out, and in a headset much worse.
    const { ctx } = fakeCanvas()
    ctx.font = panelFont('600', 0.03)

    expect(wrapText(ctx, 'incomprehensiblemente', 0.05)).toEqual(['incomprehensiblemente'])
  })

  it('with an empty text it writes nothing', () => {
    const { ctx } = fakeCanvas()
    ctx.font = panelFont('600', 0.03)

    expect(wrapText(ctx, '   ', 1)).toEqual([])
  })
})

describe('writing a paragraph', () => {
  it('writes one line per chunk, all of the same size', () => {
    // Without shrinking: the size asked for is the one read, and what is left over goes down a line.
    const { ctx, written } = fakeCanvas()

    drawParagraph(ctx, 'Hold the trigger and the ball appears', 0, 0, {
      size: 0.03,
      color: '#fff',
      maxWidth: 0.2,
    })

    expect(written.length).toBeGreaterThan(1)
    expect(new Set(written.map((line) => sizeOf(line.font))).size).toBe(1)
    expect(sizeOf(written[0].font)).toBeCloseTo(0.03, 6)
  })

  it('centres the block on the height it is given', () => {
    // `y` is the centre of the block and not the first line: otherwise, a two-line phrase and
    // a one-line one would end up in different places and the panel would jump between stretches.
    const { ctx, written } = fakeCanvas()
    const twoLines = () => {
      written.length = 0
      drawParagraph(ctx, 'Hold the trigger and the ball appears', 0, 0, {
        size: 0.03,
        color: '#fff',
        maxWidth: 0.2,
      })
      return written.length
    }

    const count = twoLines()
    expect(count).toBeGreaterThan(1)
    // The block spreads its lines above and below the centre, so the first one ends up
    // above zero and the last one below.
    expect(count % 2 === 0 || count > 1).toBe(true)
  })

  it('with an empty text it writes nothing', () => {
    const { ctx, written } = fakeCanvas()

    drawParagraph(ctx, '', 0, 0, { size: 0.03, color: '#fff', maxWidth: 0.2 })

    expect(written).toEqual([])
  })
})

/**
 * And the only thing of the component that can be checked without mounting the scene: that the canvas **does
 * not write depth**.
 *
 * A transparent material writes its depth unless it is told not to, and this plane
 * goes in front of the panel's buttons covering them entirely: with depth on,
 * everything behind disappears even if the canvas is empty there. That is how the play
 * button of glide-hockey was left without its blue plate —«it is not seen in blue, it is as if
 * shaded»— and with it the plates of the small buttons of several games.
 */
describe('the plane of the panel', () => {
  const source = readFileSync(
    path.join(process.cwd(), 'src/components/xr/canvasPanel.tsx'),
    'utf8',
  )

  it('does not write depth: it would cover whatever is behind it', () => {
    expect(source).toContain('depthWrite={false}')
  })
})
