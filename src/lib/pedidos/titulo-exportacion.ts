// Separado de `route.ts` a propósito: un route handler de Next.js solo puede
// exportar métodos HTTP (GET, POST, ...) y un puñado de opciones de
// configuración reconocidas — cualquier otro export ahí (como esta función,
// que se necesita exportada para poder probarla) rompe `npm run build`.

const TITULOS_PESTANA: Record<string, string> = {
  hoy: 'Pedidos — Hoy',
  porcobrar: 'Pedidos — Por cobrar',
  todos: 'Pedidos — Todos',
}

function formatearFechaTitulo(dia: string): string {
  const [anio, mes, diaMes] = dia.split('-')
  return `${diaMes}/${mes}/${anio}`
}

/** El título fijo por pestaña ("Pedidos — Hoy") deja de ser cierto en cuanto
 *  el usuario aplica un rango de fechas manual sobre esa pestaña —
 *  `FiltrosPedidos.tsx` conserva `pestana` al elegir fechas a mano, así que
 *  sin esto un PDF con quince días de datos podría salir titulado "Hoy".
 *
 *  `hayRangoManual` es exactamente la misma condición (`desde && hasta`,
 *  ambos ya validados por `fechaValida`) que decide si se arma `rango` en el
 *  `GET` de `route.ts` — se recibe como parámetro en vez de recalcularse
 *  aquí para que las dos decisiones no puedan divergir. Con un solo extremo
 *  presente (o ninguno) el filtro de fechas real nunca se aplicó (cae a
 *  `rangoDelDia()` en "Hoy", o sin filtro en las demás pestañas), así que el
 *  título tampoco debe mencionar "desde"/"hasta" sueltos: usa el nombre fijo
 *  de la pestaña actual.
 *
 *  Para la pestaña "porcobrar" con rango manual, el rango no reemplaza el
 *  calificador de cartera — el PDF sigue siendo el listado de "Por cobrar",
 *  solo que acotado a esas fechas. */
export function tituloDelPdf(
  pestana: string,
  desde: string | undefined,
  hasta: string | undefined,
  hayRangoManual: boolean,
): string {
  if (hayRangoManual && desde && hasta) {
    const textoRango = `${formatearFechaTitulo(desde)} al ${formatearFechaTitulo(hasta)}`
    return pestana === 'porcobrar' ? `Pedidos — Por cobrar — ${textoRango}` : `Pedidos — ${textoRango}`
  }
  return TITULOS_PESTANA[pestana] ?? 'Pedidos'
}
