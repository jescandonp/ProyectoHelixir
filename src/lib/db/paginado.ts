// Sin `'use server'` a propósito, igual que `filtros-pedidos.ts`: así se
// puede importar y llamar tal cual desde Vitest, que no puede ejecutar
// `crearClienteServidor` (ver "Global Constraints" en
// docs/superpowers/plans/2026-08-29-exportar-listado-pedidos.md).

/** PostgREST aplica su propio techo a cualquier consulta (`max_rows` en
 *  supabase/config.toml, hoy 1000), con o sin `.range()` — una consulta sin
 *  paginar que iguale o supere ese número de filas se trunca en silencio,
 *  sin error. Por eso `traerTodoPaginado` siempre pide de a este tamaño. */
export const TAMANO_BLOQUE_POSTGREST = 1000

interface ResultadoBloque<F> {
  data: F[] | null
  error: { message: string } | null
}

/** Trae todas las filas de una consulta pidiendo bloques de
 *  `TAMANO_BLOQUE_POSTGREST` con `.range()`, acumulando hasta que un bloque
 *  devuelva menos filas de las pedidas (o ninguna) — la señal de que ya no
 *  queda nada más. `construirConsulta` arma la consulta de cero en cada
 *  vuelta: el builder de supabase-js queda "consumido" tras aplicarle
 *  `.range()` y esperarlo, así que no se puede reutilizar entre vueltas. */
export async function traerTodoPaginado<F>(
  construirConsulta: (desde: number, hasta: number) => PromiseLike<ResultadoBloque<F>>,
): Promise<F[]> {
  const filas: F[] = []
  let desde = 0
  for (;;) {
    const { data, error } = await construirConsulta(desde, desde + TAMANO_BLOQUE_POSTGREST - 1)
    if (error) throw new Error(error.message)
    const bloque = data ?? []
    filas.push(...bloque)
    if (bloque.length < TAMANO_BLOQUE_POSTGREST) break
    desde += TAMANO_BLOQUE_POSTGREST
  }
  return filas
}
