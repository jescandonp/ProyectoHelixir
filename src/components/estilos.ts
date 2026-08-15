/* Las combinaciones de clases que se repiten en varias pantallas. Viven
   aquí y no sueltas en cada archivo para que un botón primario se vea igual
   en Pedidos, en Clientes y en Ajustes, y para que cambiar el sistema sea
   tocar un solo sitio. Lo que solo aparece una vez se queda en su
   componente: esto no pretende ser una librería. */

/** Blanco sobre crema, esquina de tarjeta y sombra con tinte rosa. */
export const TARJETA = 'rounded-2xl bg-tarjeta shadow-nivel1'

/** Rosa lleno. La acción principal de cada pantalla, una sola por vista. */
export const BOTON_PRIMARIO =
  'inline-flex items-center justify-center gap-2 rounded-md bg-primario px-4 py-2.5 ' +
  'text-etiqueta-lg text-sobre-primario transition-colors hover:bg-primario-vivo ' +
  'disabled:bg-secundario-contenedor-tenue disabled:text-tinta-tenue'

/** Borde rosa sobre blanco. Acciones de apoyo. */
export const BOTON_SECUNDARIO =
  'inline-flex items-center justify-center gap-1.5 rounded-md border border-borde-suave ' +
  'bg-tarjeta px-3 py-1.5 text-etiqueta-md text-primario transition-colors ' +
  'hover:border-primario hover:bg-primario-fijo/40 disabled:opacity-50'

/** Teal lleno: lo que confirma algo que entró bien (cobrar, entregar). */
export const BOTON_EXITO =
  'inline-flex items-center justify-center gap-1.5 rounded-md bg-terciario px-3 py-1.5 ' +
  'text-etiqueta-md text-sobre-terciario transition-colors hover:bg-terciario-vivo ' +
  'disabled:opacity-50'

/** Rojo de contorno: anular y demás acciones que duelen si se hacen mal. */
export const BOTON_PELIGRO =
  'inline-flex items-center justify-center gap-1.5 rounded-md border border-error/40 ' +
  'bg-tarjeta px-3 py-1.5 text-etiqueta-md text-error transition-colors ' +
  'hover:bg-error-contenedor disabled:opacity-50'

/** Sin fondo ni borde: "cambiar", "editar", enlaces dentro de una tarjeta. */
export const BOTON_FANTASMA =
  'rounded-sm text-etiqueta-md text-primario underline-offset-2 transition-colors ' +
  'hover:text-primario-vivo hover:underline disabled:opacity-50'

/** Campo de texto: fondo apenas hundido y borde que se vuelve rosa al foco. */
export const CAMPO =
  'w-full rounded-md border border-borde-suave bg-tarjeta-baja px-3 py-2 text-cuerpo-md ' +
  'text-tinta outline-none transition-colors placeholder:text-borde focus:border-primario'

/** El mismo campo, en la escala pequeña de las tablas y los formularios
 *  densos. A propósito no trae ancho: la mitad de sus usos son controles
 *  sueltos dentro de una fila y la otra mitad ocupa el renglón entero, y dos
 *  utilidades de `width` en la misma cadena no se pisan en un orden fiable.
 *  Quien lo use pone el ancho que necesita. */
export const CAMPO_CHICO =
  'rounded-md border border-borde-suave bg-tarjeta-baja px-2.5 py-1.5 text-etiqueta-lg ' +
  'font-medium tracking-normal text-tinta outline-none transition-colors ' +
  'placeholder:text-borde focus:border-primario'

/** El rótulo que va encima de un campo o de una sección. */
export const ETIQUETA = 'mb-1.5 block text-etiqueta-lg text-tinta'

/** El rótulo tenue de las secciones numeradas ("1 · CLIENTE"). */
export const ETIQUETA_SECCION = 'text-etiqueta-md uppercase tracking-[0.08em] text-tinta-suave'

/** Pastilla completa, para estados. Nunca para algo en lo que se pueda hacer clic. */
export const CHIP = 'inline-block rounded-full px-2.5 py-0.5 text-etiqueta-md whitespace-nowrap'

/** El código del cliente (CL-0134), que se lee de un vistazo en las listas. */
export const CHIP_CODIGO = `${CHIP} bg-primario-fijo font-mono text-sobre-primario-fijo-variante`

/** Colores del estado de pago. El teal es "ya entró la plata"; el neutro
 *  cálido, "todavía no"; el rosa claro, "se cobra al entregar". */
export const CHIP_PAGO: Record<string, string> = {
  pagado: `${CHIP} bg-terciario-fijo text-sobre-terciario-fijo`,
  contraentrega: `${CHIP} bg-primario-fijo text-sobre-primario-fijo-variante`,
  pendiente: `${CHIP} bg-secundario-contenedor text-sobre-secundario-fijo-variante`,
}

/** Aviso de error, en bloque. */
export const AVISO_ERROR =
  'rounded-md bg-error-contenedor px-3 py-2 text-etiqueta-lg text-sobre-error-contenedor'

/** Aviso de que algo salió bien. */
export const AVISO_EXITO =
  'rounded-md bg-terciario-fijo px-3 py-2 text-etiqueta-lg text-sobre-terciario-fijo'

/** Aviso de "ojo con esto", sin ser un error. */
export const AVISO_ATENCION =
  'rounded-md border border-borde-suave bg-primario-fijo/50 px-3 py-2 text-etiqueta-md text-sobre-primario-fijo-variante'
