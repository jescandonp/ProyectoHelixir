'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { crearClienteNavegador } from '@/lib/db/cliente-navegador'

export function BotonSalir() {
  const router = useRouter()
  const [saliendo, setSaliendo] = useState(false)

  async function salir() {
    setSaliendo(true)
    const supabase = crearClienteNavegador()
    await supabase.auth.signOut()
    router.push('/ingresar')
    // Sin esto el layout del servidor queda con los datos del usuario
    // anterior en caché, igual que al entrar (ver `ingresar/page.tsx`).
    router.refresh()
  }

  return (
    <button
      type="button"
      onClick={salir}
      disabled={saliendo}
      aria-busy={saliendo}
      className="rounded-md px-2 py-1 text-xs font-medium text-slate-600 underline decoration-slate-400 underline-offset-2 hover:bg-slate-100 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {saliendo ? 'Saliendo…' : 'Cerrar sesión'}
    </button>
  )
}
