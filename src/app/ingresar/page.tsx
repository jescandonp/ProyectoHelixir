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
    <main className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
      <form
        onSubmit={enviar}
        className="w-full max-w-sm overflow-hidden rounded-xl bg-white shadow-lg"
      >
        {/* Misma identidad del recibo: barra negra, texto invertido, mayúsculas
            firmes y el motivo del frío. Que se sienta del mismo negocio. */}
        <div className="bg-black px-6 py-5 text-center text-white">
          <p className="text-2xl font-black tracking-tight">Helado Artesanal</p>
          <p className="mt-1 text-xs font-bold tracking-[0.2em] text-slate-200">
            ❄ SISTEMA DE PEDIDOS
          </p>
        </div>

        <div className="space-y-4 px-6 py-6">
          <div>
            <label htmlFor="correo" className="mb-1 block text-sm font-bold text-slate-900">
              Correo
            </label>
            <input
              id="correo"
              type="email"
              required
              value={correo}
              onChange={(e) => setCorreo(e.target.value)}
              placeholder="Correo"
              className="w-full rounded-lg border-2 border-slate-300 px-3 py-2 text-slate-900 placeholder:text-slate-400 focus:border-black focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="clave" className="mb-1 block text-sm font-bold text-slate-900">
              Contraseña
            </label>
            <input
              id="clave"
              type="password"
              required
              value={clave}
              onChange={(e) => setClave(e.target.value)}
              placeholder="Contraseña"
              className="w-full rounded-lg border-2 border-slate-300 px-3 py-2 text-slate-900 placeholder:text-slate-400 focus:border-black focus:outline-none"
            />
          </div>

          {error && (
            <p className="rounded-lg border-2 border-red-300 bg-red-50 px-3 py-2 text-sm font-semibold text-red-800">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={cargando}
            aria-busy={cargando}
            className="w-full rounded-lg bg-black py-2.5 font-bold text-white transition disabled:cursor-not-allowed disabled:opacity-50"
          >
            {cargando ? 'Entrando…' : 'Entrar'}
          </button>
        </div>
      </form>
    </main>
  )
}
