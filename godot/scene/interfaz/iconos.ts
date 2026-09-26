/**
 * Los iconos del visor de Stick Rush en mallas de Godot: los de `XRUi.tsx` de la web, con las formas
 * de `lib/xrIcons.ts` tal cual (la casa, el corazón, la estrella, el visto, las montañas del
 * escenario) y las piezas que la web dibuja con geometría (los triángulos de jugar y de subir y
 * bajar, el marco de la habitación, el aro de la partida sin fin, las flechas de repetir).
 *
 * Todo sale plano y sin luz, con la `figura` del kit (`@kit/runtime/ui/malla`), así que se enciende
 * y se apaga con el botón que lo lleva.
 */
import { Geometry2D, PackedVector2Array, Vector2, type MeshInstance3D } from 'godot'

import { desplazar, triangulosDeArco, triangulosDeTrazo } from '@kit/lib/ui/iconos'
import type { Punto2 } from '@kit/lib/ui/salida'
import { figura } from '@kit/runtime/ui/malla'
import { ORDEN } from '@kit/runtime/ui/texto3d'

import {
  XR_CHECK_ICON,
  XR_HEART_ICON,
  XR_HOME_ICON,
  XR_STAR_ICON,
  sceneMountains,
  type IconPoint,
  type IconShape,
} from '@/lib/xrIcons'

/** Los triángulos de un contorno sin agujeros, por el `triangulate_polygon` del motor. */
function triangulosDelContorno(contorno: readonly IconPoint[], escala: number): Punto2[] {
  const puntos = new PackedVector2Array()
  for (const [x, y] of contorno) puntos.append(new Vector2(x * escala, y * escala))
  const indices = Geometry2D.triangulate_polygon(puntos)
  const salida: Punto2[] = []
  for (let i = 0; i < indices.size(); i++) {
    const [x, y] = contorno[indices.get(i)]
    salida.push([x * escala, y * escala])
  }
  return salida
}

/**
 * Una forma de `xrIcons.ts` a `tamano` metros por unidad. Los agujeros (la puerta de la casa) se
 * pintan encima con `hueco`, el color de lo que queda detrás: con un solo color por figura, es lo
 * que la deja ver.
 */
export function iconoDeForma(forma: IconShape, tamano: number, color: string): MeshInstance3D {
  const triangulos = forma.flatMap((camino) => triangulosDelContorno(camino.outline, tamano))
  return figura(triangulos, color)
}

/** Los agujeros de una forma, para pintarlos del color de la placa encima de ella. */
export function huecosDeForma(forma: IconShape, tamano: number, color: string): MeshInstance3D | null {
  const triangulos = forma.flatMap((camino) => (camino.holes ?? []).flatMap((h) => triangulosDelContorno(h, tamano)))
  if (triangulos.length === 0) return null
  // Por encima de la forma que agujerea: los dibujos de un botón van todos a la misma distancia.
  return figura(triangulos, color, 1, ORDEN.texto)
}

export function iconoDeCasa(tamano: number, color: string): MeshInstance3D {
  return iconoDeForma(XR_HOME_ICON, tamano, color)
}

export function iconoDeCorazon(tamano: number, color: string): MeshInstance3D {
  return iconoDeForma(XR_HEART_ICON, tamano, color)
}

export function iconoDeEstrella(tamano: number, color: string): MeshInstance3D {
  return iconoDeForma(XR_STAR_ICON, tamano, color)
}

export function iconoDeVisto(tamano: number, color: string): MeshInstance3D {
  return iconoDeForma(XR_CHECK_ICON, tamano, color)
}

/**
 * Un triángulo de lado a lado `2·radio` con la punta hacia `punta` (el `cylinderGeometry` de tres
 * lados de `XRTriangleIcon`), centrado en su dibujo como la web (`XR_TRIANGLE_CENTER`).
 */
export function triangulosDeFlecha(radio: number, punta: 'up' | 'down' | 'right'): Punto2[] {
  const a = Math.sqrt(3) / 2
  // Un triángulo equilátero inscrito en `radio`, con la punta arriba, corrido para centrar el dibujo.
  const arriba: Punto2[] = [
    [0, radio * 0.75],
    [-a * radio, -radio * 0.75],
    [a * radio, -radio * 0.75],
  ].map(([x, y]) => [x, y] as Punto2)
  if (punta === 'up') return arriba
  if (punta === 'down') return arriba.map(([x, y]) => [x, -y] as Punto2)
  return arriba.map(([x, y]) => [y, -x] as Punto2)
}

export function iconoDeFlecha(radio: number, punta: 'up' | 'down' | 'right', color: string): MeshInstance3D {
  return figura(triangulosDeFlecha(radio, punta), color)
}

/** Dos montañas sobre el mismo suelo y la luna: el escenario (`XRSceneIcon`, `sceneMountains`). */
export function iconoDeEscenario(tamano: number, color: string): MeshInstance3D {
  const montanas = sceneMountains(tamano).flatMap(({ radio, x, y }) => desplazar(triangulosDeFlecha(radio, 'up'), x, y + radio * 0.25))
  const luna = desplazar(triangulosDeArco(0, tamano * 0.2, 0, Math.PI * 2, 12), tamano * 0.75, tamano * 0.85)
  return figura([...montanas, ...luna], color)
}

/** Un marco vacío: la habitación de verdad, sin decorado encima (`XRPassthroughIcon`). */
export function iconoDeHabitacion(tamano: number, color: string): MeshInstance3D {
  const g = tamano * 0.16
  const barra = (x: number, y: number, ancho: number, alto: number): Punto2[] => [
    [x - ancho / 2, y - alto / 2],
    [x + ancho / 2, y - alto / 2],
    [x + ancho / 2, y + alto / 2],
    [x - ancho / 2, y - alto / 2],
    [x + ancho / 2, y + alto / 2],
    [x - ancho / 2, y + alto / 2],
  ]
  return figura(
    [
      ...barra(0, tamano * 0.9, tamano * 2, g),
      ...barra(0, -tamano * 0.9, tamano * 2, g),
      ...barra(-tamano, 0, g, tamano * 1.8),
      ...barra(tamano, 0, g, tamano * 1.8),
    ],
    color,
  )
}

/** El aro de la partida sin fin: entero si se recarga, medio si se acaba (`EndlessToggle`). */
export function triangulosDelAroSinFin(entero: boolean): Punto2[] {
  return triangulosDeArco(0.016, 0.028, 0, entero ? Math.PI * 2 : Math.PI, 24)
}

/** Repetir partida: un anillo abierto con su punta (`XRRepeatIcon`). */
export function iconoDeRepetir(tamano: number, color: string): MeshInstance3D {
  const anillo = triangulosDeArco(tamano * 0.7, tamano, Math.PI * 0.35, Math.PI * 1.6, 20)
  const fin = Math.PI * 0.35
  const cx = Math.cos(fin) * tamano * 0.85
  const cy = Math.sin(fin) * tamano * 0.85
  const punta = desplazar(triangulosDeFlecha(tamano * 0.4, 'down'), cx, cy)
  return figura([...anillo, ...punta], color)
}

/** Un trazo del plano, del grosor dado: las barras que no son cajas. */
export function iconoDeTrazo(camino: readonly Punto2[], grosor: number, color: string): MeshInstance3D {
  return figura(triangulosDeTrazo(camino, grosor), color)
}

/** Un rectángulo de `ancho × alto` centrado en `(x, y)`: las placas de la web que no son botón. */
export function rectangulo(ancho: number, alto: number, color: string, x = 0, y = 0, prioridad: number = ORDEN.dibujo): MeshInstance3D {
  return figura(
    [
      [x - ancho / 2, y - alto / 2],
      [x + ancho / 2, y - alto / 2],
      [x + ancho / 2, y + alto / 2],
      [x - ancho / 2, y - alto / 2],
      [x + ancho / 2, y + alto / 2],
      [x - ancho / 2, y + alto / 2],
    ],
    color,
    1,
    prioridad,
  )
}
