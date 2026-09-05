import type { ItemPedido, Totales } from '@/lib/tipos'

export function validarDescuento(descuento: number, subtotal: number): string | null {
  if (!Number.isInteger(descuento) || descuento < 0) {
    return 'El descuento debe ser un valor entero mayor o igual a $0'
  }
  if (descuento > subtotal) {
    return 'El descuento no puede superar el subtotal de productos'
  }
  return null
}

export function calcularSubtotalItem(item: ItemPedido): number {
  return item.cantidad * item.precioUnitario
}

export function calcularTotales(
  items: ItemPedido[],
  valorDomicilio: number,
  descuento: number,
): Totales {
  const subtotal = items.reduce((suma, item) => suma + calcularSubtotalItem(item), 0)
  const totalKg = items.reduce((suma, item) => suma + item.cantidad, 0)
  const subtotalNeto = Math.max(0, subtotal - descuento)
  const total = subtotalNeto + valorDomicilio
  return { subtotal, totalKg, total }
}
