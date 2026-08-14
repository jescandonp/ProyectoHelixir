'use client'

import { useEffect, useState } from 'react'
import { buscarClientes, crearCliente } from '@/lib/db/clientes'
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
      <form onSubmit={guardar} className="space-y-2 rounded-lg border-2 border-emerald-500 bg-emerald-50 p-3">
        <p className="text-xs font-bold tracking-wider text-emerald-700">CLIENTE NUEVO</p>
        <input required autoFocus placeholder="Nombre" value={form.nombre}
          onChange={(e) => setForm({ ...form, nombre: e.target.value })}
          className="w-full rounded border px-2 py-1.5 text-sm" />
        <div className="grid grid-cols-2 gap-2">
          <input placeholder="Teléfono" value={form.telefono}
            onChange={(e) => setForm({ ...form, telefono: e.target.value })}
            className="rounded border px-2 py-1.5 text-sm" />
          <input placeholder="Cédula (opcional)" value={form.cedula}
            onChange={(e) => setForm({ ...form, cedula: e.target.value })}
            className="rounded border px-2 py-1.5 text-sm" />
        </div>
        <input required placeholder="Dirección" value={form.linea}
          onChange={(e) => setForm({ ...form, linea: e.target.value })}
          className="w-full rounded border px-2 py-1.5 text-sm" />
        <div className="grid grid-cols-3 gap-2">
          <input placeholder="Barrio" value={form.barrio}
            onChange={(e) => setForm({ ...form, barrio: e.target.value })}
            className="rounded border px-2 py-1.5 text-sm" />
          <input required placeholder="Ciudad" value={form.ciudad}
            onChange={(e) => setForm({ ...form, ciudad: e.target.value })}
            className="rounded border px-2 py-1.5 text-sm" />
          <input placeholder="Depto." value={form.departamento}
            onChange={(e) => setForm({ ...form, departamento: e.target.value })}
            className="rounded border px-2 py-1.5 text-sm" />
        </div>
        <input placeholder="Indicaciones (portería, timbre…)" value={form.indicaciones}
          onChange={(e) => setForm({ ...form, indicaciones: e.target.value })}
          className="w-full rounded border px-2 py-1.5 text-sm" />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex gap-2">
          <button type="submit" disabled={guardando}
            className="rounded bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50">
            {guardando ? 'Guardando…' : 'Guardar y usar'}
          </button>
          <button type="button" onClick={() => setCreando(false)}
            className="rounded border px-3 py-1.5 text-sm">Cancelar</button>
        </div>
      </form>
    )
  }

  return (
    <div className="relative">
      <input
        autoFocus value={texto} onChange={(e) => setTexto(e.target.value)}
        placeholder="🔍 Buscar cliente por nombre, teléfono o código…"
        className="w-full rounded-lg border-2 border-blue-600 px-3 py-2 text-sm outline-none"
      />
      {texto.trim().length >= 2 && (
        <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border bg-white shadow-lg">
          {resultados.map((cliente) => (
            <button key={cliente.id} type="button"
              onClick={() => { onSeleccionar(cliente); setTexto('') }}
              className="flex w-full items-center justify-between border-b px-3 py-2 text-left hover:bg-blue-50">
              <span>
                <span className="block text-sm font-semibold">{cliente.nombre}</span>
                <span className="block text-xs text-slate-500">
                  {cliente.telefono} · {cliente.direcciones?.[0]?.ciudad}
                </span>
              </span>
              <span className="rounded bg-blue-100 px-1.5 py-0.5 font-mono text-[10px] text-blue-700">
                {cliente.codigo}
              </span>
            </button>
          ))}
          <button type="button" onClick={abrirCreacion}
            className="w-full px-3 py-2 text-left text-sm font-semibold text-emerald-700 hover:bg-emerald-50">
            ＋ Crear cliente nuevo &ldquo;{texto.trim()}&rdquo;
          </button>
        </div>
      )}
    </div>
  )
}
