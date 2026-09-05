import { describe, it, expect } from 'vitest'
import { renderListadoPedidosPdf } from './ListadoPedidosPdf'
import type { FilaPedido } from '@/lib/db/pedidos-consultas'

const FILA: FilaPedido = {
  id: 'p1', consecutivo: 'PED-000148', fecha: '2026-08-11T21:17:00.000Z',
  clienteNombre: 'Juanito González', clienteCodigo: 'CL-0042', dirCiudad: 'Medellín',
  totalKg: 10, total: 240000, estado: 'confirmado', estadoPago: 'pendiente',
}

describe('renderListadoPedidosPdf', () => {
  it('renderiza un PDF no vacío con filas', async () => {
    const buffer = await renderListadoPedidosPdf([FILA], 'Pedidos — Hoy')
    expect(buffer.byteLength).toBeGreaterThan(0)
  })

  it('renderiza un PDF no vacío sin filas, en vez de lanzar', async () => {
    const buffer = await renderListadoPedidosPdf([], 'Pedidos — Hoy')
    expect(buffer.byteLength).toBeGreaterThan(0)
  })
})
