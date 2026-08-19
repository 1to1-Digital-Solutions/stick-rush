# TODO — stick-rush

> Backlog del producto: **qué falta**. El «dónde estamos» y el «por dónde seguir en la
> próxima sesión» viven en **`ESTADO.md`**, que es el handoff. Aquí no se repite el
> detalle técnico: si algo necesita explicación larga, va allí y aquí solo se enlaza.

---

## 🔜 Pendiente

### Interfaz inmersiva

- [x] **Mejorar los iconos del menú 3D.** Probado en visor (2026-08-06): el de volver <!-- org:e37443a2-d0cf-4da7-9885-879180cd7035 -->
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

- [x] **Actualizar el `README.md`**, que se quedó atrás con los cambios de agosto. Al <!-- org:2c90ced1-24d3-4cf2-8dcb-906662ff26bf -->
      menos: los botones «Entrar en VR / Entrar en AR» ya no existen (ahora es uno solo,
      «Entrar en el visor»); no menciona la puntuación, la cuenta atrás ni el selector de
      escenario/passthrough; la captura `docs/partida.jpg` es de antes del rediseño y del
      marcador de puntos; y el árbol de ficheros no incluye `scoring.ts`, `xrAnchor.ts`,
      `SceneryFade.tsx`, `XRCountdown.tsx`, `XRController.tsx` ni `XRGazeAnchor.tsx`.
      `npm run capture` regenera la captura.

### Jugabilidad

- [x] **Sonido**: al atrapar, al perder y en la cuenta atrás. Es lo que más se echa de <!-- org:38eb4de6-3cc2-4552-b5ec-d00731232eb2 -->
      menos con el visor puesto. Ojo con la CSP y con no depender de un CDN.
- [x] **Vibración de los mandos** (haptics de WebXR) al atrapar un palo. Barato y muy <!-- org:293fb752-f45d-447b-80a4-e4dde6cb1648 -->
      efectivo en XR; no necesita descargar nada.
- [x] **Balanceo de los palos colgando**, para que la máquina no parezca congelada antes <!-- org:8d083219-a711-4435-bbce-fef6ed074a98 -->
      de que caiga el primero.
- [x] **Decidir si un palo debe poder atraparse mientras aún cuelga.** Hoy se puede, así <!-- org:7aee5fcb-7c26-4e89-aef5-84873d77a956 -->
      que con 13 palos en Fácil se vacía el aro sin esperar a que caiga nada. Ya está
      mitigado a medias (durante la cuenta atrás no se puede coger nada, y el bonus por
      reflejos premia cogerlos arriba), pero la decisión de fondo sigue abierta. Si se
      cierra a `falling`, hay que ajustar el e2e «atrapar un palo suma en el marcador».
- [x] **Escenario VR más elaborado** que el HDRI actual. <!-- org:e1f0c5b6-7258-4b27-ad5d-cfc3f99fe679 -->

### Producto

- [ ] **Decidir si el repo se hace público.** Por datos personales ya no hay bloqueo: <!-- org:68e59869-44d3-47bf-aae0-aa96f8fe9768 -->
      `origin` solo tiene `main` y no queda ningún email personal publicado. Lo único a
      decidir es si se quiere publicar `.claude/` y `.organizate/install-state.json`, que
      dejan ver el tooling interno (sin secretos).
- [x] **Guardar la mejor puntuación entre partidas.** Requiere decidir antes si se rompe <!-- org:53769521-1f5a-4846-b1ac-be8c125974e0 -->
      el «cero almacenamiento» que la auditoría dio por bueno.

### Deuda técnica

- [ ] **Godot (`godot/`) está congelado a propósito** hasta cerrar el web. Cuando se <!-- org:0a48a114-5f41-4f12-9edd-e2030f4eb0fc -->
      cierre, portar de una vez: aro horizontal, escala en metros, velocidades en m/s,
      estética de feria y palos amarillos. Detalle en `ESTADO.md` y `godot/README.md`.
- [ ] **Pulsar botones con el mando no se puede testear**: los punteros del emulador IWER <!-- org:f167032c-386c-4d0e-8c9d-1d05190c88d8 -->
      no emiten eventos sobre la escena. El test queda escrito como `fixme` en
      `e2e/xr.spec.ts`. Línea abierta si alguien quiere retomarla — pero ojo, esa
      limitación ya tapó un fallo real una vez (ver `ESTADO.md`).
- [x] **El desajuste de npm entre el lockfile y el CI está cerrado**: la versión de Node <!-- org:02cab77f-91f0-424d-95ce-a51a2c2ca408 -->
      se fija en `.nvmrc` y el CI la lee de ahí, así que el lock se escribe y se lee
      siempre con el mismo npm y un `npm install` ya no lo reescribe.
- [x] **Instanciar los tubos de la máquina.** Se llevaba 85 de las ~110 llamadas de dibujo <!-- org:0dd891e2-8a77-4040-8993-70fc57bbea94 -->
      por fotograma del menú: 69 tubos sueltos (`Strut` en
      `src/components/game/StickMachine.tsx`) y 16 la guirnalda con sus casquillos, y en el
      visor eso se paga por ojo. Ahora van por `MachinePieces.tsx` con la misma receta que el
      recinto usa en `FairPieces` y cuestan 5, así que la escena mide 29 en el menú. Medido y
      justificado en `ESTADO.md`, «Validar el recinto en el visor», y vigilado por
      `e2e/recinto.spec.ts` (`MENU_DRAW_CALL_BUDGET`, 45).

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
- [x] Menú inmersivo completo: nº de palos, dificultad, empezar, salir. <!-- org:975fa3d7-a299-4ab2-b3ae-1fed4bc6aa82 -->
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

- [x] Tests unitarios (Vitest) y e2e (Playwright); las cifras al día, en `ESTADO.md`.
- [x] Auditoría de seguridad, CSP y cabeceras. Cero peticiones a terceros.
- [x] `npm audit` en 0 vulnerabilidades (Next 16.3.0). <!-- org:ff66be6e-014a-43c2-a9f3-8e72a2d810b0 -->
- [x] CI, Dependabot y licencia MIT.
- [x] Email personal fuera del historial **y de todas las ramas publicadas**.
- [x] Git consolidado: `origin` solo con `main`; en local solo `main` y `develop`.
- [x] Desplegado en Vercel y probado en visor.

## Desde Organízate

- [ ] ESTADO.md no tiene sección propia para la instanciación de la máquina,… <!-- org:c23f8938-cbd7-4b29-9692-ca60aee109fc -->
- [ ] El desglose de las 29 llamadas (5 recinto + 5 máquina + 15 palos + 4… <!-- org:2f45e271-809c-4232-aa2b-fdd67fdf71e1 -->
- [ ] El techo de llamadas de dibujo puede medir la escena a medio montar <!-- org:e604bb53-a588-42ea-9c4b-f29194eb4a0e -->
- [ ] e2e/recinto.spec.ts, función sampleFrames() <!-- org:24f0472d-c35b-43f6-9b3f-ec019a8a63c5 -->
- [x] ESTADO.md, sección «Validar el recinto en el visor» (~líneas 600-625) <!-- org:8731e61a-5bc0-43c7-b546-60c9e22fcce2 -->
- [ ] El muestreo de 30 fotogramas esperaba con los 15 s por defecto de expect <!-- org:192936ea-49e1-4de6-ba4b-1a7615bd5fdf -->
- [ ] El README enumera lo que cubren los e2e y no mencionaba la medida del… <!-- org:0494a4d7-33dd-4679-8dff-ea325a1a6bc7 -->
- [x] window.__drawFrames se declaraba obligatorio existiendo solo con el… <!-- org:e5137c06-d4dd-4e68-b9b4-28f8ca594eb9 -->
- [x] Añadir al CI un guardián que detecte si `npm install` ensucia el lockfile <!-- org:54fdb843-b4a2-4e95-a58b-d086538d7e8d -->
- [x] Publicar Stick Rush como escena, sin Canvas ni sesión propios <!-- org:4b8c805f-ca36-4d47-9e5c-3c787b006c50 -->
- [ ] Pasar la titularidad del proyecto a la cuenta personal <!-- org:668391a0-0ae9-4352-bbaf-7db6f84b8ae7 -->
- [x] Cerrar el desajuste de npm entre el lockfile y el CI <!-- org:d53a5f8d-1a7e-4348-b940-97f882b4b8bc -->
- [x] Inicializar proyecto. Crear una primera version <!-- org:e1edeac8-c23f-4773-aa2f-eb24a583b9eb -->
- [ ] Godot para Steam: retomarlo cuando el web esté cerrado <!-- org:e8a6716d-9b48-4083-b8da-8fb6827cec2b -->
- [x] Soporte WebXR (VR/AR) con mandos en StickRush <!-- org:f282927c-c3af-48c1-a3c4-851cb69f961b -->
- [x] El icono de escenario del menú inmersivo dibuja las montañas del revés <!-- org:3ac2a069-c7bc-4ef1-9521-9b8d19749d80 -->
- [x] Añadir tests unitarios (base para integrar sin revisar PRs) <!-- org:23779941-0a8e-4ca6-a27e-450a5947cdba -->
- [x] Decidir si la preferencia de silencio se recuerda entre visitas <!-- org:d14d61ae-c6c8-496e-955f-12f6f73c77b9 -->
- [x] Validar en el visor el recinto de feria del modo VR <!-- org:8d3fb996-72e8-4cd8-a6fa-d442318063ba -->
- [ ] Probar en el visor el balanceo de los palos y ajustar la amplitud <!-- org:8b4a72a2-d9d2-4c42-b2ff-54bc07b71146 -->
- [x] Pulir el menú inmersivo: el triángulo de canto y su altura <!-- org:9a91c8a0-e4ad-48e1-a18c-2c81dca9e663 -->
- [x] Recordar el escenario (VR/passthrough) entre visitas, sin dejar al jugador mirando la nada <!-- org:d447b267-9926-48dc-a5ed-27c8419d74be -->
- [x] Rematar el feedback del juego: vibración y memoria del silencio <!-- org:17b07c29-9940-49c1-9f55-6b06bf62aa1c -->
- [x] Modo práctica y modo desafío <!-- org:2fe49a79-6016-4b2a-ba29-1f0d23b30512 -->
- [x] Ajustar la altura del aro a quien está jugando <!-- org:0070db6b-a5c2-4c94-8c7d-dd60fbadf495 -->
- [x] Tutorial de 5-10 segundos al empezar, saltable <!-- org:2f097199-d14f-4368-91da-88cbe94d1f4c -->
- [x] Compartir el resultado al acabar la partida <!-- org:a1088f93-c76d-44f8-9825-16a031da1909 -->
- [ ] Sesión de validación en el visor (todo lo que falta probar con las gafas) <!-- org:082cad02-f139-4f9a-9c7a-42acd52954e8 -->
- [ ] Dar al jugador una forma de salir del juego y volver a xrcade <!-- org:3b6e9c04-8627-4482-bf04-96ed2e42f57f -->
- [x] Etiquetar v0.2.0 para que xrcade pueda instalar el juego <!-- org:134c51c9-e53b-4f54-9b5d-e876e7d8a0ef -->
- [x] Separar el juego de su web para que xrcade pueda montarlo <!-- org:91b55465-77d0-4a22-be34-e94fbd8be631 -->
- [x] Etiquetar v0.2.0 en main y publicar el tag (bloqueada: main aún no tiene la montabilidad) <!-- org:aeea4140-de31-4ca1-aeb3-5e22d6904d80 -->
- [x] Regenerar package-lock.json, que quedó desfasado al separar el juego de su web <!-- org:8213b3f0-b0e6-478c-beeb-763df11f3b36 -->
- [x] Decidir cómo accede xrcade al repo privado para instalar el juego (acceso al CI, repo público o registry) <!-- org:93ff12f4-a19e-4e7c-b614-38b201f9e434 -->
