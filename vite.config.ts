import { defineConfig } from 'vite'

/**
 * GitHub Pages project sites need a subpath base (e.g. /repo-name/).
 * Set BASE_PATH in CI (see .github/workflows/pages.yml). Local dev uses "/".
 */
export default defineConfig({
  base: process.env.BASE_PATH ?? '/',
})
