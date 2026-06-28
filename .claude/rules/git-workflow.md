# Git

- Trabajas en la **rama de trabajo asignada** (normalmente `develop` o `agent/<tarea>`). **Nunca**
  hagas commit en `main`/`master` ni hagas `push --force`.
- **Commits enfocados y atómicos**: un commit por unidad lógica de cambio, con mensaje claro en
  imperativo que explique el *qué* y el *porqué* (no "cambios varios").
- Haz commit de tu trabajo **antes de terminar** para que sea revisable. No dejes el trabajo solo
  en el working tree.
- **No hagas `push` a ningún remoto.** Organízate se encarga del push y del PR al terminar; tú solo
  commiteas en tu rama local. Tampoco crees repos ni operes con `gh`.
- **Candado de organización:** nunca interactúes con repositorios fuera de la organización
  **`1to1-Digital-Solutions`**. No añadas remotos nuevos ni cambies la URL de `origin`.
- No reescribas el historial de ramas compartidas (`rebase`/`amend` sobre commits ya publicados).
- Mantén el árbol limpio: no commitees artefactos de build, `node_modules`, logs ni temporales.
