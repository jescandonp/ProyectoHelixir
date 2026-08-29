import { describe, it, expect } from 'vitest'
import { fechaValida, estadoPagoValido } from './filtros-url'

describe('fechaValida', () => {
  it('acepta una fecha real en formato AAAA-MM-DD', () => {
    expect(fechaValida('2026-08-14')).toBe('2026-08-14')
  })

  it('rechaza un formato que no es AAAA-MM-DD', () => {
    expect(fechaValida('14-08-2026')).toBeUndefined()
  })

  it('rechaza una fecha que no existe, como el 30 de febrero', () => {
    expect(fechaValida('2026-02-30')).toBeUndefined()
  })

  it('rechaza vacío o indefinido', () => {
    expect(fechaValida('')).toBeUndefined()
    expect(fechaValida(undefined)).toBeUndefined()
  })
})

describe('estadoPagoValido', () => {
  it('acepta los tres estados de pago válidos', () => {
    expect(estadoPagoValido('pendiente')).toBe('pendiente')
    expect(estadoPagoValido('contraentrega')).toBe('contraentrega')
    expect(estadoPagoValido('pagado')).toBe('pagado')
  })

  it('rechaza un valor que no es un estado de pago, sin lanzar', () => {
    expect(estadoPagoValido('otro-cualquiera')).toBeUndefined()
    expect(estadoPagoValido(undefined)).toBeUndefined()
  })
})
