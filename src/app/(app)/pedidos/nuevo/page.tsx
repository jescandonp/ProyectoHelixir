import { listarProductosActivos } from '@/lib/db/productos'
import { listarTransportadorasActivas } from '@/lib/db/transportadoras'
import { obtenerAjustes } from '@/lib/db/ajustes'
import { FormularioPedido } from './FormularioPedido'

export default async function NuevoPedido() {
  const [productos, transportadoras, ajustes] = await Promise.all([
    listarProductosActivos(),
    listarTransportadorasActivas(),
    obtenerAjustes(),
  ])
  return (
    <FormularioPedido
      productos={productos}
      transportadoras={transportadoras}
      valorDomicilioDefault={ajustes.valorDomicilioDefault}
    />
  )
}
