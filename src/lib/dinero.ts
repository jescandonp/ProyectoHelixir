export function formatearPesosSinSimbolo(valor: number): string {
  return Math.round(valor).toLocaleString('es-CO', { maximumFractionDigits: 0 })
}

export function formatearPesos(valor: number): string {
  return `$ ${formatearPesosSinSimbolo(valor)}`
}
