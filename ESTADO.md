# Estado — Stick Rush

> **Cómo continuar:** «lee `ESTADO.md` y sigue con el siguiente paso». Aquí solo lo que hace
> falta para trabajar hoy; lo cerrado, en `docs/historial.md`. Se actualiza con **`/estado`**.
> El backlog (qué falta) vive en `TODO.md`.

---

## ⏭️ Siguiente paso

**Probar con el visor.** La última versión es **v0.24.0** (los palos caen desde el reposo y
aceleran). En `develop`, sin versión todavía: el **port entero a Godot** sobre el kit común
(`godot/`, `npm run godot:*`), el **duelo a dos** pasándose el mando, las **tres hazañas** para
los logros de Steam y seguir la altura fina del salón.

Qué mirar con las gafas, y dónde se toca:

| Qué mirar | Dónde se toca |
|---|---|
| ¿El paso atrás es el justo? ¿Se llega al palo del frente? | `PLAYER_OFFSET_Z` (`src/lib/gameConfig.ts`) |
| ¿Máquina a buena altura? ¿Cuelgan por encima de la cara? | `HOOP_RISE_ABOVE_EYES` (`src/lib/hoopHeight.ts`) |
| Columna de ajustes (30° a la izquierda, 1,5 m; antes a 55°): ¿se ve al entrar sin girarse? En el menú, los palos de delante y de ese lado se atenúan y vuelven al pulsar Jugar: ¿se lee limpio y la máquina sigue pareciendo entera? Web y Godot | `PALO_TRAS_EL_MENU`, `paloTapaElMenu`, `XR_COLUMN` (`src/lib/xrLayout.ts`) |
| Menú de la plantilla común: «Modo: Reto», «Jugadores» y lo demás tras «Más opciones» (abajo a la izquierda). Con el reto no se ven el aro ni «Alrededor»: ¿se echa de menos ajustar el aro sentado? | `menuDelJuego.ts`, `XR_MENU_OPCIONES_OFFSET` |
| El nombre de la cabina arriba a la izquierda del menú (antes solo en la portada web): ¿se lee sin buscarlo, sin estorbar a «Aro»? Web y Godot | `MENU_TITLE` (`src/lib/xrLayout.ts`) |
| **El calentamiento** (`src/lib/calentamiento.ts`): la primera partida con el visor, en el reto y con la lección delante, los palos perdidos no quitan vidas; al cerrarla, el reto empieza de cero con «Ahora cuenta para medalla» en el cartel. ¿Se entiende? Web y Godot | `enCalentamiento`, `partidaDelCartel` |
| Los rótulos bajo los botones del final (Otra partida / Compartir / Menú): ¿se leen sin estorbar? | `ROTULOS_DEL_FINAL` (`XRHud.tsx`; Godot, `marcador.ts`) |
| ¿Se lee el guante como mano y se ve cerrarse? En el salón va sin mando debajo | `src/components/xr/Guante.tsx`, `src/lib/guante.ts` |
| Manos desnudas, en la web y en el salón | `src/components/xr/ManosDelJugador.tsx` |
| ¿Se nota el atrape y el in extremis distinto? | `src/lib/haptics.ts`, `src/lib/tactos.ts` |
| ¿La caída acelerando se lee como una caída? | `fallAcceleration` (`src/lib/gameConfig.ts`) |
| **Pendiente de visor — el cartel del objetivo** (encima del marcador, 27° bajo la mirada; el menú abre en el reto): ¿se entiende la misión en los tres primeros segundos?, ¿se lee sin buscarlo?, ¿molesta al jugar? | `XR_CARTEL_POSITION` (`src/lib/xrLayout.ts`), `MISION_DEL_RETO` (`src/lib/cartelDeLaMaquina.ts`) |
| Cartel: la letra (la misión sale a 1°); el marcador sin barra ni vidas, ¿se echan de menos? | `LETRA_DEL_CARTEL` (`CartelDeObjetivo.tsx`), `XR_HUD_WITH_SIGN`; en Godot, `CARTEL` (`godot/scene/interfaz/cartel.ts`) |
| Cartel: el listón cruzado (color, pulso, dos notas y un toque en la mano buena tras el atrape), ¿se nota sin distraer? | `medalVoices` (`src/lib/sound.ts`), `RETARDO_DEL_LISTON`, `tactoDelListon` |

Lo que solo puede decir el visor del port de Godot está en «Lo que se sabe y lo que falta» de
`godot/README.md`. La lista común de todos los juegos: `organizate/docs/pendiente-de-visor.md`.

Después: cortar versión de lo que hay en `develop` (procedimiento en «Publicar una versión
nueva» de `docs/montar-el-juego.md`) y que xrcade la suba con `npm run game:update`.

## 🚧 Lo que bloquea o espera

1. **Nada está probado con las gafas** desde hace varias tandas: todo lo de la tabla de arriba
   y lo del port de Godot, que solo se ha jugado en plano y con visor simulado.
2. **En el salón, con manos desnudas no se atrapa**: el salón lleva `hand.grabPointer: false` a
   propósito y el agarre de stick-rush es ese puntero. Activarlo es decisión del salón, mirando
   los otros dieciséis juegos.
3. **`main` va 31 commits por detrás de `develop`.** Publicar en `main` es del usuario, después
   de probar con el visor.
4. **¿El repo se hace público?** Sin bloqueo por datos personales; falta decidir si se enseñan
   `.claude/` y `.organizate/install-state.json` (`TODO.md`, «Producto»).
5. **`TODO.md` va atrasado**: aún marca Godot como «congelado» y ya está portado.

## ▶️ Cómo arrancar

```
npm run dev            # http://localhost:3000 (o la IP de la máquina)
npm run dev:https      # para el visor, contra la IP de esta máquina
npm run lint && npm run typecheck && npm test
npm run coverage       # dominio (src/lib) al 100 %; el mínimo es 100
npm run test:e2e       # Playwright sobre el build; puerto E2E_PORT (3100 por defecto)
```

- **Godot**: el editor 4.7.1 con GodotJS en `$GODOT` y `../xrcade` al lado.
  `GODOT=$GODOT npm run godot:test` (todo lo del motor), `npm run godot:build -- --tests`,
  `godot:sfx` y `godot:mandos`. Detalle en `godot/README.md`, «Cómo se usa».
- La suite e2e tarda ~1 min y tiene partes sensibles al tiempo: si algo falla de forma
  intermitente, repetirla antes de «arreglar» nada.
- `build` fija `NODE_ENV=production` porque el entorno exporta `development`, que rompe la
  prerenderización de `/_global-error`.
- Node se fija en `.nvmrc` (24.19.0) y el CI la lee de ahí; subirla es a mano, comprobando que
  `npm install` deja el lock intacto.
- El emulador IWER solo aparece con el hostname exacto `localhost`.
- Nada de worktrees anidados dentro del repo: `npm run lint` recorre su `.next/`.

## 📌 Reglas que rigen y no se deducen del repo

- **Un palo se coge hasta que toca el suelo, colgando incluido.** La regla vive en
  `canCatchStick` (`src/lib/xrInteraction.ts`) y la fijan unitarios y un e2e.
- **La lógica es una sola**: Godot ejecuta `src/lib` con GodotJS; no se reescribe en el port.
- Commits manuales; nada de `push` ni tocar `main` sin permiso explícito.
- Hay un backup del historial previo a la reescritura en `refs/backup/main-antes-de-reescribir`.

## 🗺️ Dónde está lo demás

| Para… | Mirar |
|---|---|
| Por qué está algo así | `docs/historial.md` (no se lee al empezar) |
| Qué falta (backlog) | `TODO.md` |
| El port a Godot, y lo que falta en él | `godot/README.md` |
| Montar el juego en el salón y publicar versión | `docs/montar-el-juego.md` |
| Reglas comunes | `.claude/rules/` |
