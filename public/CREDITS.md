# Assets de terceros

Todos los assets de esta carpeta son **CC0** (dominio público): se pueden usar y modificar sin
atribución. Se acreditan igualmente por cortesía con sus autores.

Se sirven desde `public/`, nunca desde un CDN externo: el juego tiene que funcionar en un visor
conectado solo a la red local.

| Archivo | Origen | Licencia |
|---|---|---|
| `hdri/plaza_pueblo_1k.exr` | [ambientCG — Night Environment HDRI 009](https://ambientcg.com/view?id=NightEnvironmentHDRI009) | CC0 |
| `textures/wood_*_1k.jpg` | [Poly Haven — Fine Grained Wood](https://polyhaven.com/a/fine_grained_wood) | CC0 |
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
