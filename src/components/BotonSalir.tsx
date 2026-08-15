'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { crearClienteNavegador } from '@/lib/db/cliente-navegador'
import { IconoSalir } from '@/components/iconos'

export function BotonSalir() {
  const router = useRouter()
  const [saliendo, setSaliendo] = useState(false)

  async function salir() {
    setSaliendo(true)
    await crearClienteNavegador().auth.signOut()
    router.push('/ingresar')
    // Sin refresh, las pantallas ya renderizadas en el servidor quedan en
    // caché con los datos del usuario que acaba de salir.
    router.refresh()
  }

  return (
    <button
      type="button" onClick={salir} disabled={saliendo}
      className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-etiqueta-lg text-tinta-tenue transition-colors hover:text-primario disabled:opacity-50"
    >
      <IconoSalir className="h-[18px] w-[18px] shrink-0" />
      <span className="hidden sm:inline">{saliendo ? 'Saliendo…' : 'Cerrar sesión'}</span>
    </button>
  )
}
