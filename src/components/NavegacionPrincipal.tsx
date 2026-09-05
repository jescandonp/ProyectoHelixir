import Link from 'next/link'
import { obtenerUsuarioActual } from '@/lib/db/cliente-supabase'
import { obtenerAjustes } from '@/lib/db/ajustes'
import { EnlacesSuperiores, EnlacesInferiores } from '@/components/EnlacesNavegacion'
import { BotonSalir } from '@/components/BotonSalir'
import { Logo } from '@/components/Logo'
import { IconoUsuario } from '@/components/iconos'

/** El nombre del negocio se configura en Ajustes, así que la barra lo lee de
 *  ahí en vez de traerlo quemado. Si la consulta falla, la navegación no
 *  puede tumbar toda la pantalla: cae a un rótulo neutro. Ese rótulo no
 *  puede ser "Pedidos" ni "Clientes": chocaría con el nombre accesible de
 *  los enlaces del menú, que es como los buscan las pruebas e2e. */
async function nombreDelNegocio(): Promise<string> {
  try {
    return (await obtenerAjustes()).nombreNegocio
  } catch {
    return 'Helado Artesanal'
  }
}

export async function NavegacionPrincipal() {
  const [usuario, negocio] = await Promise.all([obtenerUsuarioActual(), nombreDelNegocio()])

  return (
    // `solo-pantalla` la esconde al imprimir: la pantalla de documentos
    // usa el mismo layout y el rótulo no puede salir con el menú encima.
    <>
      <header className="solo-pantalla sticky top-0 z-20 border-b border-borde-suave bg-tarjeta">
        <div className="mx-auto flex max-w-6xl items-center gap-8 px-4 py-3 md:px-10">
          <Link href="/pedidos/nuevo" className="shrink-0">
            <Logo nombre={negocio} className="h-8 w-auto md:h-9" />
          </Link>

          <EnlacesSuperiores />

          <div className="ml-auto flex items-center gap-3">
            {usuario && (
              <span className="flex items-center gap-1.5 text-etiqueta-lg text-tinta-suave">
                <IconoUsuario className="h-[18px] w-[18px] shrink-0" />
                <span className="hidden sm:inline">
                  {usuario.nombre} · {usuario.codigoAsesor}
                </span>
              </span>
            )}
            <BotonSalir />
          </div>
        </div>
      </header>

      <EnlacesInferiores />
    </>
  )
}
