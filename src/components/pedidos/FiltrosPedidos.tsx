'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { CAMPO_CHICO, TARJETA } from '@/components/estilos'

const PESTANAS = [
  { clave: 'hoy', texto: 'Hoy' },
  { clave: 'porcobrar', texto: 'Por cobrar' },
  { clave: 'todos', texto: 'Todos' },
]

const ESTADOS = ['confirmado', 'enviado', 'entregado', 'anulado']
const ESTADOS_PAGO = ['pendiente', 'contraentrega', 'pagado']

export function FiltrosPedidos() {
  const router = useRouter()
  const params = useSearchParams()
  const pestanaActual = params.get('pestana') ?? 'hoy'

  // En la pestaña "Por cobrar" la lista ya excluye lo pagado (`soloPorCobrar`
  // en pedidos-consultas.ts); ofrecer "pagado" ahí daría una lista vacía sin
  // explicación, así que se saca del desplegable mientras esa pestaña esté activa.
  const estadosPagoDisponibles = pestanaActual === 'porcobrar'
    ? ESTADOS_PAGO.filter((e) => e !== 'pagado')
    : ESTADOS_PAGO

  function cambiar(clave: string, valor: string) {
    const nuevos = new URLSearchParams(params.toString())
    if (valor) nuevos.set(clave, valor)
    else nuevos.delete(clave)
    nuevos.delete('pagina')   // cambiar de filtro vuelve a la primera página
    router.push(`/pedidos?${nuevos.toString()}`)
  }

  // La pestaña es un atajo para un rango de fechas ("hoy", "todos"...), y en
  // `page.tsx` un rango manual (`desde`/`hasta`) tiene prioridad sobre ella.
  // Si se deja el rango viejo al cambiar de pestaña, el botón resaltado dice
  // una cosa y la lista muestra otra. Por eso solo el clic en una pestaña
  // limpia también el rango manual; escoger fechas a mano sigue intacto.
  function cambiarPestana(clave: string) {
    const nuevos = new URLSearchParams(params.toString())
    nuevos.set('pestana', clave)
    nuevos.delete('pagina')
    nuevos.delete('desde')
    nuevos.delete('hasta')
    router.push(`/pedidos?${nuevos.toString()}`)
  }

  return (
    <div className={`${TARJETA} mb-4 flex flex-wrap items-center gap-3 p-4`}>
      {/* Grupo segmentado: las tres pestañas son una sola pieza, para que se
          lean como tres caras de la misma pregunta y no como tres botones. */}
      <div className="inline-flex rounded-full bg-tarjeta-media p-1">
        {PESTANAS.map(({ clave, texto }) => (
          <button
            key={clave} type="button" onClick={() => cambiarPestana(clave)}
            aria-pressed={pestanaActual === clave}
            className={`rounded-full px-4 py-1.5 text-etiqueta-lg transition-colors ${
              pestanaActual === clave
                ? 'bg-primario text-sobre-primario'
                : 'text-tinta-tenue hover:text-primario'
            }`}
          >
            {texto}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <input
          type="date" value={params.get('desde') ?? ''} aria-label="Desde"
          onChange={(e) => cambiar('desde', e.target.value)}
          className={CAMPO_CHICO}
        />
        <span className="text-etiqueta-md text-tinta-tenue">a</span>
        <input
          type="date" value={params.get('hasta') ?? ''} aria-label="Hasta"
          onChange={(e) => cambiar('hasta', e.target.value)}
          className={CAMPO_CHICO}
        />
      </div>

      <select
        value={params.get('estado') ?? ''} aria-label="Estado del pedido"
        onChange={(e) => cambiar('estado', e.target.value)}
        className={CAMPO_CHICO}
      >
        <option value="">Todos los estados</option>
        {ESTADOS.map((e) => <option key={e} value={e}>{e}</option>)}
      </select>
      <select
        value={params.get('estadoPago') ?? ''} aria-label="Estado de pago"
        onChange={(e) => cambiar('estadoPago', e.target.value)}
        className={CAMPO_CHICO}
      >
        <option value="">Todo el estado de pago</option>
        {estadosPagoDisponibles.map((e) => <option key={e} value={e}>{e}</option>)}
      </select>
    </div>
  )
}

// `clienteId` y `asesorId` son filtros de `listarPedidos` que esta pantalla
// no expone con un control: llegan solo por URL, para que otras pantallas
// (ficha del cliente, panel del asesor) enlacen aquí ya filtrado. No están
// olvidados — no tienen un desplegable a propósito.
