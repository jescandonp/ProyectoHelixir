'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  guardarBorradorLocal, leerBorradorLocal, limpiarBorradorLocal,
} from '@/lib/pedidos/borrador-local'
import { BuscadorCliente } from '@/components/pedido/BuscadorCliente'
import { GrillaSabores } from '@/components/pedido/GrillaSabores'
import { ResumenPedido } from '@/components/pedido/ResumenPedido'
import { calcularTotales } from '@/lib/pedidos/calculos'
import { validarParaConfirmar } from '@/lib/pedidos/validacion'
import { crearBorrador, guardarBorrador, confirmarPedido } from '@/lib/db/pedidos'
import { listarPedidosDeHoyDelCliente } from '@/lib/db/pedidos-consultas'
import { buscarDuplicado, type PedidoReciente } from '@/lib/pedidos/duplicados'
import {
  TARJETA, ETIQUETA_SECCION, CAMPO_CHICO, CHIP_CODIGO, BOTON_FANTASMA,
  AVISO_ERROR, AVISO_ATENCION,
} from '@/components/estilos'
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

  // Se guarda de qué cliente son los pedidos: si se cambia de cliente, la
  // respuesta anterior no puede quedar avisando de un duplicado ajeno.
  const [recientes, setRecientes] = useState<
    { clienteId: string; pedidos: PedidoReciente[] } | null
  >(null)

  useEffect(() => {
    if (!cliente) return
    const clienteId = cliente.id
    let vigente = true
    listarPedidosDeHoyDelCliente(clienteId).then((pedidos) => {
      if (vigente) setRecientes({ clienteId, pedidos })
    })
    return () => { vigente = false }
  }, [cliente])

  const duplicado = cliente && recientes?.clienteId === cliente.id
    ? buscarDuplicado(recientes.pedidos, totales.total)
    : null

  // Restaurar al entrar. El estado guardado solo existe en el navegador, así
  // que no puede leerse durante el render: el servidor pintaría una pantalla
  // vacía y el cliente otra distinta, y la hidratación fallaría.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const guardado = leerBorradorLocal()
    if (!guardado) return
    setCliente(guardado.cliente)
    setDireccion(guardado.direccion)
    setItems(guardado.items)
    setTipoEntrega(guardado.tipoEntrega)
    setTransportadora(guardado.transportadora)
    setEstadoPago(guardado.estadoPago)
    setValorDomicilio(guardado.valorDomicilio)
    setObservaciones(guardado.observaciones)
  }, [])
  /* eslint-enable react-hooks/set-state-in-effect */

  // Guardar en cada cambio, sin ir a la red
  useEffect(() => {
    if (!cliente && items.length === 0) return
    guardarBorradorLocal({
      cliente, direccion, items, tipoEntrega, transportadora,
      estadoPago, valorDomicilio, observaciones,
      guardadoEn: new Date().toISOString(),
    })
  }, [cliente, direccion, items, tipoEntrega, transportadora,
      estadoPago, valorDomicilio, observaciones])

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
      limpiarBorradorLocal()
      router.push(`/pedidos/${id}/documentos`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo confirmar el pedido')
      setConfirmando(false)
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 md:px-10">
      <h1 className="mb-6 font-titulo text-titulo-lg-mobile text-tinta md:text-titulo-lg">
        Nuevo pedido
      </h1>

      {/* En el celular es una sola columna y el resumen queda de último, que
          es el orden en que se toma el pedido: primero quién, luego qué, y
          al final cuánto. En escritorio el resumen se queda a la vista. */}
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <div className="space-y-6 lg:flex-[1.55]">
          <section className={`${TARJETA} p-4`}>
            <p className={`mb-3 ${ETIQUETA_SECCION}`}>1 · Cliente</p>
            {cliente ? (
              <div className="rounded-xl border border-borde-suave bg-tarjeta-baja p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="text-cuerpo-md text-tinta">{cliente.nombre}</span>{' '}
                    <span className={CHIP_CODIGO}>{cliente.codigo}</span>
                    <div className="mt-1 text-etiqueta-lg font-medium tracking-normal text-tinta-suave">
                      {direccion?.linea} · {direccion?.barrio} · {direccion?.ciudad}
                    </div>
                    <div className="text-etiqueta-lg font-medium tracking-normal text-tinta-suave">
                      {cliente.telefono}
                    </div>
                  </div>
                  <button type="button" onClick={() => { setCliente(null); setDireccion(null) }}
                    className={BOTON_FANTASMA}>
                    cambiar
                  </button>
                </div>
                {(cliente.direcciones?.length ?? 0) > 1 && (
                  <select
                    value={direccion?.id} aria-label="Dirección de entrega"
                    onChange={(e) =>
                      setDireccion(cliente.direcciones!.find((d) => d.id === e.target.value)!)
                    }
                    className={`${CAMPO_CHICO} mt-3 w-full bg-tarjeta`}
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
          </section>

          <section className={`${TARJETA} p-4`}>
            <p className={`mb-3 ${ETIQUETA_SECCION}`}>2 · Sabores</p>
            <GrillaSabores
              productos={productos} cantidades={cantidades}
              onSumar={sumar} onRestar={restar} onItemLibre={agregarLibre}
            />
          </section>
        </div>

        <div className="lg:flex-1">
          <div className="lg:sticky lg:top-24">
            {duplicado && (
              <div className={`${AVISO_ATENCION} mb-3`}>
                Ojo: este cliente ya tiene hoy el pedido <strong>{duplicado.consecutivo}</strong> por
                el mismo valor. Si son dos pedidos distintos, sigue sin problema.
              </div>
            )}
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
            {error && <p className={`${AVISO_ERROR} mt-3`}>{error}</p>}
          </div>
        </div>
      </div>
    </div>
  )
}
