import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Generados por la CLI de Supabase y por Playwright: no son código nuestro.
    "supabase/.temp/**",
    "test-results/**",
    "playwright-report/**",
    // Worktrees de Claude Code: son copias completas del proyecto, con su
    // propio node_modules. Sin esto, `npm run lint` desde la raíz revisa
    // el repo dos veces y saca miles de errores ajenos.
    ".claude/**",
  ]),
]);

export default eslintConfig;
