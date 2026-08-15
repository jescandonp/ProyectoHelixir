import { notFound } from 'next/navigation'
import { obtenerCliente } from '@/lib/db/clientes'
import { historialDelCliente } from '@/lib/db/pedidos-consultas'
import { FichaCliente } from './FichaCliente'

export default async function PaginaFicha({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const cliente = await obtenerCliente(id)
  if (!cliente) notFound()

  const historial = await historialDelCliente(id)
  return <FichaCliente cliente={cliente} historial={historial} />
}
