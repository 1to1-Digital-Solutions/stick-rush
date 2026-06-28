# Seguridad

- **Nunca** hardcodees secretos (claves, tokens, contraseñas). Usa variables de entorno y ficheros
  `.env*` ya ignorados por git. No imprimas secretos en logs.
- **No commitees** `.env`, credenciales, ni datos sensibles. Verifica el `.gitignore`.
- **Valida y sanea** toda entrada externa (formularios, params, datos de red) antes de usarla.
- **Mínimo privilegio**: no abras permisos, CORS, RLS ni endpoints más de lo necesario.
- **Dependencias**: no añadas paquetes innecesarios; preferir los ya presentes. Ante un paquete
  nuevo, comprueba que existe y es el oficial (cuidado con typosquatting/supply-chain).
- **No ejecutes** comandos destructivos (borrados masivos, `git push --force`, `rm -rf` amplio) ni
  toques `main`/`master`. Trabaja siempre en la rama de trabajo asignada.
- Si detectas una vulnerabilidad o secreto expuesto en el repo, **párate y repórtalo**; no lo
  "arregles" silenciosamente commiteando el secreto.
