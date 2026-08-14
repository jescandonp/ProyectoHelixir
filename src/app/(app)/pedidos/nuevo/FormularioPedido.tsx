'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { BuscadorCliente } from '@/components/pedido/BuscadorCliente'
import { GrillaSabores } from '@/components/pedido/GrillaSabores'
import { ResumenPedido } from '@/components/pedido/ResumenPedido'
import { calcularTotales } from '@/lib/pedidos/calculos'
import { validarParaConfirmar } from '@/lib/pedidos/validacion'
import { crearBorrador, guardarBorrador, confirmarPedido } from '@/lib/db/pedidos'
import type {
  Cliente, Direccion, ItemPedido, Producto, TipoEntrega, EstadoPago,
} from '@/lib/tipos'

interface Props { productos: Producto[]; valorDomicilioDefault: number }

export function FormularioPedido({ productos, valorDomicilioDefault }: Props) {
  const router = useRouter()

  const [cliente, setCliente] = useState<Cliente | null>(null)
  const [direccion, setDireccion] = useState<Direccion | null>(null)
  const [items, setItems] = useState<ItemPedido[]>([])
  const [tipoEntrega, setTipoEntrega] = useState<TipoEntrega>('local')
  const [transportadora, setTransportadora] = useState('')
  const [estadoPago, setEstadoPago] = useState<EstadoPago>('pendiente')
  const [valorDomicilio, setValorDomicilio] = useState(valorDomicilioDefault)
  const [observaciones, setObservaciones] = useState('')
  const [confirmando, setConfirmando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const totales = useMemo(
    () => calcularTotales(items, valorDomicilio, 0),
    [items, valorDomicilio],
  )

  const cantidades = useMemo(
    () => items.reduce<Record<string, number>>((mapa, item) => {
      if (item.productoId) mapa[item.productoId] = item.cantidad
      return mapa
    }, {}),
    [items],
  )

  const problemas = validarParaConfirmar({
    clienteId: cliente?.id ?? null,
    direccionId: direccion?.id ?? null,
    items, tipoEntrega,
    transportadora: transportadora || null,
  })

  function escogerCliente(nuevo: Cliente) {
    setCliente(nuevo)
    setDireccion(nuevo.direcciones?.find((d) => d.esPrincipal) ?? nuevo.direcciones?.[0] ?? null)
  }

  function sumar(producto: Producto) {
    setItems((previos) => {
      const existente = previos.find((i) => i.productoId === producto.id)
      if (existente) {
        return previos.map((i) =>
          i.productoId === producto.id ? { ...i, cantidad: i.cantidad + 1 } : i,
        )
      }
      return [...previos, {
        productoId: producto.id,
        descripcion: producto.nombre,
        cantidad: 1,
        precioUnitario: producto.precio,   // precio congelado
      }]
    })
  }

  function restar(producto: Producto) {
    setItems((previos) =>
      previos
        .map((i) => (i.productoId === producto.id ? { ...i, cantidad: i.cantidad - 1 } : i))
        .filter((i) => i.cantidad > 0),
    )
  }

  function agregarLibre(descripcion: string, precio: number) {
    setItems((previos) => [...previos, {
      productoId: null, descripcion, cantidad: 1, precioUnitario: precio,
    }])
  }

  async function confirmar() {
    setConfirmando(true)
    setError(null)
    try {
      const id = await crearBorrador()
      await guardarBorrador(id, {
        clienteId: cliente!.id,
        direccionId: direccion!.id,
        items, tipoEntrega,
        transportadora: transportadora || null,
        estadoPago, valorDomicilio, descuento: 0, observaciones,
      })
      await confirmarPedido(id)
      router.push(`/pedidos/${id}/documentos`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo confirmar el pedido')
      setConfirmando(false)
    }
  }

  return (
    <div className="mx-auto max-w-6xl p-4">
      <h1 className="mb-3 text-lg font-bold">Nuevo pedido</h1>

      <div className="flex items-start gap-4">
        <div className="flex-[1.55]">
          <p className="mb-1 text-[10px] font-bold tracking-wider text-slate-500">1 · CLIENTE</p>
          {cliente ? (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-2.5 text-sm">
              <div className="flex items-start justify-between">
                <div>
                  <strong>{cliente.nombre}</strong>{' '}
                  <span className="rounded-full bg-emerald-100 px-1.5 text-[10px] text-emerald-700">
                    {cliente.codigo}
                  </span>
                  <div className="text-slate-600">
                    {direccion?.linea} · {direccion?.barrio} · {direccion?.ciudad}
                  </div>
                  <div className="text-slate-600">{cliente.telefono}</div>
                </div>
                <button type="button" onClick={() => { setCliente(null); setDireccion(null) }}
                  className="text-xs text-blue-600">cambiar</button>
              </div>
              {(cliente.direcciones?.length ?? 0) > 1 && (
                <select
                  value={direccion?.id}
                  onChange={(e) =>
                    setDireccion(cliente.direcciones!.find((d) => d.id === e.target.value)!)
                  }
                  className="mt-2 w-full rounded border px-2 py-1 text-xs"
                >
                  {cliente.direcciones!.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.etiqueta ?? d.linea} — {d.ciudad}
                    </option>
                  ))}
                </select>
              )}
            </div>
          ) : (
            <BuscadorCliente onSeleccionar={escogerCliente} />
          )}

          <p className="mb-1 mt-4 text-[10px] font-bold tracking-wider text-slate-500">2 · SABORES</p>
          <GrillaSabores
            productos={productos} cantidades={cantidades}
            onSumar={sumar} onRestar={restar} onItemLibre={agregarLibre}
          />
        </div>

        <div className="flex-1">
          <ResumenPedido
            items={items} totales={totales} valorDomicilio={valorDomicilio}
            tipoEntrega={tipoEntrega} transportadora={transportadora}
            estadoPago={estadoPago} observaciones={observaciones}
            problemas={problemas} confirmando={confirmando}
            onCambiarDomicilio={setValorDomicilio}
            onCambiarEntrega={setTipoEntrega}
            onCambiarTransportadora={setTransportadora}
            onCambiarPago={setEstadoPago}
            onCambiarObservaciones={setObservaciones}
            onConfirmar={confirmar}
          />
          {error && <p className="mt-2 rounded bg-red-50 p-2 text-sm text-red-700">{error}</p>}
        </div>
      </div>
    </div>
  )
}
