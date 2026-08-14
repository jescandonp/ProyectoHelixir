import { describe, it, expect } from 'vitest'
import { calcularSubtotalItem, calcularTotales } from './calculos'
import type { ItemPedido } from '@/lib/tipos'

function item(cantidad: number, precioUnitario: number): ItemPedido {
  return { productoId: 'x', descripcion: 'Vainilla', cantidad, precioUnitario }
}

describe('calcularSubtotalItem', () => {
  it('multiplica cantidad por precio', () => {
    expect(calcularSubtotalItem(item(4, 22000))).toBe(88000)
  })
})

describe('calcularTotales', () => {
  it('suma el pedido real del diseño', () => {
    const items = [item(4, 22000), item(2, 22000), item(4, 25000)]
    const totales = calcularTotales(items, 8000, 0)
    expect(totales.subtotal).toBe(232000)
    expect(totales.total).toBe(240000)
  })

  it('cuenta los kilos como suma de cantidades, porque 1 tarro = 1 kg', () => {
    const items = [item(4, 22000), item(2, 22000), item(4, 25000)]
    expect(calcularTotales(items, 0, 0).totalKg).toBe(10)
  })

  it('resta el descuento', () => {
    expect(calcularTotales([item(1, 22000)], 5000, 2000).total).toBe(25000)
  })

  it('devuelve ceros con el pedido vacío', () => {
    expect(calcularTotales([], 0, 0)).toEqual({ subtotal: 0, totalKg: 0, total: 0 })
  })

  it('nunca devuelve un total negativo aunque el descuento sea excesivo', () => {
    expect(calcularTotales([item(1, 22000)], 0, 99999).total).toBe(0)
  })

  it('incluye ítems libres, que no tienen producto', () => {
    const libre: ItemPedido = {
      productoId: null, descripcion: 'Sabor experimental', cantidad: 1, precioUnitario: 30000,
    }
    const totales = calcularTotales([item(2, 22000), libre], 0, 0)
    expect(totales.subtotal).toBe(74000)
    expect(totales.totalKg).toBe(3)
  })
})
