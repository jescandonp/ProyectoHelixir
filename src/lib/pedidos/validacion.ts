import type { ItemPedido, TipoEntrega } from '@/lib/tipos'

export interface BorradorPedido {
  clienteId: string | null
  direccionId: string | null
  items: ItemPedido[]
  tipoEntrega: TipoEntrega
  transportadora: string | null
}

export function validarParaConfirmar(borrador: BorradorPedido): string[] {
  const problemas: string[] = []

  if (!borrador.clienteId) problemas.push('Falta escoger el cliente')
  if (!borrador.direccionId) problemas.push('Falta escoger la dirección de entrega')
  if (borrador.items.length === 0) problemas.push('El pedido no tiene productos')

  if (borrador.tipoEntrega === 'nacional' && !borrador.transportadora?.trim()) {
    problemas.push('Falta la transportadora del envío nacional')
  }

  for (const item of borrador.items) {
    if (item.productoId !== null) continue
    if (!item.descripcion.trim()) {
      problemas.push('Hay un ítem libre sin descripción')
    } else if (item.precioUnitario <= 0) {
      problemas.push(`Hay un ítem libre sin precio: ${item.descripcion.trim()}`)
    }
  }

  return problemas
}
