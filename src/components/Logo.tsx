import Image from 'next/image'

/* El archivo es el logo real del negocio (1280×349, fondo blanco, sin
   transparencia), así que solo se ve bien sobre superficies claras: la barra
   y la tarjeta de ingreso, ambas blancas. `alt` lleva el nombre configurado
   en Ajustes y no un texto fijo, para que el lector de pantalla diga el
   nombre del negocio de quien esté usando la app.

   La extensión tiene que ser `.jpg`, no `.jpeg`: el `matcher` del middleware
   deja pasar sin sesión solo `svg|png|jpg`, y con `.jpeg` el logo terminaba
   redirigido al login — o sea, invisible justo en la pantalla de login. */

const ANCHO_ORIGINAL = 1280
const ALTO_ORIGINAL = 349

export function Logo({
  nombre, className, prioritario = false,
}: {
  nombre: string
  className?: string
  /** Solo en la pantalla de ingreso, donde el logo es lo primero que se ve. */
  prioritario?: boolean
}) {
  return (
    <Image
      src="/logo-helixir.jpg"
      alt={nombre}
      width={ANCHO_ORIGINAL}
      height={ALTO_ORIGINAL}
      priority={prioritario}
      // `mix-blend-multiply` funde el fondo casi blanco del JPEG con la
      // superficie que tenga debajo. Sin esto el logo se ve dentro de un
      // recuadro gris, porque el archivo no trae transparencia y su blanco
      // no es exactamente el de la tarjeta.
      className={`mix-blend-multiply ${className ?? 'h-9 w-auto'}`}
    />
  )
}
