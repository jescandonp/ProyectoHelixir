import type { EstadoPedido } from '@/lib/tipos'

export const TRANSICIONES: Record<EstadoPedido, EstadoPedido[]> = {
  borrador:   ['confirmado', 'anulado'],
  confirmado: ['enviado', 'anulado'],
  enviado:    ['entregado', 'anulado'],
  entregado:  [],
  anulado:    [],
}

export function puedeTransicionar(desde: EstadoPedido, hacia: EstadoPedido): boolean {
  return TRANSICIONES[desde].includes(hacia)
}

export function esEditable(estado: EstadoPedido): boolean {
  return estado === 'borrador'
}
