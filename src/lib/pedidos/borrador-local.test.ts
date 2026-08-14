import { describe, it, expect, beforeEach } from 'vitest'
import {
  guardarBorradorLocal, leerBorradorLocal, limpiarBorradorLocal,
  type BorradorGuardado,
} from './borrador-local'

function almacenFalso(): Storage {
  const datos = new Map<string, string>()
  return {
    getItem: (k) => datos.get(k) ?? null,
    setItem: (k, v) => void datos.set(k, v),
    removeItem: (k) => void datos.delete(k),
    clear: () => datos.clear(),
    key: () => null,
    get length() { return datos.size },
  } as Storage
}

function ejemplo(): BorradorGuardado {
  return {
    cliente: { id: 'c1', codigo: 'CL-0042', nombre: 'Juanito', telefono: null,
               cedula: null, tipo: 'detal', notas: null, direcciones: [] },
    direccion: null,
    items: [{ productoId: 'p1', descripcion: 'Vainilla', cantidad: 4, precioUnitario: 22000 }],
    tipoEntrega: 'local',
    transportadora: '',
    estadoPago: 'pendiente',
    valorDomicilio: 8000,
    observaciones: 'Timbre 302',
    guardadoEn: new Date().toISOString(),
  }
}

describe('borrador local', () => {
  let almacen: Storage
  beforeEach(() => { almacen = almacenFalso() })

  it('devuelve null cuando no hay nada guardado', () => {
    expect(leerBorradorLocal(almacen)).toBeNull()
  })

  it('guarda y recupera el borrador completo', () => {
    guardarBorradorLocal(ejemplo(), almacen)
    const leido = leerBorradorLocal(almacen)
    expect(leido?.items).toHaveLength(1)
    expect(leido?.items[0].cantidad).toBe(4)
    expect(leido?.observaciones).toBe('Timbre 302')
    expect(leido?.cliente?.nombre).toBe('Juanito')
  })

  it('limpiar deja el almacén vacío', () => {
    guardarBorradorLocal(ejemplo(), almacen)
    limpiarBorradorLocal(almacen)
    expect(leerBorradorLocal(almacen)).toBeNull()
  })

  it('no explota si el contenido guardado está corrupto', () => {
    almacen.setItem('pedido-borrador', '{esto no es json')
    expect(leerBorradorLocal(almacen)).toBeNull()
  })

  it('descarta un borrador de más de 24 horas', () => {
    const viejo = { ...ejemplo(), guardadoEn: new Date(Date.now() - 25 * 3600_000).toISOString() }
    guardarBorradorLocal(viejo, almacen)
    expect(leerBorradorLocal(almacen)).toBeNull()
  })
})
