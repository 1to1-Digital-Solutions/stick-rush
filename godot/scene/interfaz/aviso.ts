/**
 * Lo que se pulsa y se lee durante la partida, fuera del marcador: el botón de volver al menú, el de
 * terminar la partida sin fin, el aviso que pregunta antes de dejarla y la cuenta atrás. Lo de la web
 * (`XRQuitButton`, `XRQuitConfirm` de `XRHud.tsx` y `XRCountdown.tsx`), con sus cotas:
 *
 * - **Volver al menú va arriba y a la izquierda** (`XR_QUIT_POSITION`), girado hacia quien juega
 *   (`XR_QUIT_YAW`): a la altura del pecho caía por donde va la mano a por un palo. También durante
 *   la cuenta atrás, que es la última ocasión de cambiar de opciones.
 * - **Terminar la partida sin fin**, en la punta contraria (`XR_END_RUN_POSITION`): son las dos
 *   salidas de la partida y una a cada lado no se confunden.
 * - **No se sale de golpe**: salir pierde lo hecho. Se para la partida y se pregunta delante, a la
 *   altura de la vista; mientras se pregunta no cae ningún palo. Seguir jugando va a la derecha y
 *   más grande: es la respuesta que no pierde nada.
 * - **La cuenta atrás, sin cifras** como en la web: un anillo por segundo que se apaga, y el que está
 *   a punto de caer late.
 * - **A dos, el final de cada tanda** (`PanelDelDuelo`): el aviso de pasar el mando o quién gana.
 */
import { Node3D, Vector3, type MeshInstance3D } from 'godot'

import { triangulosDeArco } from '@kit/lib/ui/iconos'
import { Boton } from '@kit/runtime/ui/boton'
import { figura, pintar } from '@kit/runtime/ui/malla'
import { Panel } from '@kit/runtime/ui/panel'
import type { Punteria } from '@kit/runtime/ui/punteria'
import { ORDEN } from '@kit/runtime/ui/texto3d'

import type { Lang } from '@/lib/ajustes'
import { LIFE_COLOR } from '@/lib/gameConfig'
import { traductor } from '@/lib/textos'
import { XR_HOME_ICON } from '@/lib/xrIcons'
import type { DuelSummary } from '@/lib/duel'
import {
  CONFIRM_BOXES,
  CONFIRM_TEXT,
  DUEL_TEXT,
  XR_CONFIRM_SIZE,
  XR_DUEL_SIZE,
  XR_END_RUN_POSITION,
  XR_END_RUN_YAW,
  XR_QUIT_POSITION,
  XR_QUIT_YAW,
  type Vec3,
} from '@/lib/xrLayout'

import { COUNTDOWN_SECONDS } from '../juego/partida'
import { huecosDeForma, iconoDeCasa, iconoDeVisto } from './iconos'
import { COLORES } from './menu'

/** Un botón suelto, que no cuelga de un panel, en su sitio de la interfaz y girado hacia quien juega. */
function botonSuelto(id: string, sitio: Vec3, giro: number, color: string, alPulsar: () => void): Boton {
  const boton = new Boton({ id, caja: { x: 0, y: 0, width: 0.16, height: 0.14 }, z: 0, color, opacidad: 0, alPulsar })
  boton.nodo.position = new Vector3(...sitio)
  boton.nodo.rotation = new Vector3(0, giro, 0)
  return boton
}

/** La placa de la web (0,12 × 0,1), más pequeña que la zona sensible: lo que se ve del botón. */
function placa(color: string): MeshInstance3D {
  return figura([[-0.06, -0.05], [0.06, -0.05], [0.06, 0.05], [-0.06, -0.05], [0.06, 0.05], [-0.06, 0.05]], color)
}

export class BotonDeVolver {
  readonly boton: Boton
  constructor(alPulsar: () => void, punteria: Punteria) {
    this.boton = botonSuelto('quit', XR_QUIT_POSITION, XR_QUIT_YAW, COLORES.neutro, alPulsar)
    this.boton.dibujo(placa(COLORES.neutro), COLORES.neutro, 1, { prioridad: ORDEN.placa })
    this.boton.dibujo(iconoDeCasa(0.028, '#ffffff'), '#ffffff')
    const puerta = huecosDeForma(XR_HOME_ICON, 0.028, COLORES.neutro)
    if (puerta != null) this.boton.dibujo(puerta, COLORES.neutro)
    punteria.anadir(this.boton)
  }

  get nodo(): Node3D {
    return this.boton.nodo
  }
}

export class BotonDeTerminar {
  readonly boton: Boton
  constructor(alPulsar: () => void, punteria: Punteria) {
    this.boton = botonSuelto('end-run', XR_END_RUN_POSITION, XR_END_RUN_YAW, COLORES.jugar, alPulsar)
    this.boton.dibujo(placa(COLORES.jugar), COLORES.jugar, 1, { prioridad: ORDEN.placa })
    this.boton.dibujo(iconoDeVisto(0.028, '#ffffff'), '#ffffff')
    punteria.anadir(this.boton)
  }

  get nodo(): Node3D {
    return this.boton.nodo
  }
}

export class AvisoDeSalir {
  readonly panel: Panel
  readonly nodo: Node3D
  readonly dejar: Boton
  readonly seguir: Boton

  constructor(acciones: { dejar(): void; seguir(): void }, punteria: Punteria) {
    this.panel = new Panel({ ancho: XR_CONFIRM_SIZE[0], alto: XR_CONFIRM_SIZE[1], fondo: COLORES.panel, opacidad: 1 })
    this.nodo = this.panel.nodo
    const caja = (box: { position: Vec3; size: Vec3 }) => ({ x: box.position[0], y: box.position[1], width: box.size[0], height: box.size[1] })
    this.dejar = this.panel.boton(new Boton({ id: 'confirm:leave', caja: caja(CONFIRM_BOXES.leave), color: COLORES.ficha, alPulsar: () => acciones.dejar() }))
    this.seguir = this.panel.boton(new Boton({ id: 'confirm:stay', caja: caja(CONFIRM_BOXES.stay), color: LIFE_COLOR, alPulsar: () => acciones.seguir() }))
    punteria.anadir(this.dejar, this.seguir)
    this.nodo.visible = false
  }

  /** Lo escribe en un idioma: el `dibujarElAviso` de la web. */
  escribir(lang: Lang): void {
    const t = traductor(lang)
    const { panel } = this
    const ancho = XR_CONFIRM_SIZE[0] - 0.08
    panel.borrarTextos()
    panel.parrafo(t('Leave the game?'), 0, 0.1, { alto: CONFIRM_TEXT.title, color: COLORES.claro, anchoMax: ancho })
    panel.parrafo(t('You lose what you have got so far.'), 0, 0.02, { alto: CONFIRM_TEXT.body, color: COLORES.suave, anchoMax: ancho })
    panel.escribir(t('Leave'), this.dejar.caja.x, this.dejar.caja.y, {
      alto: CONFIRM_TEXT.button,
      color: COLORES.claro,
      anchoMax: this.dejar.caja.width - 0.03,
      en: this.dejar,
    })
    panel.escribir(t('Keep playing'), this.seguir.caja.x, this.seguir.caja.y, {
      alto: CONFIRM_TEXT.button,
      color: '#3b1d00',
      anchoMax: this.seguir.caja.width - 0.03,
      en: this.seguir,
    })
  }
}

/**
 * El final de una tanda a dos: **el aviso de pasar el mando** o, con las dos jugadas, quién gana, los
 * puntos de los dos y lo que lleva la pareja. El `XRDuelPanel` de la web, en el sitio del aviso de
 * salir (`XR_DUEL_POSITION`), con los renglones de su `dibujarElDuelo`; los botones del marcador
 * siguen debajo, y el de jugar empieza la tanda del otro.
 */
export class PanelDelDuelo {
  readonly panel: Panel
  readonly nodo: Node3D

  constructor() {
    this.panel = new Panel({ ancho: XR_DUEL_SIZE[0], alto: XR_DUEL_SIZE[1], fondo: COLORES.panel, opacidad: 1 })
    this.nodo = this.panel.nodo
    this.nodo.visible = false
  }

  /** Lo escribe: las frases vienen ya dichas (`duelSummary`). */
  escribir(dicho: DuelSummary): void {
    const { panel } = this
    const ancho = XR_DUEL_SIZE[0] - 0.04
    panel.borrarTextos()
    panel.escribir(dicho.title, 0, 0.08, { alto: DUEL_TEXT.title, color: dicho.winner != null ? COLORES.estrella : '#ffffff', anchoMax: ancho })
    if (dicho.pass != null) {
      panel.escribir(dicho.pass, 0, 0.015, { alto: DUEL_TEXT.body, color: '#4ade80', anchoMax: ancho })
      return
    }
    // Un renglón por jugador: juntos en uno no caben a la letra del panel.
    dicho.lines.forEach((linea, i) => {
      panel.escribir(linea.text, 0, 0.025 - i * 0.045, {
        alto: DUEL_TEXT.body,
        color: linea.player === dicho.winner ? COLORES.estrella : COLORES.claro,
        anchoMax: ancho,
      })
    })
    if (dicho.tally != null) panel.escribir(dicho.tally, 0, -0.08, { alto: DUEL_TEXT.body, color: COLORES.suave, anchoMax: ancho })
  }
}

/** Los anillos de la cuenta atrás (`RING_RADIUS`, `RING_GAP` de `XRCountdown.tsx`). */
const RING_RADIUS = 0.055
const RING_GAP = 0.135

export class CuentaAtras {
  readonly nodo = new Node3D()
  private readonly anillos: MeshInstance3D[] = []
  private reloj = 0

  constructor() {
    this.nodo.set_name('CuentaAtras')
    const ancho = (COUNTDOWN_SECONDS - 1) * RING_GAP
    const tubo = RING_RADIUS * 0.16
    for (let i = 0; i < COUNTDOWN_SECONDS; i++) {
      const anillo = figura(triangulosDeArco(RING_RADIUS - tubo, RING_RADIUS + tubo, 0, Math.PI * 2, 28), '#22c55e', 0.85)
      anillo.position = new Vector3(i * RING_GAP - ancho / 2, 0, 0)
      this.nodo.add_child(anillo)
      this.anillos.push(anillo)
    }
    this.nodo.visible = false
  }

  /** Enseña la cuenta (3, 2, 1) o nada con 0: gastados, el que corre latiendo y los que quedan. */
  mostrar(cuenta: number, delta: number): void {
    this.nodo.visible = cuenta > 0
    if (cuenta <= 0) return
    this.reloj += delta
    this.anillos.forEach((anillo, i) => {
      const segundo = COUNTDOWN_SECONDS - i
      if (cuenta < segundo) {
        pintar(anillo, '#475569', 0.12)
        anillo.scale = new Vector3(0.8, 0.8, 1)
      } else if (cuenta === segundo) {
        const pulso = 0.5 + 0.5 * Math.sin(this.reloj * Math.PI * 2)
        pintar(anillo, '#22c55e', 0.6 + pulso * 0.4)
        const k = 1.12 + pulso * 0.12
        anillo.scale = new Vector3(k, k, 1)
      } else {
        pintar(anillo, '#22c55e', 0.85)
        anillo.scale = Vector3.ONE
      }
    })
  }
}
