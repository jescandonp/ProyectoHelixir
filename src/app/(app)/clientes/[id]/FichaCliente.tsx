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
import {
  TARJETA, CAMPO, CAMPO_CHICO, CHIP, CHIP_CODIGO, ETIQUETA, ETIQUETA_SECCION,
  BOTON_PRIMARIO, BOTON_SECUNDARIO, BOTON_FANTASMA, AVISO_ERROR, AVISO_EXITO,
} from '@/components/estilos'
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
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6 md:px-10">
      <div className="flex items-center gap-3">
        <Link href="/clientes" className={BOTON_FANTASMA}>← Clientes</Link>
        <span className={CHIP_CODIGO}>{cliente.codigo}</span>
      </div>

      <section className={`${TARJETA} p-6`}>
        <h2 className={`mb-4 ${ETIQUETA_SECCION}`}>Datos del cliente</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className={ETIQUETA}>Nombre</span>
            <input value={datos.nombre} onChange={(e) => cambiarDatos({ nombre: e.target.value })}
              className={CAMPO} />
          </label>
          <label className="block">
            <span className={ETIQUETA}>Teléfono</span>
            <input value={datos.telefono} onChange={(e) => cambiarDatos({ telefono: e.target.value })}
              className={CAMPO} />
          </label>
          <label className="block">
            <span className={ETIQUETA}>
              Cédula
              <button type="button" onClick={() => setCedulaVisible(!cedulaVisible)}
                className={`ml-2 ${BOTON_FANTASMA}`}>
                {cedulaVisible ? 'ocultar' : 'revelar'}
              </button>
            </span>
            {cedulaVisible ? (
              <input value={datos.cedula} onChange={(e) => cambiarDatos({ cedula: e.target.value })}
                className={CAMPO} />
            ) : (
              <p className={`${CAMPO} tabular-nums`}>{enmascarar(datos.cedula)}</p>
            )}
          </label>
          <label className="block">
            <span className={ETIQUETA}>Tipo</span>
            <select value={datos.tipo}
              onChange={(e) => cambiarDatos({ tipo: e.target.value as Cliente['tipo'] })}
              className={CAMPO}>
              <option value="detal">Detal</option>
              <option value="mayorista">Mayorista</option>
            </select>
          </label>
        </div>
        <label className="mt-4 block">
          <span className={ETIQUETA}>Notas</span>
          <textarea value={datos.notas} rows={2}
            onChange={(e) => cambiarDatos({ notas: e.target.value })}
            className={CAMPO} />
        </label>
        <button type="button" disabled={pendiente}
          onClick={() => ejecutar(() => actualizarCliente(cliente.id, datos), 'Guardado')}
          className={`${BOTON_PRIMARIO} mt-4`}>
          Guardar
        </button>
      </section>

      <section className={`${TARJETA} p-6`}>
        <h2 className={`mb-4 ${ETIQUETA_SECCION}`}>Direcciones</h2>
        {(cliente.direcciones ?? []).map((d) => (
          <div key={d.id} className="mb-3 rounded-xl border border-borde-suave p-4">
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
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span className="text-cuerpo-md text-tinta">{d.etiqueta ?? d.linea}</span>
                  {d.esPrincipal && (
                    <span className={`ml-2 ${CHIP} bg-terciario-fijo text-sobre-terciario-fijo`}>
                      principal
                    </span>
                  )}
                  <div className="text-etiqueta-lg font-medium tracking-normal text-tinta-suave">
                    {d.linea} · {d.barrio} · {d.ciudad}
                  </div>
                  {d.indicaciones && (
                    <div className="text-etiqueta-md italic text-tinta-tenue">{d.indicaciones}</div>
                  )}
                </div>
                <div className="flex shrink-0 gap-3">
                  <button type="button" className={BOTON_FANTASMA}
                    onClick={() => { setFormDireccion(desdeDireccion(d)); setEditandoDireccion(d.id) }}>
                    editar
                  </button>
                  {!d.esPrincipal && (
                    <button type="button" className={BOTON_FANTASMA} disabled={pendiente}
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
          <div className="rounded-xl border-2 border-primario bg-primario-fijo/40 p-4">
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
            className="w-full rounded-lg border border-dashed border-borde-suave py-3 text-etiqueta-lg text-primario transition-colors hover:border-primario hover:bg-primario-fijo/40">
            ＋ Agregar dirección
          </button>
        )}
      </section>

      {error && <p className={AVISO_ERROR}>{error}</p>}
      {mensaje && <p className={AVISO_EXITO}>{mensaje}</p>}

      <section className={`${TARJETA} p-6`}>
        <h2 className={`mb-2 ${ETIQUETA_SECCION}`}>Historial</h2>
        <p className="mb-4 text-cuerpo-md text-tinta-tenue">
          {historial.filas.length} pedido{historial.filas.length === 1 ? '' : 's'} ·
          total comprado{' '}
          <strong className="text-tinta">{formatearPesos(historial.totalComprado)}</strong>
        </p>
        {historial.filas.map((p) => (
          <Link key={p.id} href={`/pedidos/${p.id}/documentos`}
            className="flex items-center justify-between gap-3 border-b border-borde-suave/60 py-2.5 transition-colors last:border-0 hover:bg-tarjeta-baja">
            <span className="font-mono text-etiqueta-md text-tinta-suave">{p.consecutivo}</span>
            <span className="text-etiqueta-md text-tinta-tenue">{formatearFechaCo(p.fecha)}</span>
            <span className="tabular-nums text-cuerpo-md text-tinta">{formatearPesos(p.total)}</span>
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
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <input placeholder="Etiqueta (casa, oficina…)" value={valores.etiqueta}
          onChange={(e) => onCambiar({ ...valores, etiqueta: e.target.value })}
          className={`${CAMPO_CHICO} w-full bg-tarjeta`} />
        <input placeholder="Dirección" value={valores.linea}
          onChange={(e) => onCambiar({ ...valores, linea: e.target.value })}
          className={`${CAMPO_CHICO} w-full bg-tarjeta`} />
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <input placeholder="Barrio" value={valores.barrio}
          onChange={(e) => onCambiar({ ...valores, barrio: e.target.value })}
          className={`${CAMPO_CHICO} w-full bg-tarjeta`} />
        <input placeholder="Ciudad" value={valores.ciudad}
          onChange={(e) => onCambiar({ ...valores, ciudad: e.target.value })}
          className={`${CAMPO_CHICO} w-full bg-tarjeta`} />
        <input placeholder="Depto." value={valores.departamento}
          onChange={(e) => onCambiar({ ...valores, departamento: e.target.value })}
          className={`${CAMPO_CHICO} w-full bg-tarjeta`} />
      </div>
      <input placeholder="Indicaciones" value={valores.indicaciones}
        onChange={(e) => onCambiar({ ...valores, indicaciones: e.target.value })}
        className={`${CAMPO_CHICO} w-full bg-tarjeta`} />
      <div className="flex gap-2">
        <button type="button" onClick={onGuardar} disabled={pendiente}
          className={`${BOTON_PRIMARIO} px-3 py-1.5`}>
          Guardar
        </button>
        <button type="button" onClick={onCancelar} className={BOTON_SECUNDARIO}>
          Cancelar
        </button>
      </div>
    </div>
  )
}
