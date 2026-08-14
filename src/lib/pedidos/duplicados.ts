export interface PedidoReciente {
  consecutivo: string
  total: number
}

/** Solo avisa. La decisión de seguir es siempre de la persona. */
export function buscarDuplicado(
  recientes: PedidoReciente[],
  total: number,
): PedidoReciente | null {
  if (total <= 0) return null
  return recientes.find((p) => p.total === total) ?? null
}
