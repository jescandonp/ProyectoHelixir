import { describe, it, expect } from 'vitest'
import { puedeTransicionar, esEditable } from './estados'

describe('puedeTransicionar', () => {
  it('permite el camino normal', () => {
    expect(puedeTransicionar('borrador', 'confirmado')).toBe(true)
    expect(puedeTransicionar('confirmado', 'enviado')).toBe(true)
    expect(puedeTransicionar('enviado', 'entregado')).toBe(true)
  })

  it('permite anular en cualquier punto antes de entregar', () => {
    expect(puedeTransicionar('borrador', 'anulado')).toBe(true)
    expect(puedeTransicionar('confirmado', 'anulado')).toBe(true)
    expect(puedeTransicionar('enviado', 'anulado')).toBe(true)
  })

  it('no permite devolverse', () => {
    expect(puedeTransicionar('confirmado', 'borrador')).toBe(false)
    expect(puedeTransicionar('entregado', 'enviado')).toBe(false)
  })

  it('no permite saltarse pasos', () => {
    expect(puedeTransicionar('borrador', 'entregado')).toBe(false)
  })

  it('un pedido anulado es un callejón sin salida', () => {
    expect(puedeTransicionar('anulado', 'confirmado')).toBe(false)
    expect(puedeTransicionar('anulado', 'borrador')).toBe(false)
  })

  it('un pedido entregado ya no se anula: se maneja como devolución aparte', () => {
    expect(puedeTransicionar('entregado', 'anulado')).toBe(false)
  })
})

describe('esEditable', () => {
  it('solo el borrador se puede editar', () => {
    expect(esEditable('borrador')).toBe(true)
    expect(esEditable('confirmado')).toBe(false)
    expect(esEditable('anulado')).toBe(false)
  })
})
