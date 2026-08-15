import Link from 'next/link'
import { obtenerUsuarioActual } from '@/lib/db/cliente-supabase'

const ENLACES = [
  { href: '/pedidos/nuevo', texto: 'Nuevo pedido' },
  { href: '/pedidos', texto: 'Pedidos' },
  { href: '/clientes', texto: 'Clientes' },
  { href: '/ajustes', texto: 'Ajustes' },
]

export async function NavegacionPrincipal() {
  const usuario = await obtenerUsuarioActual()

  return (
    // `solo-pantalla` la esconde al imprimir: la pantalla de documentos
    // usa el mismo layout y el rótulo no puede salir con el menú encima.
    <header className="solo-pantalla border-b bg-white">
      <nav className="mx-auto flex max-w-6xl items-center gap-1 px-4 py-2">
        {ENLACES.map(({ href, texto }) => (
          <Link
            key={href}
            href={href}
            className="rounded-md px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100"
          >
            {texto}
          </Link>
        ))}
        {usuario && (
          <span className="ml-auto text-xs text-slate-500">
            {usuario.nombre} · {usuario.codigoAsesor}
          </span>
        )}
      </nav>
    </header>
  )
}
