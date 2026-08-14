import type {
  Cliente, Direccion, ItemPedido, TipoEntrega, EstadoPago,
} from '@/lib/tipos'

const LLAVE = 'pedido-borrador'
const VIGENCIA_MS = 24 * 60 * 60 * 1000

export interface BorradorGuardado {
  cliente: Cliente | null
  direccion: Direccion | null
  items: ItemPedido[]
  tipoEntrega: TipoEntrega
  transportadora: string
  estadoPago: EstadoPago
  valorDomicilio: number
  observaciones: string
  guardadoEn: string
}

function almacenPorDefecto(): Storage | null {
  return typeof window === 'undefined' ? null : window.localStorage
}

export function guardarBorradorLocal(borrador: BorradorGuardado, almacen = almacenPorDefecto()) {
  almacen?.setItem(LLAVE, JSON.stringify(borrador))
}

export function leerBorradorLocal(almacen = almacenPorDefecto()): BorradorGuardado | null {
  const crudo = almacen?.getItem(LLAVE)
  if (!crudo) return null

  try {
    const borrador = JSON.parse(crudo) as BorradorGuardado
    const edad = Date.now() - new Date(borrador.guardadoEn).getTime()
    if (!Number.isFinite(edad) || edad > VIGENCIA_MS) return null
    return borrador
  } catch {
    return null   // contenido corrupto: se ignora, no se rompe la pantalla
  }
}

export function limpiarBorradorLocal(almacen = almacenPorDefecto()) {
  almacen?.removeItem(LLAVE)
}
