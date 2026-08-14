import { listarProductosActivos } from '@/lib/db/productos'
import { obtenerAjustes } from '@/lib/db/ajustes'
import { FormularioPedido } from './FormularioPedido'

export default async function NuevoPedido() {
  const [productos, ajustes] = await Promise.all([listarProductosActivos(), obtenerAjustes()])
  return <FormularioPedido productos={productos} valorDomicilioDefault={ajustes.valorDomicilioDefault} />
}
