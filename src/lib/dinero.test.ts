import { describe, it, expect } from 'vitest'
import { formatearPesos, formatearPesosSinSimbolo } from './dinero'

describe('formatearPesos', () => {
  it('usa punto como separador de miles', () => {
    expect(formatearPesos(240000)).toBe('$ 240.000')
  })

  it('no muestra decimales', () => {
    expect(formatearPesos(22000)).toBe('$ 22.000')
  })

  it('maneja el cero', () => {
    expect(formatearPesos(0)).toBe('$ 0')
  })

  it('maneja millones', () => {
    expect(formatearPesos(30640000)).toBe('$ 30.640.000')
  })

  it('maneja valores menores a mil', () => {
    expect(formatearPesos(500)).toBe('$ 500')
  })
})

describe('formatearPesosSinSimbolo', () => {
  it('omite el signo de pesos', () => {
    expect(formatearPesosSinSimbolo(240000)).toBe('240.000')
  })
})
