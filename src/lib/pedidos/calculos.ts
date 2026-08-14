import type { ItemPedido, Totales } from '@/lib/tipos'

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
  const total = Math.max(0, subtotal + valorDomicilio - descuento)
  return { subtotal, totalKg, total }
}
