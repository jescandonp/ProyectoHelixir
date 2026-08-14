import { describe, it, expect } from 'vitest'
import { formatearFechaCo } from './fecha'

describe('formatearFechaCo', () => {
  it('escribe la fecha y la hora en formato colombiano', () => {
    expect(formatearFechaCo('2026-08-14T22:02:00Z')).toBe('14/08/26, 5:02 p. m.')
  })

  it('usa la hora de Colombia sin importar dónde corra el servidor', () => {
    // 02:30 UTC del 15 son las 21:30 del 14 en Bogotá. Vercel corre en UTC:
    // si esto se leyera en la zona del servidor, el recibo cambiaría de día.
    expect(formatearFechaCo('2026-08-15T02:30:00Z')).toBe('14/08/26, 9:30 p. m.')
  })

  it('la medianoche es 12 a. m., no 0 ni 24', () => {
    expect(formatearFechaCo('2026-08-14T05:00:00Z')).toBe('14/08/26, 12:00 a. m.')
  })

  it('el mediodía es 12 p. m.', () => {
    expect(formatearFechaCo('2026-08-14T17:00:00Z')).toBe('14/08/26, 12:00 p. m.')
  })

  it('no mete espacios invisibles: Node y el navegador los ponen distintos', () => {
    // La causa real de un error de hidratación: `toLocaleString` produce
    // U+00A0 en Node y U+0020 en Chrome, y el recibo impreso terminaba
    // diciendo algo distinto al PNG de WhatsApp.
    const texto = formatearFechaCo('2026-08-14T22:02:00Z')
    expect(texto).not.toMatch(/[  ]/)
  })
})
