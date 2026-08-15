import { NavegacionPrincipal } from '@/components/NavegacionPrincipal'

export default function LayoutApp({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-superficie">
      <NavegacionPrincipal />
      {/* El relleno de abajo deja pasar la barra inferior del celular sin
          taparle la última fila a nadie. En escritorio esa barra no existe. */}
      <div className="pb-24 md:pb-10">{children}</div>
    </div>
  )
}
