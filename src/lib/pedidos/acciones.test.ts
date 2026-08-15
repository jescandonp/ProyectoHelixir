import { describe, it, expect } from 'vitest'
import { accionesDisponibles } from './acciones'

describe('accionesDisponibles', () => {
  it('un pedido recién confirmado se puede cobrar, despachar y anular', () => {
    const a = accionesDisponibles('confirmado', 'pendiente')
    expect(a.puedeCobrar).toBe(true)
    expect(a.puedeEnviar).toBe(true)
    expect(a.puedeAnular).toBe(true)
    expect(a.puedeVerDocumentos).toBe(true)
  })

  it('no se puede entregar algo que no se ha enviado', () => {
    expect(accionesDisponibles('confirmado', 'pendiente').puedeEntregar).toBe(false)
  })

  it('un pedido enviado se puede entregar', () => {
    expect(accionesDisponibles('enviado', 'contraentrega').puedeEntregar).toBe(true)
  })

  it('un pedido ya pagado no se vuelve a cobrar', () => {
    expect(accionesDisponibles('entregado', 'pagado').puedeCobrar).toBe(false)
  })

  it('una contraentrega entregada todavía se puede cobrar', () => {
    // El mensajero volvió con la plata: el pedido ya se entregó pero
    // el cobro se registra después.
    expect(accionesDisponibles('entregado', 'contraentrega').puedeCobrar).toBe(true)
  })

  it('un pedido entregado ya no se anula', () => {
    expect(accionesDisponibles('entregado', 'pagado').puedeAnular).toBe(false)
  })

  it('un pedido anulado solo deja ver sus documentos', () => {
    const a = accionesDisponibles('anulado', 'pendiente')
    expect(a.puedeCobrar).toBe(false)
    expect(a.puedeEnviar).toBe(false)
    expect(a.puedeEntregar).toBe(false)
    expect(a.puedeAnular).toBe(false)
    expect(a.puedeVerDocumentos).toBe(true)
  })

  it('un borrador no tiene documentos que mostrar', () => {
    expect(accionesDisponibles('borrador', 'pendiente').puedeVerDocumentos).toBe(false)
  })
})
