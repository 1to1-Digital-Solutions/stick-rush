import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  // `coverage/**` es el informe de cobertura que genera Vitest: no es código
  // del proyecto y no se commitea (está en `.gitignore`).
  globalIgnores(['coverage/**', 
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Bundle generado del emulador WebXR para los tests (no es código fuente).
    "e2e/support/xr-emulator.bundle.js",
    "e2e/support/host.bundle.js",
    // `godot/` es el proyecto de Godot: su TypeScript se comprueba con su propio
    // `godot/tsconfig.json` y los `.js` los genera el kit de xrcade (`npm run godot:build`).
    "godot/**",
  ]),
]);

export default eslintConfig;
