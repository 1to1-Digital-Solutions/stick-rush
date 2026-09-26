/**
 * El mundo de Stick Rush en Godot contra la web: la máquina con las piezas que cuenta
 * `StickMachine.tsx`, a la altura del aro; los palos pintados donde los pone la tanda, con el
 * destello del acierto y el tinte del fallo; la feria con las piezas del kit donde las pone
 * `feriaKit.ts`, el público de `crowdLayout.ts` y la noria; tu habitación; las ayudas con el guion de
 * la web; y lo que viaja en el paquete, que es lo de la web byte a byte.
 *
 * Corre dentro del motor, con los tests de dominio.
 */
import { Color, FileAccess, MeshInstance3D, Node3D, ProjectSettings, StandardMaterial3D, type MultiMeshInstance3D } from 'godot'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { MandoDeVerdad } from '@kit/runtime/ui/mando'

import { crowdSpots } from '@/lib/crowdLayout'
import { PIEZAS, colocaciones } from '@/lib/feriaKit'
import { MACHINE_HEIGHT, MAX_STICKS, STICK_CAUGHT_COLOR, STICK_MISS_Y, WOOD_TEXTURES } from '@/lib/gameConfig'
import { GUION_DE_AYUDAS, caidaDelFantasma, paloDelFantasma } from '@/lib/guionDeAyudas'
import { WHEEL_CABIN_COUNT } from '@/lib/sceneryLayout'
import { gameStorage } from '@/lib/storage'

import { Tanda } from '../juego/tanda'
import { AyudasDelJuego } from './ayudas'
import { Escenario, Feria, type VistaDeLaHabitacion } from './feria'
import { ARC_SEGMENTS, Maquina, TRUSS_POSTS, TUBE_RADIUS } from './maquina'
import { PalosPintados, rutaDeLaTextura } from './palos'

const DIR_DE_LOS_MANDOS = 'res://games/stick-rush/mandos'
const perfil = () => 'oculus-touch-v3'

describe('la máquina', () => {
  let padre: Node3D
  beforeEach(() => {
    padre = new Node3D()
  })
  afterEach(() => padre.free())

  it('lleva las piezas que cuenta la web: el aro a rayas, los dos postes, la celosía y las bombillas', () => {
    const maquina = new Maquina(padre)
    maquina.colocar(MACHINE_HEIGHT)
    // Aro de arriba, montantes, diagonales y los dos tirantes (`limits.truss`).
    const celosia = ARC_SEGMENTS + TRUSS_POSTS + (TRUSS_POSTS - 1) + 2
    expect(maquina.piezas).toEqual({ matte: ARC_SEGMENTS, frame: 2, truss: celosia, bulbs: TRUSS_POSTS - 1 })
  })

  it('se rehace al cambiar el aro de altura, y solo entonces', () => {
    const maquina = new Maquina(padre)
    maquina.colocar(MACHINE_HEIGHT)
    const antes = maquina.nodo.get_child(0)
    maquina.colocar(MACHINE_HEIGHT)
    expect(maquina.nodo.get_child(0)).toBe(antes)
    maquina.colocar(2.2)
    expect(maquina.nodo.get_child(maquina.nodo.get_child_count() - 1)).not.toBe(antes)
  })
})

describe('los palos pintados', () => {
  let padre: Node3D
  beforeEach(() => {
    padre = new Node3D()
  })
  afterEach(() => padre.free())

  it('cada palo de la tanda en su anclaje, con su gancho; los que sobran, fuera', () => {
    const palos = new PalosPintados(padre)
    const tanda = new Tanda('a', 5, 7, MACHINE_HEIGHT, false)
    palos.pintar(tanda)
    const grupos: Node3D[] = []
    for (let i = 0; i < palos.nodo.get_child_count(); i++) {
      const hijo = palos.nodo.get_child(i) as Node3D
      if (String(hijo.get_name()).startsWith('Palo')) grupos.push(hijo)
    }
    expect(grupos.length).toBe(MAX_STICKS)
    expect(grupos.filter((g) => g.visible).length).toBe(7)
    const [x, y, z] = tanda.palos[3].layout.anchor
    const sitio = grupos[3].position
    expect([sitio.x, sitio.y, sitio.z].map((v) => Number(v.toFixed(4)))).toEqual([x, y, z].map((v) => Number(v.toFixed(4))))
    // El cuerpo cuelga un hilo por debajo: el centro del palo, en el espacio del grupo.
    expect(palos.cuerpo(3).position.y).toBeCloseTo(-0.11 - 0.39 / 2)
    expect(TUBE_RADIUS).toBe(0.032)
  })

  it('el atrapado se pone verde y crece; el perdido se queda en el suelo, rojo', () => {
    const palos = new PalosPintados(padre)
    const tanda = new Tanda('a', 5, 5, MACHINE_HEIGHT, false)
    tanda.atrapar(1, false)
    tanda.avanzar(0.2, { parada: true, velocidad: 1 })
    palos.pintar(tanda)
    const material = palos.cuerpo(1).material_override as StandardMaterial3D
    const verde = Color.html(STICK_CAUGHT_COLOR)
    expect([material.albedo_color.r, material.albedo_color.g].map((v) => Number(v.toFixed(3)))).toEqual([verde.r, verde.g].map((v) => Number(v.toFixed(3))))
    expect(material.emission_energy_multiplier).toBeGreaterThan(0)
    const grupo = palos.cuerpo(1).get_parent() as Node3D
    expect(grupo.scale.x).toBeGreaterThan(1)
    // El perdido.
    const perdida = new Tanda('b', 5, 5, MACHINE_HEIGHT, false)
    for (let i = 0; i < 72 * 30; i++) perdida.avanzar(1 / 72, { parada: false, velocidad: 2.16 })
    palos.pintar(perdida)
    const rojo = palos.cuerpo(0).material_override as StandardMaterial3D
    expect(rojo.albedo_color.r).toBeGreaterThan(rojo.albedo_color.g * 3)
    expect((palos.cuerpo(0).get_parent() as Node3D).position.y).toBeCloseTo(STICK_MISS_Y)
  })

  it('la madera lleva el relieve y la rugosidad de la web, sin su color', () => {
    const palos = new PalosPintados(padre)
    const material = palos.cuerpo(0).material_override as StandardMaterial3D
    expect(material.normal_enabled).toBe(true)
    expect(material.normal_texture).not.toBe(null)
    expect(material.roughness_texture).not.toBe(null)
    expect(material.albedo_texture).toBe(null)
  })
})

describe('la feria y tu habitación', () => {
  let escena: Node3D
  let mundo: Node3D
  let feria: Feria
  let transparente: boolean[]
  let passthrough: boolean
  const vista: VistaDeLaHabitacion = { hayPassthrough: () => passthrough, transparente: (si) => transparente.push(si) }

  beforeEach(() => {
    gameStorage()?.clear()
    escena = new Node3D()
    mundo = new Node3D()
    escena.add_child(mundo)
    feria = new Feria(escena, mundo)
    transparente = []
    passthrough = false
  })
  afterEach(() => escena.free())

  it('las tres piezas del kit donde las pone `colocaciones()`, el público y la noria', () => {
    const todas = colocaciones()
    expect(feria.recuento).toEqual({
      piezas: Object.fromEntries(PIEZAS.map((p) => [p, todas.filter((c) => c.pieza === p).length])),
      siluetas: crowdSpots().length,
      cabinas: WHEEL_CABIN_COUNT,
    })
  })

  it('el color de las piezas del kit es el de sus vértices', () => {
    const puesto = feria.recinto.find_child('Piezas-puesto', true, false) as MultiMeshInstance3D
    expect((puesto.material_override as StandardMaterial3D).vertex_color_use_as_albedo).toBe(true)
    expect(puesto.multimesh!.instance_count).toBe(colocaciones().filter((c) => c.pieza === 'puesto').length)
  })

  it('con la racha las bombillas suben de brillo y la noria gira', () => {
    const guirnaldas = feria.recinto.find_child('Guirnaldas', true, false) as MultiMeshInstance3D
    const material = guirnaldas.material_override as StandardMaterial3D
    const antes = material.albedo_color.r + material.albedo_color.g
    for (let i = 0; i < 120; i++) feria.actualizar(1 / 60, 12)
    expect(material.albedo_color.r + material.albedo_color.g).toBeGreaterThan(antes)
    const rueda = feria.recinto.find_child('Rueda', true, false) as Node3D
    expect(rueda.rotation.z).toBeGreaterThan(0)
  })

  it('sin realidad aumentada se ve la plaza aunque el salón pida la habitación; con ella, la habitación', () => {
    gameStorage()?.setItem('xrcade:scenery', 'room')
    const escenario = new Escenario(feria, vista)
    escenario.actualizar()
    expect([feria.recinto.visible, transparente]).toEqual([true, [false]])
    passthrough = true
    escenario.actualizar()
    expect([feria.recinto.visible, transparente]).toEqual([false, [false, true]])
    escenario.elegir('place')
    escenario.actualizar()
    expect(feria.recinto.visible).toBe(true)
  })
})

describe('las ayudas', () => {
  let maquina: Node3D
  let mando: MandoDeVerdad
  let ayudas: AyudasDelJuego
  beforeEach(() => {
    maquina = new Node3D()
    mando = new MandoDeVerdad({ mano: 'right', dir: DIR_DE_LOS_MANDOS, perfil })
    ayudas = new AyudasDelJuego(maquina, [mando])
  })
  afterEach(() => maquina.free())

  const sinHacer = { grab: false, cae: false }

  it('sin visor no sale ninguna', () => {
    for (let i = 0; i < 60; i++) ayudas.actualizar(1 / 60, { dando: false, hechos: sinHacer, aro: MACHINE_HEIGHT, mano: 'right' })
    expect(ayudas.visibles()).toEqual([])
  })

  it('con visor salen las tres del guion, y se apagan con lo hecho', () => {
    for (let i = 0; i < 60; i++) ayudas.actualizar(1 / 60, { dando: true, hechos: sinHacer, aro: MACHINE_HEIGHT, mano: 'right' })
    expect(ayudas.visibles()).toEqual(GUION_DE_AYUDAS.map((a) => a.id))
    for (let i = 0; i < 60; i++) ayudas.actualizar(1 / 60, { dando: true, hechos: { grab: false, cae: true }, aro: MACHINE_HEIGHT, mano: 'right' })
    expect(ayudas.visibles()).toEqual(['suelo'])
    for (let i = 0; i < 60; i++) ayudas.actualizar(1 / 60, { dando: true, hechos: { grab: true, cae: true }, aro: MACHINE_HEIGHT, mano: 'right' })
    expect(ayudas.visibles()).toEqual([])
  })

  it('el palo fantasma cae desde el palo de delante como `caidaDelFantasma`', () => {
    let reloj = 0
    for (let i = 0; i < 50; i++) {
      ayudas.actualizar(1 / 60, { dando: true, hechos: sinHacer, aro: MACHINE_HEIGHT, mano: 'right' })
      reloj += 1 / 60
    }
    const fantasma = ayudas.nodo.find_child('PaloFantasma', true, false) as MeshInstance3D
    const [, y] = paloDelFantasma(MACHINE_HEIGHT)
    const { bajada } = caidaDelFantasma((reloj % 2.4) / 2.4)
    expect(fantasma.position.y).toBeCloseTo(y - bajada, 3)
  })
})

describe('lo que viaja en el paquete es lo de la web, byte a byte', () => {
  const delRepo = (ruta: string) => FileAccess.get_file_as_bytes(`${ProjectSettings.globalize_path('res://')}../${ruta}`)
  const delPaquete = (ruta: string) => FileAccess.get_file_as_bytes(`res://games/stick-rush/${ruta}`)

  it.each([...PIEZAS])('la pieza del kit %s', (pieza) => {
    const web = delRepo(`public/models/kit/${pieza}.glb`)
    expect(web.size()).toBeGreaterThan(0)
    expect(delPaquete(`feria/${pieza}.glb`).hex_encode()).toBe(web.hex_encode())
  })

  it.each(Object.values(WOOD_TEXTURES))('el mapa de la madera %s', (ruta) => {
    const web = delRepo(`public/${ruta}`)
    expect(web.size()).toBeGreaterThan(0)
    expect(FileAccess.get_file_as_bytes(rutaDeLaTextura(ruta)).hex_encode()).toBe(web.hex_encode())
  })

  it('el cielo y la música', () => {
    for (const [paquete, web] of [
      ['hdri/plaza_pueblo_1k.exr', 'public/hdri/plaza_pueblo_1k.exr'],
      ['music/feria.mp3', 'public/audio/feria.mp3'],
    ]) {
      const bytes = delRepo(web)
      expect(bytes.size(), web).toBeGreaterThan(0)
      expect(delPaquete(paquete).hex_encode(), web).toBe(bytes.hex_encode())
    }
  })

  it.each(['meta-quest-touch-plus', 'oculus-touch-v3'])('el mando %s, sus dos manos y su perfil', (p) => {
    for (const f of ['profile.json', 'left.glb', 'right.glb']) {
      const web = delRepo(`public/webxr-profiles/${p}/${f}`)
      expect(web.size(), f).toBeGreaterThan(0)
      expect(delPaquete(`mandos/${p}/${f}`).hex_encode(), f).toBe(web.hex_encode())
    }
  })
})
