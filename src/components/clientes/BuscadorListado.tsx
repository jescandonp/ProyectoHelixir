'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useState } from 'react'
import { CAMPO, BOTON_PRIMARIO } from '@/components/estilos'
import { IconoLupa } from '@/components/iconos'

export function BuscadorListado() {
  const router = useRouter()
  const params = useSearchParams()
  const [texto, setTexto] = useState(params.get('q') ?? '')

  function buscar(e: React.FormEvent) {
    e.preventDefault()
    const nuevos = new URLSearchParams()
    if (texto.trim()) nuevos.set('q', texto.trim())
    router.push(`/clientes?${nuevos.toString()}`)
  }

  return (
    <form onSubmit={buscar} className="mb-6 flex gap-3">
      <div className="relative flex-1">
        <IconoLupa className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-borde" />
        <input
          value={texto} onChange={(e) => setTexto(e.target.value)}
          placeholder="Buscar por nombre, teléfono o código…"
          aria-label="Buscar clientes"
          className={`${CAMPO} pl-11`}
        />
      </div>
      <button type="submit" className={BOTON_PRIMARIO}>
        Buscar
      </button>
    </form>
  )
}
