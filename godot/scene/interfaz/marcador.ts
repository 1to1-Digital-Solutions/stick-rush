/**
 * El marcador de Stick Rush en Godot: el del visor de la web (`XRHud.tsx`), por debajo del aro
 * (`XR_HUD_POSITION`) para no cruzarse con los palos que caen.
 *
 * Lo mismo que la web y en el mismo sitio: **una ficha por palo** —verde, grande y levantada el
 * atrapado; roja, pequeña y hundida el perdido; gris el que sigue en juego (`stickStatuses`)—, **la
 * racha** en rombos encima (hasta cinco), **la barra de puntos** que se llena hacia lo máximo posible
 * de esa partida con **la marca del récord** sobre el carril (`scoreRatio`; sin fin, la racha contra la
 * mejor racha), y debajo **las vidas** del desafío o, al acabar un nivel, **sus estrellas**. Al acabar,
 * el panel crece y lleva **repetir** y **volver al menú**.
 *
 * **En la partida que cuenta para medalla calla lo que ya dice el cartel de encima**
 * (`interfaz/cartel.ts`), como en la web: sin barra, sin vidas y sin la letra del final, que el
 * cartel dice con lo que faltó; quedan las fichas, la racha y, al acabar, los botones
 * (`xrHudLayout`).
 *
 * **Aquí sí hay letra**, y es la única diferencia a propósito: la web no escribe en el visor porque la
 * fuente de drei no pasa su política de seguridad, así que el final solo lo cuenta con fichas y
 * barras. En el motor la letra es de casa, y el panel del final crece por arriba para decir cómo ha
 * acabado y los puntos, con las mismas frases que la pantalla de fin de la web (`HUD.tsx`). Compartir
 * no es del juego: lo ofrece el salón al volver.
 */
import { Node3D, Vector3, type MeshInstance3D } from 'godot'

import { arcTriangles } from '@kit/lib/ui/icons'
import { Button } from '@kit/runtime/ui/button'
import { shape, paint } from '@kit/runtime/ui/mesh'
import { Panel } from '@kit/runtime/ui/panel'
import type { PointerAim } from '@kit/runtime/ui/pointerAim'
import { RENDER_ORDER } from '@kit/runtime/ui/text3d'

import type { Lang } from '@/lib/settings'
import { LIFE_COLOR, MAX_STICKS } from '@/lib/gameConfig'
import { CHALLENGE_LIVES, otraDelModo, type GameMode } from '@/lib/gameMode'
import type { Stars } from '@/lib/levels'
import type { Player } from '@/lib/duel'
import type { StickStatus } from '@/lib/stickLayout'
import { formatoDeCifra, traductor } from '@/lib/textos'
import { XR_HOME_ICON } from '@/lib/xrIcons'
import { xrHudLayout } from '@/lib/xrLayout'

import { iconoDeCasa, iconoDeCorazon, iconoDeEstrella, iconoDeJugadores, iconoDeRepetir, huecosDeForma, rectangulo } from './iconos'
import { COLORES } from './menu'

/** Las fichas de los palos (`TOKEN_SPACING`, `TOKEN_RADIUS`, `TOKEN_STYLE` de `XRHud.tsx`). */
const TOKEN_SPACING = 0.07
const TOKEN_RADIUS = 0.026
const TOKEN_STYLE: Record<StickStatus, { color: string; escala: number; alto: number }> = {
  caught: { color: '#22c55e', escala: 1.15, alto: 0.012 },
  missed: { color: '#dc2626', escala: 0.7, alto: -0.012 },
  pending: { color: '#475569', escala: 0.9, alto: 0 },
}
/** Vidas (`LIFE_SPACING`, `LIFE_SIZE`, `LIFE_ROW_Y`, `LIFE_SPENT_COLOR`). */
const LIFE_SPACING = 0.05
const LIFE_SIZE = 0.019
const LIFE_ROW_Y = -0.105
const LIFE_SPENT_COLOR = '#3f4a5a'
/** Los botones del final y sus rótulos (`BUTTON_SPACING`, `BUTTON_HIT`, `ROTULOS_DEL_FINAL`). */
const BUTTON_SPACING = 0.36
const BUTTON_HIT = { width: 0.15, height: 0.11 } as const
/** Debajo de cada placa, lo que hace: un icono solo se adivina con el visor puesto. */
export const ROTULOS_DEL_FINAL = { width: 4 * BUTTON_SPACING, y: -0.08, ancho: 2 * BUTTON_SPACING - 0.04 } as const

/** Lo que crece el panel del final por arriba para la letra: cómo ha acabado y los puntos. */
export const SUBIDA_DEL_FINAL = 0.12
/** A qué tamaño se escribe cada cosa del final. */
export const LETRA_DEL_MARCADOR = { titulo: 0.03, puntos: 0.05, rotulo: 0.047 } as const

/** Lo que enseña el marcador. */
export interface EstadoDelMarcador {
  lang: Lang
  /** El modo jugado: el botón de repetir dice «Otro reto» en el reto y «Otra partida» en los demás. */
  modo: GameMode
  terminada: boolean
  fichas: readonly StickStatus[]
  racha: number
  /** Lo lleno de la barra y dónde va la marca del récord, de 0 a 1 (0: sin marca). */
  lleno: number
  marca: number
  record: boolean
  vidas: number | null
  /** Las estrellas del nivel acabado, o `null`. */
  estrellas: Stars | null
  /** Al acabar: cómo ha acabado, ya traducido, y los puntos. */
  titulo: string
  puntos: number
  /** A dos, quién tiene el mando; solo, `null`. */
  jugador?: Player | null
  /** El cartel de encima ya dice los puntos y las vidas: aquí no se repiten. */
  enElCartel?: boolean
}

/** El icono de quién juega a dos: a la izquierda de las vidas, y lo que crece la ficha de quien juega. */
const PAREJA = { x: -0.17, lado: 0.011, crece: 1.3 } as const

export interface AccionesDelMarcador {
  repetir(): void
  volverAlMenu(): void
}

export class Marcador {
  readonly nodo: Node3D
  readonly panel: Panel
  readonly repetir: Button
  readonly menu: Button
  private readonly contenido: Node3D
  private readonly fichas: MeshInstance3D[] = []
  private readonly rombos: MeshInstance3D[] = []
  private readonly carril: MeshInstance3D
  private readonly relleno: MeshInstance3D
  private readonly marca: MeshInstance3D
  private readonly corazones: MeshInstance3D[] = []
  private readonly estrellas: MeshInstance3D[] = []
  /** A dos, de quién es la tanda: la mesa y las dos fichas (`XRPlayersIcon` en el marcador de la web). */
  readonly pareja: Node3D
  private readonly fichasDeLaPareja: MeshInstance3D[]
  private ancho = 0
  private alto = 0

  constructor(acciones: AccionesDelMarcador, punteria: PointerAim) {
    // Opaco: translúcido, en Godot se transparenta mucho más que en la web (lienzo a 0,72).
    this.panel = new Panel({ ancho: 1, alto: 1, fondo: COLORES.panel, opacidad: 1 })
    // Fuera, el sitio de la web; dentro, el panel centrado en su fondo, que es como lo mide el
    // instrumento: al acabar crece por arriba y su centro sube.
    this.nodo = new Node3D()
    this.nodo.set_name('Marcador')
    this.nodo.add_child(this.panel.nodo)
    this.contenido = this.panel.nodo
    for (let i = 0; i < MAX_STICKS; i++) {
      const ficha = shape(arcTriangles(0, TOKEN_RADIUS, 0, Math.PI * 2, 20), TOKEN_STYLE.pending.color)
      this.contenido.add_child(ficha)
      this.fichas.push(ficha)
    }
    for (let i = 0; i < 5; i++) {
      const rombo = shape(
        [[0, -0.0085], [0.0085, 0], [0, 0.0085], [0, -0.0085], [0, 0.0085], [-0.0085, 0]],
        COLORES.estrella,
      )
      this.contenido.add_child(rombo)
      this.rombos.push(rombo)
    }
    this.carril = rectangulo(1, 0.012, COLORES.ficha, 0, 0, RENDER_ORDER.placa)
    this.relleno = rectangulo(1, 0.012, '#22c55e')
    this.marca = rectangulo(0.005, 1, COLORES.estrella, 0, 0, RENDER_ORDER.texto)
    this.contenido.add_child(this.carril)
    this.contenido.add_child(this.relleno)
    this.contenido.add_child(this.marca)
    for (let i = 0; i < CHALLENGE_LIVES; i++) {
      const corazon = iconoDeCorazon(LIFE_SIZE, LIFE_COLOR)
      this.contenido.add_child(corazon)
      this.corazones.push(corazon)
    }
    for (let i = 0; i < 3; i++) {
      const estrella = iconoDeEstrella(0.02, COLORES.estrella)
      this.contenido.add_child(estrella)
      this.estrellas.push(estrella)
    }

    this.pareja = new Node3D()
    this.contenido.add_child(this.pareja)
    const [mesa, ...fichas] = iconoDeJugadores(PAREJA.lado, COLORES.suave, '#475569', '#475569')
    this.pareja.add_child(mesa)
    for (const ficha of fichas) this.pareja.add_child(ficha)
    this.fichasDeLaPareja = fichas
    this.pareja.visible = false

    this.repetir = this.panel.boton(new Button({ id: 'again', caja: { x: -BUTTON_SPACING, y: 0, ...BUTTON_HIT }, color: COLORES.jugar, alPulsar: () => acciones.repetir() }))
    this.repetir.dibujo(iconoDeRepetir(0.026, '#ffffff'), '#ffffff')
    this.menu = this.panel.boton(new Button({ id: 'home', caja: { x: BUTTON_SPACING, y: 0, ...BUTTON_HIT }, color: COLORES.neutro, alPulsar: () => acciones.volverAlMenu() }))
    this.menu.dibujo(iconoDeCasa(0.028, '#ffffff'), '#ffffff')
    const puerta = huecosDeForma(XR_HOME_ICON, 0.028, COLORES.neutro)
    if (puerta != null) this.menu.dibujo(puerta, COLORES.neutro)
    punteria.anadir(this.repetir, this.menu)
  }

  /** Lo que mide el panel ahora. */
  get medida(): { width: number; height: number } {
    return { width: this.ancho, height: this.alto }
  }

  /** Pinta un estado: el panel a su medida, cada ficha, la barra, las vidas y, al acabar, la letra. */
  pintar(estado: EstadoDelMarcador): void {
    const n = estado.fichas.length
    const ancho = Math.max(n - 1, 0) * TOKEN_SPACING
    const terminada = estado.terminada
    const enElCartel = estado.enElCartel === true
    const vidas = enElCartel ? null : estado.vidas
    const conFila = vidas != null || estado.estrellas != null
    this.ancho = Math.max(ancho + 0.2, terminada ? ROTULOS_DEL_FINAL.width + 0.06 : 0)
    // El panel de la web, y al acabar lo que crece por arriba para la letra. Con el cartel encima
    // no crece: arriba está el cartel, que es quien dice cómo ha acabado.
    const reparto = xrHudLayout({ finished: terminada, row: conFila, sign: enElCartel })
    const subida = terminada && !enElCartel ? SUBIDA_DEL_FINAL : 0
    this.alto = reparto.height + subida
    const centro = reparto.centre + subida / 2
    this.panel.nodo.position = new Vector3(0, centro, 0)
    this.panel.fondo!.scale = new Vector3(this.ancho, this.alto, 1)
    // Las cotas del contenido son las de la web (su grupo a 0,1 al acabar y a 0,04 jugando), desde
    // el sitio del marcador: dentro del panel, menos lo que ha subido su centro.
    const y0 = reparto.content - centro

    this.fichas.forEach((ficha, i) => {
      const estadoDelPalo = estado.fichas[i]
      ficha.visible = estadoDelPalo != null
      if (estadoDelPalo == null) return
      const estilo = TOKEN_STYLE[estadoDelPalo]
      ficha.position = new Vector3(i * TOKEN_SPACING - ancho / 2, y0 + estilo.alto, 0.004)
      ficha.scale = new Vector3(estilo.escala, estilo.escala, 1)
      paint(ficha, estilo.color)
    })
    const rombos = Math.min(estado.racha, 5)
    this.rombos.forEach((rombo, i) => {
      rombo.visible = rombos >= 2 && i < rombos
      rombo.position = new Vector3((i - (rombos - 1) / 2) * 0.026, y0 + 0.06, 0.004)
    })
    const carril = Math.max(ancho, 0.28)
    const yBarra = y0 - 0.055
    this.carril.visible = !enElCartel
    this.relleno.visible = !enElCartel
    this.carril.scale = new Vector3(carril, 1, 1)
    this.carril.position = new Vector3(0, yBarra, 0.004)
    const lleno = Math.max(carril * estado.lleno, 0.001)
    this.relleno.scale = new Vector3(lleno, 1, 1)
    this.relleno.position = new Vector3((lleno - carril) / 2, yBarra, 0.006)
    paint(this.relleno, estado.record ? COLORES.estrella : '#22c55e')
    this.marca.visible = estado.marca > 0 && !enElCartel
    this.marca.scale = new Vector3(1, estado.record ? 0.034 : 0.024, 1)
    this.marca.position = new Vector3(carril * (estado.marca - 0.5), yBarra, 0.008)

    this.corazones.forEach((corazon, i) => {
      corazon.visible = vidas != null
      const gastada = vidas != null && i >= vidas
      const k = gastada ? 0.62 : 1
      corazon.scale = new Vector3(k, k, 1)
      corazon.position = new Vector3(i * LIFE_SPACING - ((CHALLENGE_LIVES - 1) * LIFE_SPACING) / 2, y0 + LIFE_ROW_Y, 0.004)
      paint(corazon, gastada ? LIFE_SPENT_COLOR : LIFE_COLOR)
    })
    this.estrellas.forEach((estrella, i) => {
      estrella.visible = estado.estrellas != null
      const ganada = estado.estrellas != null && i < estado.estrellas
      const k = ganada ? 1 : 0.7
      estrella.scale = new Vector3(k, k, 1)
      estrella.position = new Vector3((i - 1) * 0.045, y0 + LIFE_ROW_Y, 0.004)
      paint(estrella, ganada ? COLORES.estrella : COLORES.estrellaGastada)
    })

    // A dos, de quién es la tanda: la ficha de quien tiene el mando, encendida y crecida.
    const jugador = estado.jugador ?? null
    this.pareja.visible = jugador != null
    this.pareja.position = new Vector3(PAREJA.x, y0 + LIFE_ROW_Y, 0.004)
    this.fichasDeLaPareja.forEach((ficha, i) => {
      const suya = i === jugador
      const k = suya ? PAREJA.crece : 1
      ficha.scale = new Vector3(k, k, 1)
      paint(ficha, suya ? '#22c55e' : '#475569')
    })

    // Al acabar: repetir y volver al menú, en su fila de la web (0,12 por debajo de su cota).
    this.repetir.nodo.visible = terminada
    this.menu.nodo.visible = terminada
    this.repetir.nodo.position = new Vector3(-BUTTON_SPACING, -0.12 - centro, 0.02)
    this.menu.nodo.position = new Vector3(BUTTON_SPACING, -0.12 - centro, 0.02)

    const { panel } = this
    panel.borrarTextos()
    if (terminada) {
      // Los rótulos de los botones, como en la web (`dibujarRotulosDelFinal`).
      const t = traductor(estado.lang)
      const y = -0.12 - centro + ROTULOS_DEL_FINAL.y
      const letra = { alto: LETRA_DEL_MARCADOR.rotulo, color: COLORES.claro, anchoMax: ROTULOS_DEL_FINAL.ancho }
      panel.escribir(t(otraDelModo(estado.modo)), -BUTTON_SPACING, y, letra)
      panel.escribir(t('Menu'), BUTTON_SPACING, y, letra)
    }
    if (!terminada || enElCartel) return
    const arriba = this.alto / 2
    panel.escribir(estado.titulo, 0, arriba - 0.04, { alto: LETRA_DEL_MARCADOR.titulo, color: COLORES.claro, anchoMax: this.ancho - 0.04 })
    panel.escribir(formatoDeCifra(estado.puntos, estado.lang), 0, arriba - 0.09, {
      alto: LETRA_DEL_MARCADOR.puntos,
      color: estado.record ? COLORES.estrella : COLORES.claro,
      anchoMax: this.ancho - 0.06,
    })
  }
}
