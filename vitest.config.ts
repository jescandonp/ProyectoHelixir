import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'node:path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.test.{ts,tsx}'],
    // pool 'threads': el pool 'forks' (por defecto en Vitest 4) hace timeout
    // al iniciar el worker en este entorno Windows/sandbox. 'threads' funciona
    // de forma estable. Ver reporte de la Tarea 1 para el diagnóstico completo.
    pool: 'threads',
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
})
