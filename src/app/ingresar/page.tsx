'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { crearClienteNavegador } from '@/lib/db/cliente-navegador'
import { Logo } from '@/components/Logo'
import { IconoCorreo, IconoCandado, IconoSalir } from '@/components/iconos'

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
    <main className="flex min-h-screen items-center justify-center bg-superficie p-4">
      <form
        onSubmit={enviar}
        className="w-full max-w-md rounded-2xl bg-tarjeta p-8 shadow-nivel1"
      >
        <div className="mb-8 text-center">
          {/* Antes de entrar no hay sesión, así que aquí no se puede leer el
              nombre del negocio de Ajustes: el `alt` describe el logo tal
              como está impreso en la imagen. */}
          <Logo nombre="Hel-ixir Soft" prioritario className="mx-auto mb-5 h-14 w-auto" />
          <h1 className="font-titulo text-titulo-md text-tinta">Bienvenido de nuevo</h1>
          <p className="mt-1 text-cuerpo-md text-tinta-tenue">
            Ingresa tus datos para continuar.
          </p>
        </div>

        {/* `htmlFor`/`id` explícitos: con la etiqueta solo envolviendo al
            input, el nombre accesible lo terminaba ganando el placeholder. */}
        <div className="mb-5">
          <label htmlFor="correo" className="mb-1.5 block text-etiqueta-lg text-tinta">
            Correo electrónico
          </label>
          <div className="relative">
            <IconoCorreo className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-borde" />
            <input
              id="correo" type="email" required value={correo}
              onChange={(e) => setCorreo(e.target.value)}
              placeholder="ejemplo@correo.com"
              className="w-full rounded-md border border-borde-suave bg-tarjeta-baja py-2.5 pl-11 pr-3 text-cuerpo-md text-tinta outline-none transition-colors placeholder:text-borde focus:border-primario"
            />
          </div>
        </div>

        <div className="mb-6">
          <label htmlFor="clave" className="mb-1.5 block text-etiqueta-lg text-tinta">
            Contraseña
          </label>
          <div className="relative">
            <IconoCandado className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-borde" />
            <input
              id="clave" type="password" required value={clave}
              onChange={(e) => setClave(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-md border border-borde-suave bg-tarjeta-baja py-2.5 pl-11 pr-3 text-cuerpo-md text-tinta outline-none transition-colors placeholder:text-borde focus:border-primario"
            />
          </div>
        </div>

        {error && (
          <p className="mb-4 rounded-md bg-error-contenedor px-3 py-2 text-etiqueta-lg text-sobre-error-contenedor">
            {error}
          </p>
        )}

        <button
          type="submit" disabled={cargando}
          className="flex w-full items-center justify-center gap-2 rounded-md bg-primario py-3 text-etiqueta-lg text-sobre-primario transition-colors hover:bg-primario-vivo disabled:opacity-50"
        >
          {cargando ? 'Ingresando…' : 'Iniciar sesión'}
          <IconoSalir className="h-[18px] w-[18px] shrink-0" />
        </button>
      </form>
    </main>
  )
}
