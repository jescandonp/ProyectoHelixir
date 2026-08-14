import { notFound } from 'next/navigation'
import { obtenerPedido } from '@/lib/db/pedidos'
import { obtenerAjustes } from '@/lib/db/ajustes'
import { VistaDocumentos } from './VistaDocumentos'

export default async function Documentos({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [pedido, ajustes] = await Promise.all([obtenerPedido(id), obtenerAjustes()])
  if (!pedido) notFound()
  return <VistaDocumentos pedido={pedido} ajustes={ajustes} />
}
