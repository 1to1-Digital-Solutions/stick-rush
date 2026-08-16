# TODO — stick-rush

> Backlog del producto: **qué falta**. El «dónde estamos» y el «por dónde seguir en la
> próxima sesión» viven en **`ESTADO.md`**, que es el handoff. Aquí no se repite el
> detalle técnico: si algo necesita explicación larga, va allí y aquí solo se enlaza.

---

## 🔜 Pendiente

### Interfaz inmersiva

- [ ] **Mejorar los iconos del menú 3D.** Probado en visor (2026-08-06): el de volver
      atrás no se lee como una flecha, y falta distinguir «volver al menú» de «salir del
      visor», que hoy comparten icono a pesar de hacer cosas distintas. Todos viven en
      `src/components/xr/XRUi.tsx` y son geometría pura, sin texto (la CSP bloquea las
      fuentes de `<Text>`, ver `ESTADO.md`).
      - `XRBackIcon`: hoy es un prisma triangular más una caja; la punta y el asta no
        acaban de leerse como una sola flecha.
      - Falta un icono de **casa** para «volver al menú», distinto del de salir.
      - Sin validar en hardware: `XRRepeatIcon`, `XRSceneIcon` y `XRPassthroughIcon`.
      - Alternativa a considerar: auto-hospedar una fuente para `<Text>` de drei, igual
        que se hizo con los perfiles de mando. Resolvería el problema de raíz, pero pesa
        más que unas primitivas.

### Documentación

- [ ] **Actualizar el `README.md`**, que se quedó atrás con los cambios de agosto. Al
      menos: los botones «Entrar en VR / Entrar en AR» ya no existen (ahora es uno solo,
      «Entrar en el visor»); no menciona la puntuación, la cuenta atrás ni el selector de
      escenario/passthrough; la captura `docs/partida.jpg` es de antes del rediseño y del
      marcador de puntos; y el árbol de ficheros no incluye `scoring.ts`, `xrAnchor.ts`,
      `SceneryFade.tsx`, `XRCountdown.tsx`, `XRController.tsx` ni `XRGazeAnchor.tsx`.
      `npm run capture` regenera la captura.

### Jugabilidad

- [ ] **Sonido**: al atrapar, al perder y en la cuenta atrás. Es lo que más se echa de
      menos con el visor puesto. Ojo con la CSP y con no depender de un CDN.
- [ ] **Vibración de los mandos** (haptics de WebXR) al atrapar un palo. Barato y muy
      efectivo en XR; no necesita descargar nada.
- [ ] **Balanceo de los palos colgando**, para que la máquina no parezca congelada antes
      de que caiga el primero.
- [ ] **Decidir si un palo debe poder atraparse mientras aún cuelga.** Hoy se puede, así
      que con 13 palos en Fácil se vacía el aro sin esperar a que caiga nada. Ya está
      mitigado a medias (durante la cuenta atrás no se puede coger nada, y el bonus por
      reflejos premia cogerlos arriba), pero la decisión de fondo sigue abierta. Si se
      cierra a `falling`, hay que ajustar el e2e «atrapar un palo suma en el marcador».
- [ ] **Escenario VR más elaborado** que el HDRI actual.

### Producto

- [ ] **Decidir si el repo se hace público.** Por datos personales ya no hay bloqueo:
      `origin` solo tiene `main` y no queda ningún email personal publicado. Lo único a
      decidir es si se quiere publicar `.claude/` y `.organizate/install-state.json`, que
      dejan ver el tooling interno (sin secretos).
- [ ] **Guardar la mejor puntuación entre partidas.** Requiere decidir antes si se rompe
      el «cero almacenamiento» que la auditoría dio por bueno.

### Deuda técnica

- [ ] **Godot (`godot/`) está congelado a propósito** hasta cerrar el web. Cuando se
      cierre, portar de una vez: aro horizontal, escala en metros, velocidades en m/s,
      estética de feria y palos amarillos. Detalle en `ESTADO.md` y `godot/README.md`.
- [ ] **Pulsar botones con el mando no se puede testear**: los punteros del emulador IWER
      no emiten eventos sobre la escena. El test queda escrito como `fixme` en
      `e2e/xr.spec.ts`. Línea abierta si alguien quiere retomarla — pero ojo, esa
      limitación ya tapó un fallo real una vez (ver `ESTADO.md`).

---

## ✅ Hecho

### Modo inmersivo (lo que costó tres pruebas con las gafas)

- [x] Mandos visibles y funcionales. El fallo de raíz era que **no llegaban a
      registrarse**: su perfil se descargaba de un CDN que la CSP bloquea. Ahora se
      sirven desde `public/webxr-profiles/`.
- [x] Menú, marcador y botones **siempre delante del jugador** (`XRGazeAnchor`), con zona
      muerta para poder apuntar sin que el objetivo huya.
- [x] Mando dibujado con geometría propia y **pista del gatillo de agarre**.
- [x] Botones que se pulsan de verdad (`pointerdown` en vez de `click`) y con halo de foco.
- [x] **Escenario o passthrough elegible dentro del visor**, con fundido.
- [x] Menú inmersivo completo: nº de palos, dificultad, empezar, salir.
- [x] Los palos se cogen **cerrando la mano**, no apuntando con el rayo.
- [x] Entrar en VR/AR lleva al menú y no arranca una partida sola.
- [x] Orden de caída barajado (antes caían siempre de izquierda a derecha).
- [x] Tamaño de máquina y palos ajustado (−8 %) y jugador bien centrado.

### Juego

- [x] Partida completa: selección de palos (5–13) y dificultad, captura, fin y revancha.
- [x] **Puntuación** por dificultad, racha y reflejos (`src/lib/scoring.ts`).
- [x] **Cuenta atrás de 3 s**, durante la cual no se puede coger nada.
- [x] **Acierto en verde con onda; fallo en rojo que se queda en el suelo.**
- [x] Escena a escala humana con aro horizontal y estética de feria.

### Calidad e infraestructura

- [x] 110 tests unitarios (Vitest) y 32 e2e (Playwright).
- [x] Auditoría de seguridad, CSP y cabeceras. Cero peticiones a terceros.
- [x] `npm audit` en 0 vulnerabilidades (Next 16.3.0).
- [x] CI, Dependabot y licencia MIT.
- [x] Email personal fuera del historial **y de todas las ramas publicadas**.
- [x] Git consolidado: `origin` solo con `main`; en local solo `main` y `develop`.
- [x] Desplegado en Vercel y probado en visor.
