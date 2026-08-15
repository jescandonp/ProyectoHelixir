// Filtro compartido entre producción y pruebas: sin `'use server'` a propósito.
// Este archivo debe poder importarse desde Vitest corriendo en Node, y además
// los módulos `'use server'` solo pueden exportar funciones async, así que una
// función síncrona como esta no podría vivir ahí.

/**
 * Aplica el filtro de "pedido real": tiene consecutivo asignado y no está en
 * estado `borrador`.
 *
 * No basta con comprobar el consecutivo: `confirmarPedido` cambia el estado
 * a algo distinto de `borrador` y solo después pide el consecutivo, así que
 * un fallo entre esos dos pasos —o una asignación manual de consecutivo fuera
 * de ese flujo— puede dejar un pedido en `borrador` con consecutivo ya
 * asignado. En la base local aparecieron 128 filas exactamente así: en
 * `estado = 'borrador'` pero con consecutivo puesto. El filtro tiene que
 * decir "no es borrador" de forma explícita, que es la intención real, en
 * vez de inferirlo del consecutivo.
 *
 * `T` no lleva una restricción tipo `T extends { not(...): T; neq(...): T }`
 * a propósito: el constructor real de Supabase (`PostgrestFilterBuilder`)
 * tiene firmas sobrecargadas y muy anidadas, y pedirle a TypeScript que
 * compruebe esa restricción contra el tipo real dispara "Type instantiation
 * is excessively deep and possibly infinite" al compilar (se reprodujo en
 * este proyecto). Por eso adentro se pasa por `any` para llamar `.not()` y
 * `.neq()` sin que el checker intente resolver esas firmas, y se devuelve
 * como `T` para que quien llama pueda seguir encadenando con el tipo
 * original de su consulta.
 */
export function filtrarPedidosReales<T>(consulta: T): T {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const conFiltro = consulta as any
  return conFiltro.not('consecutivo', 'is', null).neq('estado', 'borrador') as T
}
