# Assets de terceros

Todos los assets de esta carpeta son **CC0** (dominio público), salvo las manos, que son
**MIT**: los CC0 se pueden usar y modificar sin atribución, y se acreditan igualmente por
cortesía; las manos exigen llevar el aviso de licencia, que va al final.

Se sirven desde `public/`, nunca desde un CDN externo: el juego tiene que funcionar en un visor
conectado solo a la red local.

| Archivo | Origen | Licencia |
|---|---|---|
| `hdri/plaza_pueblo_1k.exr` | [ambientCG — Night Environment HDRI 009](https://ambientcg.com/view?id=NightEnvironmentHDRI009) | CC0 |
| `textures/wood_*_1k.jpg` | [Poly Haven — Fine Grained Wood](https://polyhaven.com/a/fine_grained_wood) | CC0 |
| `manos/generic-hand/{left,right}.glb` | [@webxr-input-profiles/assets](https://github.com/immersive-web/webxr-input-profiles) v1.0.20, mano articulada `generic-hand` | MIT |
| `models/kit/{puesto,farol,banderola}.glb` | [Kenney — Fantasy Town Kit 2.0](https://kenney.nl/assets/fantasy-town-kit), vía el kit de xrcade (ver abajo) | CC0 |
| `audio/feria.mp3` | [OpenGameArt — Upbeat Chiptune Theme, de nihilocrat](https://opengameart.org/content/upbeat-chiptune-theme) | CC0 |

`wood_nor` / `wood_rough` son los mapas de normales y rugosidad de la textura
`fine_grained_wood`, renombrados por brevedad. Su mapa de color no se usa: es una madera casi
negra que dejaba los palos marrones en vez de amarillos.

El HDRI es una plaza de pueblo de noche con guirnaldas de banderines, que es el escenario que
pide el juego. Se usa el EXR de 1K (2 MB) en lugar del 2K (~8 MB) porque va de fondo lejano y
además se aplica un desenfoque suave.

La música de fondo es un minuto de tema alegre en bucle: es el fondo de la feria, no la
partida, así que se oye cuando no pasa nada y desaparece debajo del palo en cuanto lo hay. Se
sirve en mono a 64 kbps (445 KB) en vez del original en estéreo, porque va a poco volumen y
por HTTP a un visor conectado a la red de casa.

## El recinto — `models/kit/`

- **Obra:** Fantasy Town Kit 2.0 de Kenney: `stall-red` es `models/kit/puesto.glb`, `lantern`
  es `models/kit/farol.glb` y `banner-red` es `models/kit/banderola.glb`.
- **Autor:** Kenney — <https://kenney.nl/assets/fantasy-town-kit>
- **Licencia:** [CC0 1.0 Universal](https://creativecommons.org/publicdomain/zero/1.0/)
  (dominio público). Se acredita por cortesía.
- **Uso:** los puestos del anillo, las farolas de las que cuelgan las guirnaldas y una
  banderola en cada farola. Salen del kit compartido del salón (`xrcade/kit/`), que pasa la
  paleta del atlas a colores de vértice y deja cada pieza sin textura; **se cambian allí**, no
  aquí: `organizate/scripts/repos/comunes.py` vigila que esta copia sea la del kit byte a byte.

## Las manos — `manos/generic-hand/`

La mano articulada genérica del grupo Immersive Web del W3C, la que dibuja la mano del jugador
cuando el visor sigue las manos en vez de los mandos. La copia `scripts/sync-xr-profiles.mjs`
desde el paquete, fuera de `webxr-profiles/` (el porqué, en el script).

Licencia **MIT**, que exige llevar este aviso en cada copia:

```
MIT License

Copyright (c) 2019 Amazon

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is furnished
to do so, subject to the following conditions:

The above copyright notice and this permission notice (including the next
paragraph) shall be included in all copies or substantial portions of the
Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS
OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF
OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
```
