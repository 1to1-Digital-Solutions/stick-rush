import {
  CombinedPointer,
  createGrabPointer,
  createRayPointer,
} from '@pmndrs/pointer-events'
import {
  BackSide,
  BoxGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  PerspectiveCamera,
  Scene,
  SphereGeometry,
} from 'three'
import { describe, expect, it } from 'vitest'
import {
  DECOR_POINTER_EVENTS,
  MENU_POINTER_ORDER,
  stickPointerEvents,
} from './punteros'
import {
  MACHINE_RADIUS,
  STICK_LENGTH,
  STICK_RADIUS,
} from './gameConfig'

/**
 * Que nada de la máquina deje al mando sin poder señalar el menú.
 *
 * Reportado con el visor puesto: «a veces seleccionando el menú de config es como que hay un
 * objeto delante mía y el cursor se corta. Es un objeto invisible que no veo y no me permite
 * seleccionar la opción que quiero».
 *
 * El objeto invisible es **un palo ya atrapado**: al cogerlo se apaga con `visible` —no se
 * desmonta, para no tirar su material y que haya que recompilar el shader—, pero sigue
 * teniendo sus `onPointerDown`, y al sistema de punteros la visibilidad no le dice nada. Como
 * quien juega está DENTRO de la máquina, esos palos cuelgan a 57 cm alrededor y el menú se
 * planta a 95 cm: siempre hay uno entre la mano y el botón.
 *
 * Aquí se monta lo mismo que monta la librería por cada mando del salón —un puntero de agarre
 * y un rayo combinados, el rayo por defecto— con las piezas de verdad de
 * `@pmndrs/pointer-events`, sin React ni navegador. Enfrente, lo que importa de esta escena:
 * el mundo con un palo, la cortina del cambio de escenario y un botón del menú.
 */

/** Dónde está la mano mientras se elige en el menú: delante del pecho, dentro de la máquina. */
const MANO = [0, 1.2, 0] as const
/** Y a qué distancia se planta el panel del menú, delante de la cara. */
const MENU_Z = -0.95

interface Montaje {
  scene: Scene
  boton: Mesh
  palo: Mesh
  cortina: Mesh
  grab: ReturnType<typeof createGrabPointer>
  ray: ReturnType<typeof createRayPointer>
  mover: () => void
}

/**
 * La escena, con o sin las reglas puestas.
 *
 * @param conLasReglas Si el mundo se declara fuera del alcance del rayo, el palo dice si se
 *   puede coger y la interfaz va por delante en el orden.
 * @param catchable    Si el palo se puede coger ahora mismo. Atrapado o en el menú, no.
 */
function montar({
  conLasReglas,
  catchable = false,
}: {
  conLasReglas: boolean
  catchable?: boolean
}): Montaje {
  const scene = new Scene()

  // El mundo: la máquina, el decorado y la cortina del cambio de escenario.
  const mundo = new Group()
  if (conLasReglas) mundo.pointerEvents = DECOR_POINTER_EVENTS

  // La cortina: una esfera de 35 cm alrededor de la cabeza, apagada con `visible`.
  const cortina = new Mesh(
    new SphereGeometry(0.35, 16, 12),
    new MeshBasicMaterial({ side: BackSide }),
  )
  cortina.visible = false
  cortina.position.set(MANO[0], MANO[1], MANO[2])
  mundo.add(cortina)

  // Un palo, colgando entre la mano y el panel. Sin poder cogerse está además invisible,
  // porque ya se atrapó: es exactamente el estado en el que se reportó el fallo, y escuchando
  // igual.
  const paloEntero = new Group()
  paloEntero.visible = catchable
  if (conLasReglas) paloEntero.pointerEvents = stickPointerEvents(catchable)
  const palo = new Mesh(
    new CylinderGeometry(STICK_RADIUS, STICK_RADIUS, STICK_LENGTH, 16),
    new MeshBasicMaterial(),
  )
  palo.addEventListener('pointerdown', () => {})
  paloEntero.position.set(MANO[0], MANO[1], MANO[2] - MACHINE_RADIUS)
  paloEntero.add(palo)
  mundo.add(paloEntero)

  scene.add(mundo)

  // La interfaz inmersiva, con su botón delante de la cara.
  const interfaz = new Group()
  if (conLasReglas) interfaz.pointerEventsOrder = MENU_POINTER_ORDER
  const boton = new Mesh(new BoxGeometry(0.2, 0.1, 0.02), new MeshBasicMaterial())
  boton.position.set(MANO[0], MANO[1], MENU_Z)
  boton.addEventListener('pointerdown', () => {})
  interfaz.add(boton)
  scene.add(interfaz)

  // El espacio del mando, mirando al −Z como el de WebXR.
  const mando = new Object3D()
  mando.position.set(...MANO)
  scene.add(mando)
  scene.updateMatrixWorld(true)

  // Lo que monta el salón por cada mando: agarre y rayo, con el rayo por defecto.
  const camera = new PerspectiveCamera()
  const space = { current: mando }
  const grab = createGrabPointer(() => camera, space, {})
  const ray = createRayPointer(() => camera, space, {}, { minDistance: 0.2 })
  const combinado = new CombinedPointer(false)
  combinado.register(grab)
  combinado.register(ray, true)

  return {
    scene,
    boton,
    palo,
    cortina,
    grab,
    ray,
    mover: () => combinado.move(scene, { timeStamp: performance.now() }),
  }
}

describe('el rayo del mando dentro de la máquina', () => {
  it('sin la regla, un palo ya atrapado e invisible se queda con el mando', () => {
    // El fallo tal cual. Se deja reproducido para que, si un día la librería empieza a saltarse
    // lo invisible, esto avise de que la regla quizá sobra en vez de seguir pasando en vacío.
    const { ray, palo, boton, mover } = montar({ conLasReglas: false })
    mover()

    // El rayo se para en el palo, a 57 cm, y el botón que hay detrás a 95 no se entera.
    expect(ray.getIntersection()?.object).toBe(palo)
    expect(ray.getIntersection()?.object).not.toBe(boton)
  })

  it('y uno pegado a la mano apaga el rayo entero: el cursor desaparece', () => {
    // Quien juega está dentro del arco de palos, así que la mano acaba junto a uno. El puntero
    // de agarre da por tocado a distancia cero lo que la envuelve y deja el rayo apagado: es
    // lo mismo que rompió skeet, con un palo de 39 cm en vez de una burbuja de 120 m.
    const montaje = montar({ conLasReglas: false })
    montaje.palo.parent!.position.set(...MANO)
    montaje.scene.updateMatrixWorld(true)
    montaje.mover()

    expect(montaje.grab.getEnabled()).toBe(true)
    expect(montaje.grab.getIntersection()?.object).toBe(montaje.palo)
    expect(montaje.grab.getIntersection()?.distance).toBe(0)
    expect(montaje.ray.getEnabled()).toBe(false)
  })

  it('con la regla, el rayo llega al botón del menú', () => {
    const { boton, grab, ray, mover } = montar({ conLasReglas: true })
    mover()

    expect(ray.getEnabled()).toBe(true)
    expect(ray.getIntersection()?.object).toBe(boton)
    expect(grab.getEnabled()).toBe(false)
  })

  it('y con un palo que SÍ se puede coger delante, el botón se lleva el rayo igual', () => {
    // La pregunta de salir sale en plena partida, con palos cayendo entre la mano y el botón:
    // ahí no vale apagar el palo, tiene que ganar el orden.
    const { boton, ray, mover } = montar({ conLasReglas: true, catchable: true })
    mover()

    expect(ray.getEnabled()).toBe(true)
    expect(ray.getIntersection()?.object).toBe(boton)
  })

  it('pero sin nada de menú delante, el palo que se puede coger sigue cogiéndose', () => {
    // Negarle el rayo al decorado no puede costar la partida: el palo vuelve a encenderse solo.
    const montaje = montar({ conLasReglas: true, catchable: true })
    montaje.scene.remove(montaje.boton.parent!)
    montaje.mover()

    expect(montaje.ray.getIntersection()?.object ?? montaje.grab.getIntersection()?.object).toBe(
      montaje.palo,
    )
  })

  it('y la cortina del cambio de escenario no envuelve el mando', () => {
    // Una esfera de 35 cm alrededor de la cabeza pasa de sobra el filtro de agarre del salón
    // (medio metro): si algún día escuchara algo, se quedaría el mando entero.
    const { cortina, grab, ray, mover } = montar({ conLasReglas: true })
    mover()

    expect(grab.getIntersection()?.object).not.toBe(cortina)
    expect(ray.getIntersection()?.object).not.toBe(cortina)
  })
})

describe('la regla del palo', () => {
  it('lo enciende explícitamente cuando se puede coger, porque hereda el «none» del mundo', () => {
    expect(stickPointerEvents(true)).toBe('auto')
  })

  it('y lo apaga cuando no', () => {
    expect(stickPointerEvents(false)).toBe('none')
  })
})
