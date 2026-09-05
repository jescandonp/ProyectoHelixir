/* Los mockups traen los iconos de Material Symbols por CDN. Aquí van como
   SVG inline: la app tiene que abrir en el negocio aunque la red esté mala,
   y una fuente de iconos entera pesa más que estos diez trazos. */

type Props = { className?: string }

const BASE = 'h-5 w-5 shrink-0'

function Trazo({ className, children }: Props & { children: React.ReactNode }) {
  return (
    <svg
      className={className ?? BASE}
      viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  )
}

export function IconoNuevoPedido(p: Props) {
  return (
    <Trazo {...p}>
      <path d="M3 4h2l2.5 11h10L20 7H6" />
      <circle cx="9.5" cy="19" r="1.4" />
      <circle cx="17" cy="19" r="1.4" />
      <path d="M13 5v5M10.5 7.5h5" />
    </Trazo>
  )
}

export function IconoPedidos(p: Props) {
  return (
    <Trazo {...p}>
      <path d="M6 3h12v18l-2-1.4-2 1.4-2-1.4-2 1.4-2-1.4L6 21z" />
      <path d="M9.5 8h5M9.5 12h5" />
    </Trazo>
  )
}

export function IconoClientes(p: Props) {
  return (
    <Trazo {...p}>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3 19.5c0-3 2.7-4.8 6-4.8s6 1.8 6 4.8" />
      <path d="M16 5.4a3.2 3.2 0 0 1 0 5.9M17.5 14.9c2.1.5 3.5 2 3.5 4.1" />
    </Trazo>
  )
}

export function IconoAjustes(p: Props) {
  return (
    <Trazo {...p}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2.8v2.4M12 18.8v2.4M4.5 4.5l1.7 1.7M17.8 17.8l1.7 1.7M2.8 12h2.4M18.8 12h2.4M4.5 19.5l1.7-1.7M17.8 6.2l1.7-1.7" />
    </Trazo>
  )
}

export function IconoSalir(p: Props) {
  return (
    <Trazo {...p}>
      <path d="M14 4.5H6.5A1.5 1.5 0 0 0 5 6v12a1.5 1.5 0 0 0 1.5 1.5H14" />
      <path d="M17 8.5 20.5 12 17 15.5M10 12h10.5" />
    </Trazo>
  )
}

export function IconoUsuario(p: Props) {
  return (
    <Trazo {...p}>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="10" r="3" />
      <path d="M6.4 18.6a6.2 6.2 0 0 1 11.2 0" />
    </Trazo>
  )
}

export function IconoLupa(p: Props) {
  return (
    <Trazo {...p}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4.5 4.5" />
    </Trazo>
  )
}

export function IconoTelefono(p: Props) {
  return (
    <Trazo {...p}>
      <path d="M6.2 3.5h3l1.5 4-2 1.4a12 12 0 0 0 6.4 6.4l1.4-2 4 1.5v3a1.7 1.7 0 0 1-1.9 1.7C11.4 19 5 12.6 4.5 5.4A1.7 1.7 0 0 1 6.2 3.5z" />
    </Trazo>
  )
}

export function IconoPin(p: Props) {
  return (
    <Trazo {...p}>
      <path d="M12 21s6.5-6 6.5-11a6.5 6.5 0 1 0-13 0C5.5 15 12 21 12 21z" />
      <circle cx="12" cy="10" r="2.4" />
    </Trazo>
  )
}

export function IconoCorreo(p: Props) {
  return (
    <Trazo {...p}>
      <rect x="3" y="5.5" width="18" height="13" rx="2.2" />
      <path d="m3.8 7 8.2 6 8.2-6" />
    </Trazo>
  )
}

export function IconoCandado(p: Props) {
  return (
    <Trazo {...p}>
      <rect x="4.5" y="10.5" width="15" height="9.5" rx="2.2" />
      <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
      <circle cx="12" cy="15.2" r="1.2" />
    </Trazo>
  )
}

export function IconoBolsa(p: Props) {
  return (
    <Trazo {...p}>
      <path d="M5.5 8h13l-1 12.5h-11z" />
      <path d="M9 8V6.2a3 3 0 0 1 6 0V8" />
    </Trazo>
  )
}

export function IconoCamion(p: Props) {
  return (
    <Trazo {...p}>
      <path d="M2.5 6.5h11v9h-11z" />
      <path d="M13.5 10h3.6l2.4 2.8v2.7h-6z" />
      <circle cx="7" cy="17.5" r="1.6" />
      <circle cx="16.5" cy="17.5" r="1.6" />
    </Trazo>
  )
}

export function IconoTienda(p: Props) {
  return (
    <Trazo {...p}>
      <path d="M4 10v9.5h16V10" />
      <path d="M3 5.5h18l-1 4.5a2.6 2.6 0 0 1-5 0 2.6 2.6 0 0 1-5 0 2.6 2.6 0 0 1-5 0z" />
    </Trazo>
  )
}
