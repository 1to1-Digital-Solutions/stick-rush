# Credits of the Godot package

What travels in the Stick Rush `.pck` and comes from outside the project. It is the same as what
the web serves from `public/` (its `public/CREDITS.md`), copied into the package: the machine, the
sticks, the garlands, the crowd and the Ferris wheel are geometry generated in code, and the
effects are rendered from the web's `sound.ts` (`npm run godot:sfx`).

## The night square — `hdri/plaza_pueblo_1k.exr`

Night Environment HDRI 009 by ambientCG (<https://ambientcg.com/view?id=NightEnvironmentHDRI009>),
**CC0 1.0**. The background and the reflections of the scene. Credited as a courtesy.

## The wood of the sticks — `texturas/wood_{nor,rough}_1k.jpg`

Fine Grained Wood by Poly Haven (<https://polyhaven.com/a/fine_grained_wood>), **CC0 1.0**: the
normal and roughness maps, without its colour map. Credited as a courtesy.

## The venue — `feria/{puesto,farol,banderola}.glb`

Fantasy Town Kit 2.0 by Kenney (<https://kenney.nl/assets/fantasy-town-kit>), **CC0 1.0**: `stall-red`,
`lantern` and `banner-red`, passed through xrcade's shared kit (`xrcade/kit/`), which puts the
colour in their vertices. They are the same as those in `public/models/kit/`, byte for byte
(`scene/world/world.engine.test.ts` checks it).

## Background music — `music/feria.mp3`

Upbeat Chiptune Theme, by nihilocrat (<https://opengameart.org/content/upbeat-chiptune-theme>),
**CC0 1.0**. Credited as a courtesy.

## Controllers — `mandos/`

The models and the profiles of the Quest controllers from
[@webxr-input-profiles/assets](https://github.com/immersive-web/webxr-input-profiles), by the W3C
Immersive Web group: the ones the tutorial shows in both hands and the hints show beside the ghost
stick, with the relevant button lit. `npm run godot:controllers` copies them from
`public/webxr-profiles/`.

**MIT** licence, which requires carrying the notice in every copy. It goes in full in
`mandos/LICENSE.md`, and here:

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
