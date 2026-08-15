'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { formatearPesos } from '@/lib/dinero'
import { formatearFechaCo } from '@/lib/fecha'
import {
  actualizarCliente, agregarDireccion, actualizarDireccion, marcarDireccionPrincipal,
  type DatosDireccion,
} from '@/lib/db/clientes'
import type { Cliente, Direccion } from '@/lib/tipos'
import type { FilaPedido } from '@/lib/db/pedidos-consultas'

const DIRECCION_VACIA: DatosDireccion = {
  etiqueta: '', linea: '', barrio: '', ciudad: '', departamento: '', indicaciones: '',
}

function desdeDireccion(d: Direccion): DatosDireccion {
  return {
    etiqueta: d.etiqueta ?? '', linea: d.linea, barrio: d.barrio ?? '',
    ciudad: d.ciudad, departamento: d.departamento ?? '', indicaciones: d.indicaciones ?? '',
  }
}

export function FichaCliente({
  cliente, historial,
}: { cliente: Cliente; historial: { filas: FilaPedido[]; totalComprado: number } }) {
  const router = useRouter()
  const [pendiente, iniciar] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [mensaje, setMensaje] = useState<string | null>(null)

  const [datos, setDatos] = useState({
    nombre: cliente.nombre,
    telefono: cliente.telefono ?? '',
    cedula: cliente.cedula ?? '',
    tipo: cliente.tipo,
    notas: cliente.notas ?? '',
  })
  const [cedulaVisible, setCedulaVisible] = useState(false)
  const [editandoDireccion, setEditandoDireccion] = useState<string | null>(null)
  const [formDireccion, setFormDireccion] = useState<DatosDireccion>(DIRECCION_VACIA)

  // alExito solo corre si la acción terminó bien: así quien cierra un
  // formulario (por ejemplo, el de dirección) lo hace después de confirmar
  // que se guardó, no antes. Si la acción falla, el formulario debe seguir
  // abierto con lo que el usuario escribió, para no perder lo digitado.
  function ejecutar(accion: () => Promise<void>, exito: string, alExito?: () => void) {
    setError(null); setMensaje(null)
    iniciar(async () => {
      try {
        await accion()
        setMensaje(exito)
        alExito?.()
        router.refresh()
      } catch (e) {
        setError(e instanceof Error ? e.message : 'No se pudo guardar')
      }
    })
  }

  // Cambia los datos del cliente y limpia solo el mensaje de éxito. El aviso
  // de éxito deja de ser cierto en cuanto el usuario edita un campo, pero el
  // error debe quedarse visible hasta que inicie una acción nueva (ejecutar
  // se encarga de limpiarlo).
  function cambiarDatos(cambios: Partial<typeof datos>) {
    setDatos((prev) => ({ ...prev, ...cambios }))
    setMensaje(null)
  }

  function enmascarar(cedula: string): string {
    if (!cedula) return '—'
    // No se puede confiar en que la cédula tenga más de 4 caracteres: con
    // slice(0, 4) una cédula de longitud 4 o menos se devuelve completa y
    // no queda ningún caracter para reemplazar por "x". Por eso mostramos
    // como máximo los primeros 4 caracteres, pero nunca más de los que
    // dejen al menos uno enmascarado, para que jamás se vea el valor
    // completo sin haber pulsado "revelar".
    const visibles = Math.min(4, Math.max(0, cedula.length - 1))
    return `${cedula.slice(0, visibles)}${'x'.repeat(cedula.length - visibles)}`
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4">
      <div className="flex items-center gap-2">
        <Link href="/clientes" className="text-sm text-blue-600">← Clientes</Link>
        <span className="rounded bg-blue-100 px-1.5 py-0.5 font-mono text-[10px] text-blue-700">
          {cliente.codigo}
        </span>
      </div>

      <section className="rounded-lg border bg-white p-4">
        <h2 className="mb-3 text-sm font-bold">Datos del cliente</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="block">
            <span className="text-xs text-slate-500">Nombre</span>
            <input value={datos.nombre} onChange={(e) => cambiarDatos({ nombre: e.target.value })}
              className="mt-1 w-full rounded border px-2 py-1.5 text-sm" />
          </label>
          <label className="block">
            <span className="text-xs text-slate-500">Teléfono</span>
            <input value={datos.telefono} onChange={(e) => cambiarDatos({ telefono: e.target.value })}
              className="mt-1 w-full rounded border px-2 py-1.5 text-sm" />
          </label>
          <label className="block">
            <span className="text-xs text-slate-500">
              Cédula
              <button type="button" onClick={() => setCedulaVisible(!cedulaVisible)}
                className="ml-2 text-blue-600">
                {cedulaVisible ? 'ocultar' : 'revelar'}
              </button>
            </span>
            {cedulaVisible ? (
              <input value={datos.cedula} onChange={(e) => cambiarDatos({ cedula: e.target.value })}
                className="mt-1 w-full rounded border px-2 py-1.5 text-sm" />
            ) : (
              <p className="mt-1 rounded border bg-slate-50 px-2 py-1.5 text-sm tabular-nums">
                {enmascarar(datos.cedula)}
              </p>
            )}
          </label>
          <label className="block">
            <span className="text-xs text-slate-500">Tipo</span>
            <select value={datos.tipo}
              onChange={(e) => cambiarDatos({ tipo: e.target.value as Cliente['tipo'] })}
              className="mt-1 w-full rounded border px-2 py-1.5 text-sm">
              <option value="detal">Detal</option>
              <option value="mayorista">Mayorista</option>
            </select>
          </label>
        </div>
        <label className="mt-2 block">
          <span className="text-xs text-slate-500">Notas</span>
          <textarea value={datos.notas} rows={2}
            onChange={(e) => cambiarDatos({ notas: e.target.value })}
            className="mt-1 w-full rounded border px-2 py-1.5 text-sm" />
        </label>
        <button type="button" disabled={pendiente}
          onClick={() => ejecutar(() => actualizarCliente(cliente.id, datos), 'Guardado')}
          className="mt-3 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
          Guardar
        </button>
      </section>

      <section className="rounded-lg border bg-white p-4">
        <h2 className="mb-3 text-sm font-bold">Direcciones</h2>
        {(cliente.direcciones ?? []).map((d) => (
          <div key={d.id} className="mb-2 rounded border p-2 text-sm">
            {editandoDireccion === d.id ? (
              <CamposDireccion
                valores={formDireccion} onCambiar={setFormDireccion}
                onGuardar={() => ejecutar(
                  () => actualizarDireccion(d.id, formDireccion),
                  'Dirección guardada',
                  () => setEditandoDireccion(null),
                )}
                onCancelar={() => setEditandoDireccion(null)}
                pendiente={pendiente}
              />
            ) : (
              <div className="flex items-start justify-between">
                <div>
                  <strong>{d.etiqueta ?? d.linea}</strong>
                  {d.esPrincipal && (
                    <span className="ml-2 rounded bg-emerald-100 px-1.5 text-[10px] text-emerald-700">
                      principal
                    </span>
                  )}
                  <div className="text-slate-600">
                    {d.linea} · {d.barrio} · {d.ciudad}
                  </div>
                  {d.indicaciones && <div className="text-xs italic text-slate-500">{d.indicaciones}</div>}
                </div>
                <div className="flex gap-2 text-xs">
                  <button type="button" className="text-blue-600"
                    onClick={() => { setFormDireccion(desdeDireccion(d)); setEditandoDireccion(d.id) }}>
                    editar
                  </button>
                  {!d.esPrincipal && (
                    <button type="button" className="text-blue-600" disabled={pendiente}
                      onClick={() => ejecutar(
                        () => marcarDireccionPrincipal(cliente.id, d.id), 'Principal cambiada',
                      )}>
                      hacer principal
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}

        {editandoDireccion === 'nueva' ? (
          <div className="rounded border border-emerald-300 bg-emerald-50 p-2">
            <CamposDireccion
              valores={formDireccion} onCambiar={setFormDireccion}
              onGuardar={() => ejecutar(
                () => agregarDireccion(cliente.id, formDireccion),
                'Dirección agregada',
                () => setEditandoDireccion(null),
              )}
              onCancelar={() => setEditandoDireccion(null)}
              pendiente={pendiente}
            />
          </div>
        ) : (
          <button type="button"
            onClick={() => { setFormDireccion(DIRECCION_VACIA); setEditandoDireccion('nueva') }}
            className="rounded border border-dashed px-3 py-1.5 text-xs font-semibold text-emerald-700">
            ＋ Agregar dirección
          </button>
        )}
      </section>

      {error && <p className="rounded bg-red-50 p-2 text-sm text-red-700">{error}</p>}
      {mensaje && <p className="text-sm text-emerald-700">{mensaje}</p>}

      <section className="rounded-lg border bg-white p-4">
        <h2 className="mb-1 text-sm font-bold">Historial</h2>
        <p className="mb-3 text-sm text-slate-600">
          {historial.filas.length} pedido{historial.filas.length === 1 ? '' : 's'} ·
          total comprado <strong>{formatearPesos(historial.totalComprado)}</strong>
        </p>
        {historial.filas.map((p) => (
          <Link key={p.id} href={`/pedidos/${p.id}/documentos`}
            className="flex justify-between border-b py-1.5 text-sm hover:bg-slate-50">
            <span className="font-mono text-xs">{p.consecutivo}</span>
            <span className="text-xs text-slate-500">{formatearFechaCo(p.fecha)}</span>
            <span className="tabular-nums">{formatearPesos(p.total)}</span>
          </Link>
        ))}
      </section>
    </div>
  )
}

function CamposDireccion({
  valores, onCambiar, onGuardar, onCancelar, pendiente,
}: {
  valores: DatosDireccion
  onCambiar: (v: DatosDireccion) => void
  onGuardar: () => void
  onCancelar: () => void
  pendiente: boolean
}) {
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <input placeholder="Etiqueta (casa, oficina…)" value={valores.etiqueta}
          onChange={(e) => onCambiar({ ...valores, etiqueta: e.target.value })}
          className="rounded border px-2 py-1 text-sm" />
        <input placeholder="Dirección" value={valores.linea}
          onChange={(e) => onCambiar({ ...valores, linea: e.target.value })}
          className="rounded border px-2 py-1 text-sm" />
      </div>
      <div className="grid grid-cols-3 gap-2">
        <input placeholder="Barrio" value={valores.barrio}
          onChange={(e) => onCambiar({ ...valores, barrio: e.target.value })}
          className="rounded border px-2 py-1 text-sm" />
        <input placeholder="Ciudad" value={valores.ciudad}
          onChange={(e) => onCambiar({ ...valores, ciudad: e.target.value })}
          className="rounded border px-2 py-1 text-sm" />
        <input placeholder="Depto." value={valores.departamento}
          onChange={(e) => onCambiar({ ...valores, departamento: e.target.value })}
          className="rounded border px-2 py-1 text-sm" />
      </div>
      <input placeholder="Indicaciones" value={valores.indicaciones}
        onChange={(e) => onCambiar({ ...valores, indicaciones: e.target.value })}
        className="w-full rounded border px-2 py-1 text-sm" />
      <div className="flex gap-2">
        <button type="button" onClick={onGuardar} disabled={pendiente}
          className="rounded bg-emerald-600 px-3 py-1 text-sm font-semibold text-white disabled:opacity-50">
          Guardar
        </button>
        <button type="button" onClick={onCancelar} className="rounded border px-3 py-1 text-sm">
          Cancelar
        </button>
      </div>
    </div>
  )
}
