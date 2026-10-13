# Third-party assets

Every asset in this folder is **CC0** (public domain), except the hands and the controller
profiles and models, which are **MIT**: the CC0 ones may be used and modified without attribution,
and are credited anyway as a courtesy; the MIT ones require carrying the licence notice, which is
at the end.

They are served from `public/`, never from an external CDN: the game has to work on a headset
connected to the local network only.

| File | Origin | Licence |
|---|---|---|
| `hdri/plaza_pueblo_1k.exr` | [ambientCG — Night Environment HDRI 009](https://ambientcg.com/view?id=NightEnvironmentHDRI009) | CC0 |
| `textures/wood_*_1k.jpg` | [Poly Haven — Fine Grained Wood](https://polyhaven.com/a/fine_grained_wood) | CC0 |
| `manos/generic-hand/{left,right}.glb` | [@webxr-input-profiles/assets](https://github.com/immersive-web/webxr-input-profiles) v1.0.20, the articulated hand `generic-hand` | MIT |
| `webxr-profiles/**/profile.json`, `webxr-profiles/profilesList.json`, `webxr-profiles/{meta-quest-touch-plus,oculus-touch-v3}/{left,right}.glb` | [@webxr-input-profiles/assets](https://github.com/immersive-web/webxr-input-profiles) v1.0.20, the controller profiles and the models of the Quest controllers | MIT |
| `models/kit/{puesto,farol,banderola}.glb` | [Kenney — Fantasy Town Kit 2.0](https://kenney.nl/assets/fantasy-town-kit), through the xrcade kit (see below) | CC0 |
| `audio/feria.mp3` | [OpenGameArt — Upbeat Chiptune Theme, by nihilocrat](https://opengameart.org/content/upbeat-chiptune-theme) | CC0 |

`wood_nor` / `wood_rough` are the normal and roughness maps of the `fine_grained_wood` texture,
renamed for brevity. Its colour map is not used: it is an almost black wood that left the sticks
brown instead of yellow.

The HDRI is a village square at night with garlands of bunting, which is the setting the game
asks for. The 1K EXR (2 MB) is used instead of the 2K one (~8 MB) because it is a distant
background and a soft blur is applied on top.

The background music is one minute of a cheerful theme on a loop: it is the background of the
fairground, not the run, so it is heard when nothing is happening and disappears under the stick
as soon as there is one. It is served in mono at 64 kbps (445 KB) instead of the original in
stereo, because it plays at low volume and travels over HTTP to a headset connected to the home
network.

## The fairground — `models/kit/`

- **Work:** Fantasy Town Kit 2.0 by Kenney: `stall-red` is `models/kit/puesto.glb`, `lantern`
  is `models/kit/farol.glb` and `banner-red` is `models/kit/banderola.glb`.
- **Author:** Kenney — <https://kenney.nl/assets/fantasy-town-kit>
- **Licence:** [CC0 1.0 Universal](https://creativecommons.org/publicdomain/zero/1.0/)
  (public domain). Credited as a courtesy.
- **Use:** the stalls of the ring, the lamp posts the garlands hang from and a banner on each
  lamp post. They come from the hall's shared kit (`xrcade/kit/`), which turns the palette of the
  atlas into vertex colours and leaves each piece without a texture; **they are changed there**,
  not here: `organizate/scripts/repos/comunes.py` checks that this copy is the kit's, byte for
  byte.

## The hands and the controllers — `manos/generic-hand/`, `webxr-profiles/`

The generic articulated hand of the W3C Immersive Web group, the one that draws the player's hand
when the headset tracks the hands instead of the controllers, and the group's controller
profiles: every `profile.json` (which button is which on each controller) and the 3D models of
the two Quest controllers, which the tutorial shows with the button to press lit up.
`scripts/sync-xr-profiles.mjs` copies them from the package; the hand goes outside
`webxr-profiles/` (the reason is in the script).

**MIT** licence, which requires carrying this notice in every copy:

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
