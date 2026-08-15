// Un archivo `'use server'` solo puede exportar funciones asíncronas, así que
// estas constantes no pueden vivir en los repositorios que las usan.
export const POR_PAGINA = 50
export const CLIENTES_POR_PAGINA = 50

// La URL de esta pantalla está pensada para compartirse por chat, así que
// llega como entrada de usuario real: puede traer cualquier cosa. Una
// página que no sea un entero >= 0 no debe tumbar la pantalla, cae a la
// primera.
export function sanearPagina(valor: string | undefined): number {
  const numero = Number(valor)
  return Number.isInteger(numero) && numero >= 0 ? numero : 0
}
