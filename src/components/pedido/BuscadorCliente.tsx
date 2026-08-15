'use client'

import { useEffect, useState } from 'react'
import { buscarClientes, crearCliente } from '@/lib/db/clientes'
import {
  CAMPO, BOTON_PRIMARIO, BOTON_SECUNDARIO, CHIP_CODIGO, ETIQUETA_SECCION, AVISO_ERROR,
} from '@/components/estilos'
import { IconoLupa } from '@/components/iconos'
import type { Cliente } from '@/lib/tipos'

const FORM_VACIO = {
  nombre: '', telefono: '', cedula: '',
  linea: '', barrio: '', ciudad: '', departamento: '', indicaciones: '',
}

export function BuscadorCliente({ onSeleccionar }: { onSeleccionar: (c: Cliente) => void }) {
  const [texto, setTexto] = useState('')
  const [resultados, setResultados] = useState<Cliente[]>([])
  const [creando, setCreando] = useState(false)
  const [form, setForm] = useState(FORM_VACIO)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (creando) return
    const temporizador = setTimeout(async () => {
      setResultados(texto.trim().length >= 2 ? await buscarClientes(texto) : [])
    }, 200)
    return () => clearTimeout(temporizador)
  }, [texto, creando])

  function abrirCreacion() {
    setForm({ ...FORM_VACIO, nombre: texto.trim() })
    setCreando(true)
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault()
    setGuardando(true)
    setError(null)
    try {
      const cliente = await crearCliente(
        { nombre: form.nombre, telefono: form.telefono, cedula: form.cedula, tipo: 'detal' },
        {
          linea: form.linea, barrio: form.barrio, ciudad: form.ciudad,
          departamento: form.departamento, indicaciones: form.indicaciones,
        },
      )
      setCreando(false)
      setTexto('')
      onSeleccionar(cliente)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo crear el cliente')
    } finally {
      setGuardando(false)
    }
  }

  if (creando) {
    return (
      <form
        onSubmit={guardar}
        className="space-y-3 rounded-xl border-2 border-primario bg-primario-fijo/40 p-4"
      >
        <p className={ETIQUETA_SECCION}>Cliente nuevo</p>
        <input required autoFocus placeholder="Nombre" value={form.nombre}
          onChange={(e) => setForm({ ...form, nombre: e.target.value })}
          className={`${CAMPO} bg-tarjeta`} />
        <div className="grid gap-3 sm:grid-cols-2">
          <input placeholder="Teléfono" value={form.telefono}
            onChange={(e) => setForm({ ...form, telefono: e.target.value })}
            className={`${CAMPO} bg-tarjeta`} />
          <input placeholder="Cédula (opcional)" value={form.cedula}
            onChange={(e) => setForm({ ...form, cedula: e.target.value })}
            className={`${CAMPO} bg-tarjeta`} />
        </div>
        <input required placeholder="Dirección" value={form.linea}
          onChange={(e) => setForm({ ...form, linea: e.target.value })}
          className={`${CAMPO} bg-tarjeta`} />
        <div className="grid gap-3 sm:grid-cols-3">
          <input placeholder="Barrio" value={form.barrio}
            onChange={(e) => setForm({ ...form, barrio: e.target.value })}
            className={`${CAMPO} bg-tarjeta`} />
          <input required placeholder="Ciudad" value={form.ciudad}
            onChange={(e) => setForm({ ...form, ciudad: e.target.value })}
            className={`${CAMPO} bg-tarjeta`} />
          <input placeholder="Depto." value={form.departamento}
            onChange={(e) => setForm({ ...form, departamento: e.target.value })}
            className={`${CAMPO} bg-tarjeta`} />
        </div>
        <input placeholder="Indicaciones (portería, timbre…)" value={form.indicaciones}
          onChange={(e) => setForm({ ...form, indicaciones: e.target.value })}
          className={`${CAMPO} bg-tarjeta`} />
        {error && <p className={AVISO_ERROR}>{error}</p>}
        <div className="flex gap-2">
          <button type="submit" disabled={guardando} className={BOTON_PRIMARIO}>
            {guardando ? 'Guardando…' : 'Guardar y usar'}
          </button>
          <button type="button" onClick={() => setCreando(false)} className={BOTON_SECUNDARIO}>
            Cancelar
          </button>
        </div>
      </form>
    )
  }

  return (
    <div className="relative">
      <IconoLupa className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-borde" />
      <input
        autoFocus value={texto} onChange={(e) => setTexto(e.target.value)}
        placeholder="Buscar cliente por nombre, teléfono o código…"
        className={`${CAMPO} pl-11`}
      />
      {texto.trim().length >= 2 && (
        <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-xl border border-borde-suave bg-tarjeta shadow-nivel2">
          {resultados.map((cliente) => (
            <button key={cliente.id} type="button"
              onClick={() => { onSeleccionar(cliente); setTexto('') }}
              className="flex w-full items-center justify-between gap-3 border-b border-borde-suave/60 px-4 py-3 text-left transition-colors last:border-0 hover:bg-primario-fijo/40">
              <span>
                <span className="block text-cuerpo-md text-tinta">{cliente.nombre}</span>
                <span className="block text-etiqueta-md text-tinta-suave">
                  {cliente.telefono} · {cliente.direcciones?.[0]?.ciudad}
                </span>
              </span>
              <span className={CHIP_CODIGO}>{cliente.codigo}</span>
            </button>
          ))}
          <button type="button" onClick={abrirCreacion}
            className="w-full px-4 py-3 text-left text-etiqueta-lg text-primario transition-colors hover:bg-primario-fijo/40">
            ＋ Crear cliente nuevo &ldquo;{texto.trim()}&rdquo;
          </button>
        </div>
      )}
    </div>
  )
}
