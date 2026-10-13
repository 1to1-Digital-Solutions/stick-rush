import { CONTROLLER_HEIGHT, type ControllerColors } from './drawnController'

/**
 * The drawing of a bare hand making the pinch, for the tutorial.
 *
 * **It is the other half of the lesson, for whoever enters without controllers.** This game can be played
 * with the hands —the sticks are caught through the grab pointer, and with the hand that pointer is
 * the pinch (see `xrInteraction.ts`)—, so the tutorial has to teach two different
 * gestures depending on what is connected. Drawing a controller for someone whose hands are empty
 * is showing them an object they do not have and a button they cannot squeeze, right on the only
 * screen that exists to explain how to play.
 *
 * It is drawn in strokes on the same 2D canvas as the rest of the panel and at the same size as the
 * controller (`CONTROLLER_HEIGHT`), so that on switching from one to the other nothing in the panel moves.
 * Nothing is downloaded: the articulated hand that the headset does paint in the scene is something else
 * (`XRHandModel.tsx`), and at one metre and seven centimetres tall it would not be readable.
 *
 * Everything in metres, like the rest of the panel, and centred on the point it is given.
 */

/** What the drawing measures, in metres. The same as the controller's, on purpose. */
export const HAND_HEIGHT = CONTROLLER_HEIGHT

/** Where the thumb and the index finger meet, as a fraction of the height from the centre. */
const PINCH = { x: 0.02, y: 0.3, r: 0.055 }

/**
 * Draws the hand centred on `(x, y)`, with the pinch highlighted if asked.
 *
 * `highlighted` is the same as the button in `drawController`: a step that is not about grabbing anything
 * shows the hand unmarked, so as not to point out a gesture that step does not need.
 */
export function drawHand(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  highlighted: boolean,
  colors: ControllerColors,
): void {
  const u = HAND_HEIGHT
  ctx.save()
  ctx.translate(x, y)
  ctx.lineWidth = u * 0.045
  ctx.strokeStyle = colors.body
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'

  // The wrist: without it the palm reads as a stone.
  ctx.beginPath()
  ctx.moveTo(-u * 0.13, -u * 0.36)
  ctx.lineTo(-u * 0.13, -u * 0.46)
  ctx.moveTo(u * 0.13, -u * 0.36)
  ctx.lineTo(u * 0.13, -u * 0.46)
  ctx.stroke()

  // The palm, in profile.
  ctx.beginPath()
  ctx.ellipse(0, -u * 0.16, u * 0.2, u * 0.21, 0, 0, Math.PI * 2)
  ctx.stroke()

  // The three fingers that do not pinch, tucked against the palm: it is what tells the
  // pinch from an open hand waving.
  for (const finger of [-0.06, -0.17, -0.27]) {
    ctx.beginPath()
    ctx.arc(-u * 0.17, u * finger, u * 0.06, Math.PI * 0.5, Math.PI * 1.5, true)
    ctx.stroke()
  }

  // The index finger, going up on the left, and the thumb, on the right: both end at the
  // same point, which is what makes the drawing read as «bring these two together».
  ctx.beginPath()
  ctx.moveTo(-u * 0.14, u * 0.01)
  ctx.quadraticCurveTo(-u * 0.17, u * 0.26, PINCH.x * u, PINCH.y * u)
  ctx.moveTo(u * 0.19, -u * 0.12)
  ctx.quadraticCurveTo(u * 0.21, u * 0.22, PINCH.x * u, PINCH.y * u)
  ctx.stroke()

  // Where they meet. Dimmed it is just the tip of the fingers; lit it grows and is surrounded by a
  // halo, just like the controller's button: at one metre, a slightly fatter dot is not seen.
  ctx.beginPath()
  ctx.arc(PINCH.x * u, PINCH.y * u, PINCH.r * u * (highlighted ? 1.6 : 1), 0, Math.PI * 2)
  ctx.fillStyle = highlighted ? colors.highlighted : colors.body
  ctx.fill()
  if (highlighted) {
    ctx.beginPath()
    ctx.arc(PINCH.x * u, PINCH.y * u, PINCH.r * u * 2.8, 0, Math.PI * 2)
    ctx.strokeStyle = colors.highlighted
    ctx.lineWidth = u * 0.035
    ctx.stroke()
  }

  ctx.restore()
}
