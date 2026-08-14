import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['src/**/*.integracion.test.ts'],
    setupFiles: ['./vitest.integracion.setup.ts'],
  },
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
})
