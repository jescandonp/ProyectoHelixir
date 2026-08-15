/** Colombia no tiene horario de verano desde 1993, así que el desfase es
 *  fijo. Escribirlo a mano hace el cálculo determinista y probable, sin
 *  depender de la zona en que corra el servidor. */
const DESFASE = '-05:00'

const PARTES_BOGOTA = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Bogota',
  year: 'numeric', month: '2-digit', day: '2-digit',
})

export interface Rango {
  /** Instante ISO inclusive. */
  desde: string
  /** Instante ISO exclusivo. */
  hasta: string
}

/** Fecha civil en Bogotá para un instante dado: "2026-08-14". */
export function diaEnBogota(instante: Date): string {
  const partes = Object.fromEntries(
    PARTES_BOGOTA.formatToParts(instante).map((p) => [p.type, p.value]),
  ) as Record<string, string>
  return `${partes.year}-${partes.month}-${partes.day}`
}

/** Medianoche de ese día en Bogotá, como instante ISO. */
function medianoche(dia: string): string {
  return new Date(`${dia}T00:00:00${DESFASE}`).toISOString()
}

function sumarDias(dia: string, cuantos: number): string {
  const [anio, mes, numero] = dia.split('-').map(Number)
  return new Date(Date.UTC(anio, mes - 1, numero + cuantos)).toISOString().slice(0, 10)
}

export function rangoDelDia(ahora: Date = new Date()): Rango {
  const dia = diaEnBogota(ahora)
  return { desde: medianoche(dia), hasta: medianoche(sumarDias(dia, 1)) }
}

export function rangoDelMes(ahora: Date = new Date()): Rango {
  const [anio, mes] = diaEnBogota(ahora).split('-').map(Number)
  const primero = `${anio}-${String(mes).padStart(2, '0')}-01`
  const siguiente = mes === 12
    ? `${anio + 1}-01-01`
    : `${anio}-${String(mes + 1).padStart(2, '0')}-01`
  return { desde: medianoche(primero), hasta: medianoche(siguiente) }
}

/** Los dos días son inclusive: "del 1 al 15" incluye el 15 completo. */
export function rangoEntre(desdeDia: string, hastaDia: string): Rango {
  return { desde: medianoche(desdeDia), hasta: medianoche(sumarDias(hastaDia, 1)) }
}
