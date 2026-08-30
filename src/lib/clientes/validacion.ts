const FORMATO_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Formato básico: algo@algo.algo, sin espacios. No valida que el dominio
 *  exista de verdad — eso solo se sabe al intentar enviar. */
export function correoValido(texto: string): boolean {
  return FORMATO_CORREO.test(texto.trim())
}
