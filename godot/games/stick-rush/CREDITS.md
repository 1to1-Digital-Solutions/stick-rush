# Créditos del paquete de Godot

Lo que viaja en el `.pck` de Stick Rush y viene de fuera del proyecto. Es lo mismo que la web sirve
desde `public/` (su `public/CREDITS.md`), copiado al paquete: la máquina, los palos, las guirnaldas,
el público y la noria son geometría generada en código, y los efectos se renderizan del `sound.ts`
de la web (`npm run godot:sfx`).

## La plaza de noche — `hdri/plaza_pueblo_1k.exr`

Night Environment HDRI 009 de ambientCG (<https://ambientcg.com/view?id=NightEnvironmentHDRI009>),
**CC0 1.0**. El fondo y los reflejos de la escena. Se acredita por cortesía.

## La madera de los palos — `texturas/wood_{nor,rough}_1k.jpg`

Fine Grained Wood de Poly Haven (<https://polyhaven.com/a/fine_grained_wood>), **CC0 1.0**: los
mapas de normales y de rugosidad, sin su mapa de color. Se acredita por cortesía.

## El recinto — `feria/{puesto,farol,banderola}.glb`

Fantasy Town Kit 2.0 de Kenney (<https://kenney.nl/assets/fantasy-town-kit>), **CC0 1.0**: `stall-red`,
`lantern` y `banner-red`, pasadas por el kit compartido de xrcade (`xrcade/kit/`), que les pone el
color en los vértices. Son las mismas de `public/models/kit/`, byte a byte (lo comprueba
`scene/mundo/mundo.motor.test.ts`).

## Música de fondo — `music/feria.mp3`

Upbeat Chiptune Theme, de nihilocrat (<https://opengameart.org/content/upbeat-chiptune-theme>),
**CC0 1.0**. Se acredita por cortesía.

## Mandos — `mandos/`

Los modelos y los perfiles de los mandos de Quest de
[@webxr-input-profiles/assets](https://github.com/immersive-web/webxr-input-profiles), del grupo
Immersive Web del W3C: los que enseña el tutorial en las dos manos y las ayudas junto al palo
fantasma, con el botón que toca encendido. Los copia `npm run godot:controllers` desde
`public/webxr-profiles/`.

Licencia **MIT**, que exige llevar el aviso en cada copia. Va entero en `mandos/LICENSE.md`, y
aquí:

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
