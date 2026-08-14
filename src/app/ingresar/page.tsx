'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { crearClienteNavegador } from '@/lib/db/cliente-navegador'

export default function Ingresar() {
  const router = useRouter()
  const [correo, setCorreo] = useState('')
  const [clave, setClave] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(false)

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    setCargando(true)
    setError(null)
    const supabase = crearClienteNavegador()
    const { error } = await supabase.auth.signInWithPassword({ email: correo, password: clave })
    setCargando(false)
    if (error) {
      setError('Correo o contraseña incorrectos')
      return
    }
    router.push('/pedidos/nuevo')
    router.refresh()
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <form onSubmit={enviar} className="w-full max-w-sm space-y-4 rounded-xl bg-white p-6 shadow">
        <h1 className="text-xl font-bold">Ingresar</h1>
        <input
          type="email" required value={correo} onChange={(e) => setCorreo(e.target.value)}
          placeholder="Correo" className="w-full rounded-lg border px-3 py-2"
        />
        <input
          type="password" required value={clave} onChange={(e) => setClave(e.target.value)}
          placeholder="Contraseña" className="w-full rounded-lg border px-3 py-2"
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit" disabled={cargando}
          className="w-full rounded-lg bg-slate-900 py-2 font-semibold text-white disabled:opacity-50"
        >
          {cargando ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
    </main>
  )
}
