import { describe, expect, it } from 'vitest'
import {
  MISION_DEL_RETO,
  MODO_DE_LAS_MEDALLAS,
  PUNTOS_DE_UN_PALO,
  enPalos,
  palosPara,
  RETARDO_DEL_LISTON,
  VISTA_SIN_GIRAR,
  apartadoDeLaMirada,
  esquinasDelCartel,
  llevaLaCuenta,
  loQueQueda,
  partidaDelCartel,
  poseDelCartel,
  pulsosDelListon,
  sitioDelCartel,
  tactoDelListon,
  type LoQueSeJuega,
  type ProporcionDelCartel,
} from './cartelDeLaMaquina'
import { MACHINE_HEIGHT, MAX_STICKS, PLAYER_OFFSET_Z, STICK_CORD_LENGTH, STICK_LENGTH, STICK_RADIUS } from './gameConfig'
import { CHALLENGE_LIVES, CHALLENGE_SETUP, DEFAULT_GAME_MODE } from './gameMode'
import { MAX_EYE_HEIGHT, MIN_EYE_HEIGHT, REFERENCE_EYE_HEIGHT } from './hoopHeight'
import { goalSign, medalToCelebrate, type Goal } from './goal'
import { pointOnPanel } from './panelReading'
import { buildStickLayout } from './stickLayout'
import { pulsesFor } from './hapticFeedback'
import { traductorSuave } from './textos'
import {
  TUTORIAL_PANEL,
  XR_CARTEL_POSITION,
  XR_CONFIRM_POSITION,
  XR_CONFIRM_SIZE,
  XR_HUD_POSITION,
  XR_TUTORIAL_POSITION,
  xrHudLayout,
  xrUiRise,
} from './xrLayout'

/**
 * El cartel del objetivo en la máquina: que se lea de frente y sin girar la cabeza, que no tape
 * ningún palo ni se pise con los paneles de alrededor, y que cuente la partida que toca.
 */

/** Lo que mide el cartel por metro de distancia: 24° de ancho por 4,5° de alto, como el de verdad. */
const PROPORCION: ProporcionDelCartel = {
  width: 2 * Math.tan((12 * Math.PI) / 180),
  height: 2 * Math.tan((2.25 * Math.PI) / 180),
}

/** Lo más que crece el cartel al celebrar un listón (`pulsoDelFestejo`). */
const CRECIDO = 1.12

const SITIO = sitioDelCartel()
const ALTO = PROPORCION.height * SITIO.distancia

/** Hasta dónde llega el cartel por arriba y por abajo, también mientras celebra. */
const ARRIBA = pointOnPanel(poseDelCartel(), 0, (ALTO * CRECIDO) / 2).y
const ABAJO = pointOnPanel(poseDelCartel(), 0, (-ALTO * CRECIDO) / 2).y

describe('dónde se lee el cartel', () => {
  it('de frente: centrado, sin girar hacia ningún lado', () => {
    expect(SITIO.position).toBe(XR_CARTEL_POSITION)
    expect(SITIO.position[0]).toBe(0)
    expect(SITIO.rotation[1]).toBe(0)
    expect(SITIO.rotation[2]).toBe(0)
  })

  it('mira a los ojos de quien juega: se lee de frente y a la distancia que dice', () => {
    const [x, y, z] = SITIO.position
    const haciaLosOjos = { x: -x, y: REFERENCE_EYE_HEIGHT - y, z: -z }
    const distancia = Math.hypot(haciaLosOjos.x, haciaLosOjos.y, haciaLosOjos.z)
    expect(SITIO.distancia).toBeCloseTo(distancia)

    // La normal del panel sale de dos puntos suyos: un paso a la derecha y otro hacia arriba.
    const pose = poseDelCartel()
    const centro = pointOnPanel(pose, 0, 0)
    const derecha = pointOnPanel(pose, 1, 0)
    const arriba = pointOnPanel(pose, 0, 1)
    const u = { x: derecha.x - centro.x, y: derecha.y - centro.y, z: derecha.z - centro.z }
    const v = { x: arriba.x - centro.x, y: arriba.y - centro.y, z: arriba.z - centro.z }
    const normal = { x: u.y * v.z - u.z * v.y, y: u.z * v.x - u.x * v.z, z: u.x * v.y - u.y * v.x }
    const coseno = (normal.x * haciaLosOjos.x + normal.y * haciaLosOjos.y + normal.z * haciaLosOjos.z) / distancia
    expect(coseno).toBeCloseTo(1, 5)
  })

  it('queda dentro de lo que se ve sin girar la cabeza desde la postura de juego', () => {
    for (const esquina of esquinasDelCartel(PROPORCION)) {
      expect(apartadoDeLaMirada(esquina)).toBeLessThanOrEqual(VISTA_SIN_GIRAR)
    }
    // Por debajo de la mirada, no encima: a unos 27°, que se alcanza bajando los ojos.
    const centro = { x: SITIO.position[0], y: SITIO.position[1], z: SITIO.position[2] }
    expect(SITIO.position[1]).toBeLessThan(REFERENCE_EYE_HEIGHT)
    expect(apartadoDeLaMirada(centro)).toBeGreaterThan(20)
    expect(apartadoDeLaMirada(centro)).toBeLessThan(30)
    expect(VISTA_SIN_GIRAR).toBeLessThanOrEqual(35)
  })

  it('y juegue quien juegue: sube y baja con los ojos, como el resto de la interfaz', () => {
    for (const ojos of [MIN_EYE_HEIGHT, 1.15, REFERENCE_EYE_HEIGHT, MAX_EYE_HEIGHT]) {
      const subida = xrUiRise(ojos)
      for (const esquina of esquinasDelCartel(PROPORCION)) {
        const dondeQueda = { ...esquina, y: esquina.y + subida }
        expect(apartadoDeLaMirada(dondeQueda, ojos), `ojos a ${ojos}`).toBeLessThanOrEqual(VISTA_SIN_GIRAR)
        expect(dondeQueda.y, `ojos a ${ojos}`).toBeGreaterThan(0)
      }
    }
  })

  it('no tapa ningún palo: todos caen más cerca de quien juega que el cartel', () => {
    // Quien juega está un paso por detrás del centro del aro, y el mundo se corre eso mismo.
    const palos = buildStickLayout(MAX_STICKS, 1).map(({ anchor: [x, , z] }) => Math.hypot(x, z - PLAYER_OFFSET_Z) + STICK_RADIUS)
    expect(palos).toHaveLength(MAX_STICKS)
    const elMasLejano = Math.max(...palos)

    // Lo más cerca que llega el cartel, girado como esté la interfaz: su borde de abajo.
    const pose = poseDelCartel()
    const ancho = PROPORCION.width * SITIO.distancia * CRECIDO
    const bordes = [-1, 0, 1].flatMap((x) => [-1, 1].map((y) => pointOnPanel(pose, (x * ancho) / 2, (y * ALTO * CRECIDO) / 2)))
    const loMasCerca = Math.min(...bordes.map((punto) => Math.hypot(punto.x, punto.z)))

    expect(elMasLejano).toBeLessThan(0.7)
    expect(loMasCerca).toBeGreaterThan(elMasLejano + 0.1)
  })

  it('ni lo tapan los que cuelgan: la línea de los ojos al cartel pasa por debajo de ellos', () => {
    const loMasBajoQueCuelgan = MACHINE_HEIGHT - STICK_CORD_LENGTH - STICK_LENGTH
    const palos = buildStickLayout(MAX_STICKS, 1).map(({ anchor: [x, , z] }) => Math.hypot(x, z - PLAYER_OFFSET_Z))
    const arriba = pointOnPanel(poseDelCartel(), 0, (ALTO * CRECIDO) / 2)
    const lejos = Math.hypot(arriba.x, arriba.z)
    for (const palo of palos) {
      const alturaDeLaVista = REFERENCE_EYE_HEIGHT + ((arriba.y - REFERENCE_EYE_HEIGHT) * palo) / lejos
      expect(alturaDeLaVista).toBeLessThan(loMasBajoQueCuelgan)
    }
  })

  it('va encima del marcador sin pisarlo, con cartel o diciendo que no cuenta', () => {
    for (const reparto of [
      xrHudLayout({ finished: false, row: false, sign: true }),
      xrHudLayout({ finished: true, row: false, sign: true }),
      // Fuera del reto el cartel dice bajito que no cuenta y el marcador va entero, con sus vidas a dos.
      xrHudLayout({ finished: false, row: false, sign: false }),
      xrHudLayout({ finished: false, row: true, sign: false }),
    ]) {
      const techoDelMarcador = XR_HUD_POSITION[1] + reparto.centre + reparto.height / 2
      expect(ABAJO).toBeGreaterThan(techoDelMarcador)
    }
    expect(XR_CARTEL_POSITION[2]).toBe(XR_HUD_POSITION[2])
  })

  it('y por debajo del aviso de salir y del tutorial, que se enseñan con la partida en marcha', () => {
    expect(ARRIBA).toBeLessThan(XR_CONFIRM_POSITION[1] - XR_CONFIRM_SIZE[1] / 2)
    expect(ARRIBA).toBeLessThan(XR_TUTORIAL_POSITION[1] - TUTORIAL_PANEL.height / 2)
  })
})

/** Los listones de Stick Rush en el salón. */
const OBJETIVO: Goal = {
  medals: { bronze: 1900, silver: 3750, gold: 5200 },
  better: 'higher',
  unit: 'points in challenge',
  record: 2400,
  mode: 'challenge',
}

const en = traductorSuave('en')
const es = traductorSuave('es')

/** El reto en marcha, solo, con lo que se diga encima. */
function reto(cambios: Partial<LoQueSeJuega> = {}): LoQueSeJuega {
  return {
    objetivo: OBJETIVO,
    gameMode: 'challenge',
    aDos: false,
    gameState: 'playing',
    points: 0,
    lives: CHALLENGE_LIVES,
    resolved: 0,
    stickCount: CHALLENGE_SETUP.stickCount,
    record: 0,
    ...cambios,
  }
}

describe('la partida que se le cuenta al cartel', () => {
  it('la misión es la del reto: los palos de las reglas y sus tres vidas', () => {
    expect(MODO_DE_LAS_MEDALLAS).toBe(DEFAULT_GAME_MODE)
    expect(MISION_DEL_RETO).toContain('{sticks}')
    // Las vidas van escritas en la frase: si dejan de ser tres, hay que reescribirla.
    expect(CHALLENGE_LIVES).toBe(3)
    expect(en(MISION_DEL_RETO, { sticks: CHALLENGE_SETUP.stickCount })).toBe(
      'Catch 13 sticks. Drop three and out',
    )
    expect(es(MISION_DEL_RETO, { sticks: CHALLENGE_SETUP.stickCount })).toBe('Atrapa 13 palos. Tres al suelo y fuera')
  })

  it('en el menú no se cuelga nada', () => {
    expect(partidaDelCartel(reto({ gameState: 'menu' }), en)).toBeNull()
    expect(partidaDelCartel(reto({ gameState: 'menu', objetivo: null }), en)).toBeNull()
  })

  it('durante la cuenta atrás: la misión y los tres listones', () => {
    const partida = partidaDelCartel(reto({ gameState: 'countdown' }), es)

    expect(partida?.phase).toBe('before')
    expect(goalSign(partida!, es)).toMatchObject({
      title: 'Atrapa 13 palos. Tres al suelo y fuera',
      detail: 'Bronce 1900 · Plata 3750 · Oro 5200',
    })
    expect(medalToCelebrate(partida!)).toBeNull()
  })

  it('la primera vez, sin récord, el bronce dicho en palos y el oro', () => {
    const sinRecord = { ...OBJETIVO, record: null }
    expect(goalSign(partidaDelCartel(reto({ gameState: 'countdown', objetivo: sinRecord }), es)!, es).detail).toBe(
      'Bronce ≈ 13 palos · Oro 5200',
    )
    expect(goalSign(partidaDelCartel(reto({ gameState: 'countdown', objetivo: sinRecord }), en)!, en).detail).toBe(
      'Bronze ≈ 13 sticks · Gold 5,200',
    )
    // Un bronce de un palo se dice con su cifra: «≈ 1 palo» es el primer atrape.
    const deUnPalo = { ...sinRecord, medals: { bronze: 10, silver: 20, gold: 30 } }
    expect(goalSign(partidaDelCartel(reto({ gameState: 'countdown', objetivo: deUnPalo }), en)!, en).detail).toBe(
      'Bronze 10 · Silver 20 · Gold 30',
    )
  })

  it('los puntos, en palos: lo menos que vale uno en el reto, y el plural que toca', () => {
    expect(PUNTOS_DE_UN_PALO).toBe(150)
    expect([palosPara(1), palosPara(150), palosPara(151), palosPara(1900)]).toEqual([1, 1, 2, 13])
    expect(enPalos(es)(150)).toBe('≈ 1 palo')
    expect(enPalos(es)(300)).toBe('≈ 2 palos')
    expect(enPalos(en)(150)).toBe('≈ 1 stick')
    expect(enPalos(en)(300)).toBe('≈ 2 sticks')
  })

  it('y sigue hasta que se resuelve el primer palo: da tiempo a leerla', () => {
    expect(partidaDelCartel(reto({ gameState: 'playing', resolved: 0 }), en)?.phase).toBe('before')
    expect(partidaDelCartel(reto({ gameState: 'playing', resolved: 1, points: 150 }), en)?.phase).toBe('playing')
    // Aunque ese primer palo se haya escapado y no haya puntos.
    expect(partidaDelCartel(reto({ gameState: 'playing', resolved: 1, lives: 2 }), en)?.phase).toBe('playing')
  })

  it('jugando: el listón que falta, lo que se lleva, las vidas y los palos que quedan', () => {
    const partida = partidaDelCartel(reto({ points: 2100, lives: 2, resolved: 6 }), es)

    expect(partida).toMatchObject({ phase: 'playing', points: 2100, remaining: 'Vidas ♥♥♡ · Palos 7' })
    expect(goalSign(partida!, es)).toMatchObject({
      title: 'Plata a 3750 · llevas 2100',
      detail: 'Vidas ♥♥♡ · Palos 7',
      medal: 'silver',
    })
    expect(medalToCelebrate(partida!)).toBe('bronze')
  })

  it('al acabar: lo conseguido y lo que faltó para la siguiente', () => {
    const partida = partidaDelCartel(reto({ gameState: 'finished', points: 2100, lives: 0, resolved: 9 }), es)

    expect(partida?.phase).toBe('end')
    expect(goalSign(partida!, es)).toMatchObject({
      title: 'Bronce · 2100 points in challenge',
      detail: 'Te han faltado 1650 para la plata',
    })
    // Sin llegar al bronce, lo que faltó para él.
    const sinMedalla = partidaDelCartel(reto({ gameState: 'finished', points: 400, lives: 0, resolved: 4 }), en)
    expect(goalSign(sinMedalla!, en)).toMatchObject({
      title: 'No medal · 400 points in challenge',
      detail: '1,500 short of bronze',
    })
  })

  it('fuera del reto, dentro del salón: dice bajito que no cuenta para medalla', () => {
    const practica = partidaDelCartel(reto({ gameMode: 'practice', lives: null, points: 900, resolved: 3 }), es)
    expect(goalSign(practica!, es)).toMatchObject({ title: 'Práctica · no cuenta para medalla', subdued: true })
    expect(medalToCelebrate(practica!)).toBeNull()
    expect(llevaLaCuenta(practica)).toBe(false)

    const niveles = partidaDelCartel(reto({ gameMode: 'levels', lives: null, gameState: 'countdown' }), en)
    expect(goalSign(niveles!, en).title).toBe('Levels · does not count for a medal')
  })

  it('a dos tampoco cuenta, aunque sea el reto: una tanda a dos no es la marca de nadie', () => {
    const partida = partidaDelCartel(reto({ aDos: true, points: 2100, resolved: 5 }), es)

    expect(goalSign(partida!, es).title).toBe('Duelo · no cuenta para medalla')
    expect(medalToCelebrate(partida!)).toBeNull()
  })

  it('lo que no cuenta se dice mientras se juega: al acabar no se cuelga, y el marcador va entero', () => {
    expect(partidaDelCartel(reto({ gameMode: 'practice', lives: null, gameState: 'finished' }), en)).toBeNull()
    expect(partidaDelCartel(reto({ aDos: true, gameState: 'finished' }), en)).toBeNull()
  })

  it('si el salón dice que las medallas salen de otro modo, el reto tampoco cuenta', () => {
    const partida = partidaDelCartel(reto({ objetivo: { ...OBJETIVO, mode: 'levels' }, points: 500, resolved: 2 }), es)

    expect(goalSign(partida!, es).title).toBe('Reto · no cuenta para medalla')
  })

  it('con el juego abierto suelto: en el reto, la misión y el récord guardado aquí', () => {
    const antes = partidaDelCartel(reto({ objetivo: null, gameState: 'countdown', record: 3100 }), en)
    expect(goalSign(antes!, en)).toMatchObject({
      title: 'Catch 13 sticks. Drop three and out',
      detail: 'Your record 3,100',
    })

    const jugando = partidaDelCartel(reto({ objetivo: undefined, points: 1200, lives: 1, resolved: 8, record: 3100 }), en)
    expect(goalSign(jugando!, en)).toMatchObject({
      title: 'Your record 3,100 · you have 1,200',
      detail: 'Lives ♥♡♡ · Sticks 5',
    })
    expect(llevaLaCuenta(jugando)).toBe(true)

    // Sin récord guardado no hay segunda línea.
    const sinRecord = partidaDelCartel(reto({ objetivo: null, gameState: 'countdown' }), en)
    expect(goalSign(sinRecord!, en).detail).toBeNull()
  })

  it('con el juego abierto suelto y fuera del reto no se cuelga nada', () => {
    expect(partidaDelCartel(reto({ objetivo: null, gameMode: 'practice', lives: null }), en)).toBeNull()
    expect(partidaDelCartel(reto({ objetivo: null, aDos: true }), en)).toBeNull()
    expect(llevaLaCuenta(null)).toBe(false)
  })

  it('un reto sin vidas en juego no es el reto: no cuenta', () => {
    expect(partidaDelCartel(reto({ objetivo: null, lives: null }), en)).toBeNull()
  })

  it('las vidas se escriben con las que quedan llenas y las gastadas vacías', () => {
    expect(loQueQueda(CHALLENGE_LIVES, 13, en)).toBe('Lives ♥♥♥ · Sticks 13')
    expect(loQueQueda(1, 4, es)).toBe('Vidas ♥♡♡ · Palos 4')
    expect(loQueQueda(0, 0, en)).toBe('Lives ♡♡♡ · Sticks 0')
    // Una cuenta de más no pinta corazones de más.
    expect(loQueQueda(CHALLENGE_LIVES + 2, 1, en)).toBe('Lives ♥♥♥ · Sticks 1')
  })
})

describe('el listón en la mano', () => {
  it('se siente más fuerte cuanto mejor es la medalla, en la mano que se diga', () => {
    const fuerza = (medalla: 'bronze' | 'silver' | 'gold') => pulsosDelListon(medalla, 'left')[0]

    expect(fuerza('bronze').hand).toBe('left')
    expect(fuerza('silver').intensity).toBeGreaterThan(fuerza('bronze').intensity)
    expect(fuerza('gold').intensity).toBeGreaterThan(fuerza('silver').intensity)
    expect(pulsosDelListon('gold', 'right')).toHaveLength(1)
    expect(pulsosDelListon('gold', 'right')[0].hand).toBe('right')
  })

  it('llega después del atrape que lo cruzó, para que sean dos toques y no uno', () => {
    const delAtrape = pulsesFor({ type: 'grab', hand: 'right' })[0]
    const [pulso] = pulsosDelListon('silver', 'right')

    expect(pulso.delay).toBe(pulsesFor(tactoDelListon('silver', 'right'))[0].delay + RETARDO_DEL_LISTON)
    // `pulse()` no encola: el del listón sale cuando el del atrape ya ha acabado.
    expect(pulso.delay).toBeGreaterThan(delAtrape.delay + delAtrape.ms)
  })
})
