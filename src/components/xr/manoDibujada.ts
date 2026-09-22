import { ALTO_DEL_MANDO, type ColoresDelMando } from './mandoDibujado'

/**
 * El dibujo de una mano desnuda haciendo el pellizco, para el tutorial.
 *
 * **Es la otra mitad de la lección, para quien entra sin mandos.** Este juego se puede jugar
 * con las manos —los palos se cogen por el puntero de agarre, y con la mano ese puntero es
 * el pellizco (ver `xrInteraction.ts`)—, así que el tutorial tiene que enseñar dos gestos
 * distintos según lo que haya conectado. Dibujarle un mando a quien tiene las manos vacías
 * es enseñarle un objeto que no tiene y un botón que no puede apretar, justo en la única
 * pantalla que existe para explicar cómo se juega.
 *
 * Se dibuja a trazos en el mismo lienzo 2D que el resto del panel y al mismo tamaño que el
 * mando (`ALTO_DEL_MANDO`), para que al cambiar de uno a otro no se mueva nada del panel.
 * No se descarga nada: la mano articulada que el visor sí pinta en la escena es otra cosa
 * (`XRHandModel.tsx`), y a un metro y en siete centímetros de alto no se leería.
 *
 * Todo en metros, como el resto del panel, y centrado en el punto que se le pase.
 */

/** Lo que mide el dibujo, en metros. El mismo que el del mando, a propósito. */
export const ALTO_DE_LA_MANO = ALTO_DEL_MANDO

/** Dónde se juntan el pulgar y el índice, en fracción del alto desde el centro. */
const PELLIZCO = { x: 0.02, y: 0.3, r: 0.055 }

/**
 * Dibuja la mano centrada en `(x, y)`, con el pellizco resaltado si se le pide.
 *
 * `resaltado` es lo mismo que el botón en `dibujarMando`: un paso que no va de agarrar nada
 * enseña la mano sin marcar, para no señalar un gesto que en ese paso no hace falta.
 */
export function dibujarMano(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  resaltado: boolean,
  colores: ColoresDelMando,
): void {
  const u = ALTO_DE_LA_MANO
  ctx.save()
  ctx.translate(x, y)
  ctx.lineWidth = u * 0.045
  ctx.strokeStyle = colores.cuerpo
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'

  // La muñeca: sin ella la palma se lee como una piedra.
  ctx.beginPath()
  ctx.moveTo(-u * 0.13, -u * 0.36)
  ctx.lineTo(-u * 0.13, -u * 0.46)
  ctx.moveTo(u * 0.13, -u * 0.36)
  ctx.lineTo(u * 0.13, -u * 0.46)
  ctx.stroke()

  // La palma, de perfil.
  ctx.beginPath()
  ctx.ellipse(0, -u * 0.16, u * 0.2, u * 0.21, 0, 0, Math.PI * 2)
  ctx.stroke()

  // Los tres dedos que no pellizcan, recogidos contra la palma: es lo que distingue el
  // pellizco de una mano abierta saludando.
  for (const dedo of [-0.06, -0.17, -0.27]) {
    ctx.beginPath()
    ctx.arc(-u * 0.17, u * dedo, u * 0.06, Math.PI * 0.5, Math.PI * 1.5, true)
    ctx.stroke()
  }

  // El índice, subiendo por la izquierda, y el pulgar, por la derecha: los dos acaban en el
  // mismo punto, que es lo que hace que el dibujo se lea como «junta estos dos».
  ctx.beginPath()
  ctx.moveTo(-u * 0.14, u * 0.01)
  ctx.quadraticCurveTo(-u * 0.17, u * 0.26, PELLIZCO.x * u, PELLIZCO.y * u)
  ctx.moveTo(u * 0.19, -u * 0.12)
  ctx.quadraticCurveTo(u * 0.21, u * 0.22, PELLIZCO.x * u, PELLIZCO.y * u)
  ctx.stroke()

  // Donde se juntan. Apagado es solo la punta de los dedos; encendido crece y se rodea de un
  // halo, igual que el botón del mando: a un metro, un punto un poco más gordo no se ve.
  ctx.beginPath()
  ctx.arc(PELLIZCO.x * u, PELLIZCO.y * u, PELLIZCO.r * u * (resaltado ? 1.6 : 1), 0, Math.PI * 2)
  ctx.fillStyle = resaltado ? colores.resaltado : colores.cuerpo
  ctx.fill()
  if (resaltado) {
    ctx.beginPath()
    ctx.arc(PELLIZCO.x * u, PELLIZCO.y * u, PELLIZCO.r * u * 2.8, 0, Math.PI * 2)
    ctx.strokeStyle = colores.resaltado
    ctx.lineWidth = u * 0.035
    ctx.stroke()
  }

  ctx.restore()
}
