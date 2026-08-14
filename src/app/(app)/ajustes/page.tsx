import { obtenerAjustes } from '@/lib/db/ajustes'
import { FormularioAjustes } from './FormularioAjustes'

export default async function PaginaAjustes() {
  const ajustes = await obtenerAjustes()
  return <FormularioAjustes iniciales={ajustes} />
}
