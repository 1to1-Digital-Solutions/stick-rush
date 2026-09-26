/**
 * Las ayudas visuales de Stick Rush en Godot (`Ayudas.tsx` de la web): lo que hay que hacer,
 * enseñado sin una letra. Las **huellas** del suelo dicen dónde plantarse —en el centro del aro, de
 * frente a la máquina—; el **palo fantasma**, un cilindro algo más gordo que el palo, cae una y otra
 * vez desde el palo de delante hasta la altura del pecho, que es por dónde van a pasar; y **el mando
 * de verdad** a su lado, con el botón de agarre latiendo, dice con qué se cogen.
 *
 * **Ninguna se queda puesta.** Cuándo se enciende y se apaga cada una lo decide el guion de la web
 * (`lib/guionDeAyudas.ts`) sobre el motor común de los juegos (`lib/ayudas.ts`), los dos tal cual, y
 * las cotas son las suyas (`HUELLAS`, `paloDelFantasma`, `caidaDelFantasma`, `mandoJuntoAlPalo`): aquí
 * solo se pinta. Todo se monta de una vez y se enciende con `visible` y la opacidad.
 *
 * Como en la web, **solo con el visor puesto** (`dando`); `-- --ayudas` las enseña en plano.
 */
import { Node3D, Vector3, type MeshInstance3D, type StandardMaterial3D } from 'godot'

import { triangulosDeArco } from '@kit/lib/ui/iconos'
import type { Mano } from '@kit/lib/xr/manos'
import type { MandoDeVerdad } from '@kit/runtime/ui/mando'

import { COLOR_DE_LA_AYUDA, LATIDO, acercarse, avanzarLasAyudas, latido, pase, sinAyudas } from '@/lib/ayudas'
import {
  CAIDA,
  FANTASMA,
  GUION_DE_AYUDAS,
  HUELLA,
  HUELLAS,
  HUELLAS_Y,
  MANDO_JUNTO_AL_PALO,
  caidaDelFantasma,
  mandoJuntoAlPalo,
  paloDelFantasma,
  type AyudaDeLaMaquina,
  type HechoDeLasAyudas,
} from '@/lib/guionDeAyudas'
import { TUTORIAL_BUTTONS } from '@/lib/tutorial'

import { cilindro, malla, mallaPlana, opacidad, sinSombra, translucido } from '@kit/runtime/escena/piezas'

/** Lo transparente que llega a ponerse cada ayuda encendida del todo (`OPACIDAD` de `Ayudas.tsx`). */
export const OPACIDAD_DE_LA_AYUDA = { suelo: 0.75, palo: 0.6 } as const

/** Por debajo de esto, una ayuda que se apaga ya no se pinta (el `0.004` de la web). */
const APAGADA = 0.004

/**
 * Lo que se levantan las huellas sobre el suelo: la web las separa sesgando la profundidad
 * (`polygonOffset`), que en Godot no hay; van por encima con la prioridad de su material y, por si
 * la profundidad se pelea, dos milímetros arriba.
 */
const CALCO = 0.002

/** Lo que las ayudas necesitan saber cada fotograma. */
export interface MomentoDeLasAyudas {
  /** Con el visor puesto (o forzadas en plano): sin eso, no se enseñan ni corren sus plazos. */
  dando: boolean
  /** Lo que ya ha pasado: un palo atrapado, palos a punto de caer. Se acumula aquí. */
  hechos: Readonly<Record<HechoDeLasAyudas, boolean>>
  /** La altura del aro, de la que cuelga el palo de delante. */
  aro: number
  mano: Mano
  /** Sin movimiento (`prefers-reduced-motion` en la web): no late ni cae. */
  quieto?: boolean
}

interface Pieza {
  nodo: MeshInstance3D
  material: StandardMaterial3D
}

export class AyudasDelJuego {
  readonly nodo = new Node3D()
  private readonly estado = sinAyudas()
  private readonly fuerzas: Record<AyudaDeLaMaquina, number> = { suelo: 0, palo: 0, mando: 0 }
  private readonly hechos: Record<HechoDeLasAyudas, boolean> = { grab: false, cae: false }
  private readonly huellas: Pieza[] = []
  private readonly palo: Pieza
  private readonly sitioDelMando = new Node3D()
  private reloj = 0
  private colocado = ''
  /** Si en el último fotograma no se veía ninguna. */
  private apagadas = false

  constructor(
    /** El espacio de la máquina: el guion está escrito respecto del centro del aro. */
    maquina: Node3D,
    /** El mando de verdad de cada mano, junto al palo fantasma (los del kit), o ninguno. */
    readonly mandos: readonly MandoDeVerdad[] = [],
  ) {
    this.nodo.set_name('Ayudas')
    maquina.add_child(this.nodo)
    HUELLAS.forEach((h, i) => {
      // Una huella es un óvalo: el círculo de doce lados estirado a lo largo del pie.
      const material = translucido(COLOR_DE_LA_AYUDA, 0, 3)
      const nodo = malla(mallaPlana(triangulosDeArco(0, 1, 0, Math.PI * 2, 12)), material)
      nodo.set_name(`Huella${i}`)
      nodo.position = new Vector3(h.x, HUELLAS_Y + CALCO, h.z)
      nodo.rotation = new Vector3(-Math.PI / 2, 0, 0)
      nodo.scale = new Vector3(HUELLA.ancho / 2, HUELLA.largo / 2, 1)
      nodo.visible = false
      this.nodo.add_child(nodo)
      this.huellas.push({ nodo, material })
    })
    const material = translucido(COLOR_DE_LA_AYUDA, 0, 4)
    const palo = cilindro(FANTASMA.radio, FANTASMA.radio, FANTASMA.largo, material, undefined, 12)
    palo.set_name('PaloFantasma')
    palo.visible = false
    this.nodo.add_child(palo)
    this.palo = { nodo: palo, material }
    this.sitioDelMando.set_name('MandoJuntoAlPalo')
    this.nodo.add_child(this.sitioDelMando)
    for (const mando of mandos) this.sitioDelMando.add_child(mando.nodo)
    // Una ayuda no es decorado: no echa sombra, como en la web.
    sinSombra(this.nodo)
  }

  /** Lo que se ve de cada ayuda ahora mismo, de 0 a 1. */
  get fuerza(): Readonly<Record<AyudaDeLaMaquina, number>> {
    return this.fuerzas
  }

  /** Coloca el mando al lado de donde se para el fantasma, del lado de la mano. */
  private colocar(aro: number, mano: Mano): void {
    const clave = `${aro}:${mano}`
    if (clave === this.colocado) return
    this.colocado = clave
    const { posicion, giro } = mandoJuntoAlPalo(aro, mano)
    this.sitioDelMando.position = new Vector3(posicion[0], posicion[1], posicion[2])
    this.sitioDelMando.rotation = new Vector3(0, giro, 0)
    const k = MANDO_JUNTO_AL_PALO.escala
    this.sitioDelMando.scale = new Vector3(k, k, k)
  }

  actualizar(delta: number, momento: MomentoDeLasAyudas): void {
    this.reloj += delta
    const { dando } = momento
    this.colocar(momento.aro, momento.mano)
    // Se acumulan: hacer algo no se deshace.
    for (const h of Object.keys(this.hechos) as HechoDeLasAyudas[]) this.hechos[h] = this.hechos[h] || momento.hechos[h]
    const paso = avanzarLasAyudas(GUION_DE_AYUDAS, this.hechos, this.estado, dando ? delta : 0)
    const pulso = momento.quieto ? 1 : latido(this.reloj, LATIDO.fuerza)
    let alguna = false
    for (const ayuda of GUION_DE_AYUDAS) {
      const quiere = dando && paso.encendidas.has(ayuda.id) ? 1 : 0
      this.fuerzas[ayuda.id] = acercarse(this.fuerzas[ayuda.id], quiere, delta)
      if (this.fuerzas[ayuda.id] > APAGADA) alguna = true
    }
    // Todas apagadas y ya escondidas: nada que pintar, y no se toca el motor.
    if (!alguna && this.apagadas) return
    this.apagadas = !alguna
    const f = this.fuerzas

    // Las huellas, latiendo: es lo que las separa de una losa más de la plaza.
    for (const h of this.huellas) {
      h.nodo.visible = f.suelo > APAGADA
      opacidad(h.material, f.suelo * OPACIDAD_DE_LA_AYUDA.suelo * pulso)
    }
    // El palo fantasma, cayendo desde el de delante. No late: ya se mueve.
    const vuelta = momento.quieto ? { bajada: CAIDA.recorrido / 2, se: 1 } : caidaDelFantasma(pase(this.reloj, CAIDA.periodo).avance)
    const [x, y, z] = paloDelFantasma(momento.aro)
    this.palo.nodo.position = new Vector3(x, y - vuelta.bajada, z)
    this.palo.nodo.visible = f.palo > APAGADA
    opacidad(this.palo.material, f.palo * OPACIDAD_DE_LA_AYUDA.palo * vuelta.se)

    // El mando de verdad de la mano buena, con el agarre latiendo.
    for (const mando of this.mandos) {
      if (f.mando > APAGADA && mando.mano === momento.mano) {
        mando.encender(TUTORIAL_BUTTONS.grab)
        mando.actualizar(delta)
      } else mando.apagar()
    }
  }

  /** Lo que de verdad se ve: las ayudas con algo pintado ahora mismo. */
  visibles(): AyudaDeLaMaquina[] {
    const visible: Record<AyudaDeLaMaquina, boolean> = {
      suelo: this.huellas.some((h) => h.nodo.visible),
      palo: this.palo.nodo.visible,
      mando: this.mandos.some((m) => m.visible),
    }
    return GUION_DE_AYUDAS.map((a) => a.id).filter((id) => visible[id])
  }
}
