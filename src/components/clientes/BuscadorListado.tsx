'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useState } from 'react'

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
    <form onSubmit={buscar} className="mb-3 flex gap-2">
      <input
        value={texto} onChange={(e) => setTexto(e.target.value)}
        placeholder="Buscar por nombre, teléfono o código…"
        className="flex-1 rounded-lg border px-3 py-2 text-sm"
      />
      <button type="submit" className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
        Buscar
      </button>
    </form>
  )
}
