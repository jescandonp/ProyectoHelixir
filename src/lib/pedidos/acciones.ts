import type { EstadoPedido, EstadoPago } from '@/lib/tipos'
import { puedeTransicionar } from './estados'

export interface AccionesPedido {
  puedeCobrar: boolean
  puedeEnviar: boolean
  puedeEntregar: boolean
  puedeAnular: boolean
  puedeVerDocumentos: boolean
}

/** La fila del listado no decide nada: pinta lo que este módulo autoriza. */
export function accionesDisponibles(
  estado: EstadoPedido,
  estadoPago: EstadoPago,
): AccionesPedido {
  return {
    // Una contraentrega entregada sigue siendo cobrable: el registro del
    // pago llega cuando el mensajero vuelve.
    puedeCobrar: estado !== 'borrador' && estado !== 'anulado' && estadoPago !== 'pagado',
    puedeEnviar: puedeTransicionar(estado, 'enviado'),
    puedeEntregar: puedeTransicionar(estado, 'entregado'),
    puedeAnular: puedeTransicionar(estado, 'anulado'),
    puedeVerDocumentos: estado !== 'borrador',
  }
}
