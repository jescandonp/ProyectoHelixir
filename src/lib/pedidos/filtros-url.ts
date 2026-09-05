import type { EstadoPago } from '@/lib/tipos'

const ESTADOS_PAGO: EstadoPago[] = ['pendiente', 'contraentrega', 'pagado']

/** Un valor fuera de esta lista (URL retocada a mano) se ignora en vez de
 *  romper la pantalla, igual que ya hace `fechaValida` con las fechas. */
export function estadoPagoValido(valor: string | undefined): EstadoPago | undefined {
  return ESTADOS_PAGO.includes(valor as EstadoPago) ? (valor as EstadoPago) : undefined
}

const FORMATO_FECHA = /^\d{4}-\d{2}-\d{2}$/

/** Exige la forma AAAA-MM-DD y que sea una fecha real (rechaza p.ej.
 *  "2026-02-30", que `Date` normalizaría en vez de rechazar). Una fecha
 *  inválida en la URL no debe romper la pantalla: se ignora y quien llama
 *  cae al comportamiento por defecto, en vez de dejar que `rangoEntre`
 *  reviente con un `RangeError` al construir el ISO. */
export function fechaValida(valor: string | undefined): string | undefined {
  if (!valor || !FORMATO_FECHA.test(valor)) return undefined
  const [anio, mes, dia] = valor.split('-').map(Number)
  const fecha = new Date(Date.UTC(anio, mes - 1, dia))
  const esReal =
    fecha.getUTCFullYear() === anio && fecha.getUTCMonth() === mes - 1 && fecha.getUTCDate() === dia
  return esReal ? valor : undefined
}
