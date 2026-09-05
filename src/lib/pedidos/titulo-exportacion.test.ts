import { describe, it, expect } from 'vitest'
import { tituloDelPdf } from './titulo-exportacion'

describe('tituloDelPdf', () => {
  it('usa el nombre de la pestaña cuando no hay fechas', () => {
    expect(tituloDelPdf('hoy', undefined, undefined, false)).toBe('Pedidos — Hoy')
    expect(tituloDelPdf('todos', undefined, undefined, false)).toBe('Pedidos — Todos')
  })

  it('cae al nombre de la pestaña con un solo extremo de fecha (rango no aplicado)', () => {
    expect(tituloDelPdf('hoy', '2026-08-01', undefined, false)).toBe('Pedidos — Hoy')
    expect(tituloDelPdf('todos', undefined, '2026-08-15', false)).toBe('Pedidos — Todos')
  })

  it('titula por rango cuando ambas fechas están presentes y hayRangoManual es true', () => {
    expect(tituloDelPdf('todos', '2026-08-01', '2026-08-15', true)).toBe(
      'Pedidos — 01/08/2026 al 15/08/2026',
    )
  })

  it('compone "Por cobrar" junto con el rango en vez de reemplazarlo', () => {
    expect(tituloDelPdf('porcobrar', '2026-08-01', '2026-08-15', true)).toBe(
      'Pedidos — Por cobrar — 01/08/2026 al 15/08/2026',
    )
  })

  it('en "porcobrar" sin rango completo usa el nombre de la pestaña', () => {
    expect(tituloDelPdf('porcobrar', '2026-08-01', undefined, false)).toBe('Pedidos — Por cobrar')
  })

  it('ignora hayRangoManual=true si falta alguna fecha (defensivo)', () => {
    expect(tituloDelPdf('hoy', '2026-08-01', undefined, true)).toBe('Pedidos — Hoy')
  })

  it('usa "Pedidos" a secas para una pestaña desconocida sin rango', () => {
    expect(tituloDelPdf('otra', undefined, undefined, false)).toBe('Pedidos')
  })
})
