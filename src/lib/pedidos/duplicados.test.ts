import { describe, it, expect } from 'vitest'
import { buscarDuplicado } from './duplicados'

const recientes = [
  { consecutivo: 'PED-000148', total: 240000 },
  { consecutivo: 'PED-000151', total: 88000 },
]

describe('buscarDuplicado', () => {
  it('encuentra un pedido del mismo día por el mismo total', () => {
    expect(buscarDuplicado(recientes, 240000)?.consecutivo).toBe('PED-000148')
  })

  it('devuelve null cuando el total no coincide con ninguno', () => {
    expect(buscarDuplicado(recientes, 190000)).toBeNull()
  })

  it('devuelve null cuando el cliente no tiene pedidos hoy', () => {
    expect(buscarDuplicado([], 240000)).toBeNull()
  })

  it('ignora el total en cero: un pedido vacío no es duplicado de nada', () => {
    expect(buscarDuplicado([{ consecutivo: 'PED-000160', total: 0 }], 0)).toBeNull()
  })
})
