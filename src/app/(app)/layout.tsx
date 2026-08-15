import { NavegacionPrincipal } from '@/components/NavegacionPrincipal'

export default function LayoutApp({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-100">
      <NavegacionPrincipal />
      {children}
    </div>
  )
}
