'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  IconoNuevoPedido, IconoPedidos, IconoClientes, IconoAjustes,
} from '@/components/iconos'

const ENLACES = [
  { href: '/pedidos/nuevo', texto: 'Nuevo pedido', Icono: IconoNuevoPedido },
  { href: '/pedidos', texto: 'Pedidos', Icono: IconoPedidos },
  { href: '/clientes', texto: 'Clientes', Icono: IconoClientes },
  { href: '/ajustes', texto: 'Ajustes', Icono: IconoAjustes },
]

/** `/pedidos/nuevo` empieza por `/pedidos`: sin el caso exacto, entrar a
 *  crear un pedido dejaría dos pestañas encendidas a la vez. */
function estaActivo(ruta: string, href: string): boolean {
  return href === '/pedidos' ? ruta === '/pedidos' : ruta.startsWith(href)
}

export function EnlacesSuperiores() {
  const ruta = usePathname()

  return (
    <nav className="hidden items-center gap-6 md:flex">
      {ENLACES.map(({ href, texto }) => {
        const activo = estaActivo(ruta, href)
        return (
          <Link
            key={href}
            href={href}
            aria-current={activo ? 'page' : undefined}
            className={`border-b-2 pb-1 text-etiqueta-lg transition-colors ${
              activo
                ? 'border-primario text-primario'
                : 'border-transparent text-tinta-tenue hover:text-primario'
            }`}
          >
            {texto}
          </Link>
        )
      })}
    </nav>
  )
}

/** En el celular la barra vive abajo, al alcance del pulgar: quien toma el
 *  pedido suele tener el teléfono en una mano y el helado en la otra. */
export function EnlacesInferiores() {
  const ruta = usePathname()

  return (
    <nav className="solo-pantalla fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-borde-suave bg-tarjeta pb-[env(safe-area-inset-bottom)] md:hidden">
      {ENLACES.map(({ href, texto, Icono }) => {
        const activo = estaActivo(ruta, href)
        return (
          <Link
            key={href}
            href={href}
            aria-current={activo ? 'page' : undefined}
            className={`flex flex-col items-center gap-1 py-2 text-etiqueta-md transition-colors ${
              activo ? 'text-primario' : 'text-tinta-tenue'
            }`}
          >
            <Icono className={`h-6 w-6 shrink-0 ${activo ? 'stroke-[2.2]' : ''}`} />
            {texto}
          </Link>
        )
      })}
    </nav>
  )
}
