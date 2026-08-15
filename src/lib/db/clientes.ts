'use server'

import { crearClienteServidor } from './cliente-supabase'
import type { Cliente, Direccion, TipoCliente } from '@/lib/tipos'
import { CLIENTES_POR_PAGINA } from './paginacion'

const CAMPOS = `
  id, codigo, nombre, telefono, cedula, tipo, notas,
  direcciones ( id, cliente_id, etiqueta, linea, barrio, ciudad,
                departamento, indicaciones, es_principal )
`

// El listado no necesita la cédula: el diseño dice que la cédula completa
// solo se revela en la ficha del cliente. Si el listado pidiera las mismas
// columnas que la ficha, esa regla dependería de que ningún consumidor
// futuro pinte por accidente un campo que sí llegó en la respuesta. Pedir
// menos columnas hace que la regla la imponga el repositorio, no la memoria
// de quien escriba la pantalla.
const CAMPOS_LISTADO = `
  id, codigo, nombre, telefono, tipo, notas,
  direcciones ( id, cliente_id, etiqueta, linea, barrio, ciudad,
                departamento, indicaciones, es_principal )
`

/** Cliente sin cédula: lo que de verdad trae `listarClientes`. */
export type ClienteResumen = Omit<Cliente, 'cedula'>

type FilaDireccion = {
  id: string; cliente_id: string; etiqueta: string | null; linea: string
  barrio: string | null; ciudad: string; departamento: string | null
  indicaciones: string | null; es_principal: boolean
}

function mapearDireccion(f: FilaDireccion): Direccion {
  return {
    id: f.id, clienteId: f.cliente_id, etiqueta: f.etiqueta, linea: f.linea,
    barrio: f.barrio, ciudad: f.ciudad, departamento: f.departamento,
    indicaciones: f.indicaciones, esPrincipal: f.es_principal,
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapearCliente(f: any): Cliente {
  return {
    id: f.id, codigo: f.codigo, nombre: f.nombre, telefono: f.telefono,
    cedula: f.cedula, tipo: f.tipo, notas: f.notas,
    direcciones: (f.direcciones ?? []).map(mapearDireccion),
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapearClienteResumen(f: any): ClienteResumen {
  return {
    id: f.id, codigo: f.codigo, nombre: f.nombre, telefono: f.telefono,
    tipo: f.tipo, notas: f.notas,
    direcciones: (f.direcciones ?? []).map(mapearDireccion),
  }
}

// El texto del usuario se interpola dentro del filtro `.or(...)` de
// PostgREST, cuya sintaxis usa la coma para separar condiciones y los
// paréntesis para agrupar. Si no se limpia, una coma agrega una condición
// OR que el usuario no escribió, y un paréntesis sin cerrar rompe el
// parseo del lado del servidor y tumba toda la consulta con un error. En
// vez de intentar escapar cada caso, simplemente quitamos esos caracteres
// (y las comillas y los comodines de SQL, que el usuario no debería poder
// inyectar a mano): el texto que queda sigue sirviendo para una búsqueda
// por coincidencia parcial, solo que ya no puede alterar la forma del
// filtro.
function limpiarTerminoBusqueda(texto: string): string {
  return texto.replace(/[,()"'%_]/g, '').trim()
}

export async function buscarClientes(texto: string): Promise<Cliente[]> {
  const termino = limpiarTerminoBusqueda(texto)
  if (termino.length < 2) return []

  const supabase = await crearClienteServidor()
  const { data, error } = await supabase
    .from('clientes')
    .select(CAMPOS)
    .or(`nombre.ilike.%${termino}%,telefono.ilike.%${termino}%,codigo.ilike.%${termino}%`)
    .limit(8)

  if (error) throw new Error(`No se pudo buscar el cliente: ${error.message}`)
  return (data ?? []).map(mapearCliente)
}

export async function obtenerCliente(id: string): Promise<Cliente | null> {
  const supabase = await crearClienteServidor()
  const { data } = await supabase.from('clientes').select(CAMPOS).eq('id', id).single()
  return data ? mapearCliente(data) : null
}

export async function crearCliente(
  datos: { nombre: string; telefono: string; cedula: string; tipo: TipoCliente },
  direccion: {
    linea: string; barrio: string; ciudad: string
    departamento: string; indicaciones: string
  },
): Promise<Cliente> {
  const supabase = await crearClienteServidor()

  const { data: cliente, error } = await supabase
    .from('clientes')
    .insert({
      nombre: datos.nombre.trim(),
      telefono: datos.telefono.trim() || null,
      cedula: datos.cedula.trim() || null,
      tipo: datos.tipo,
    })
    .select('id')
    .single()

  if (error) throw new Error(`No se pudo crear el cliente: ${error.message}`)

  const { error: errorDir } = await supabase.from('direcciones').insert({
    cliente_id: cliente.id,
    linea: direccion.linea.trim(),
    barrio: direccion.barrio.trim() || null,
    ciudad: direccion.ciudad.trim(),
    departamento: direccion.departamento.trim() || null,
    indicaciones: direccion.indicaciones.trim() || null,
    es_principal: true,
  })

  if (errorDir) throw new Error(`No se pudo guardar la dirección: ${errorDir.message}`)

  const completo = await obtenerCliente(cliente.id)
  if (!completo) throw new Error('El cliente se creó pero no se pudo leer')
  return completo
}

export interface DatosDireccion {
  etiqueta: string
  linea: string
  barrio: string
  ciudad: string
  departamento: string
  indicaciones: string
}

/** El buscador del pedido no sirve aquí: devuelve máximo 8 y exige dos
 *  letras, porque está hecho para autocompletar mientras se digita. */
export async function listarClientes(
  texto: string,
  pagina = 0,
): Promise<{ filas: ClienteResumen[]; total: number }> {
  const supabase = await crearClienteServidor()
  // Si el término queda vacío después de limpiarlo (por ejemplo, el usuario
  // solo escribió "(" o ","), lo tratamos como si no hubiera término: se
  // lista sin filtrar en vez de mandar un filtro vacío o inválido.
  const termino = limpiarTerminoBusqueda(texto)
  const primera = pagina * CLIENTES_POR_PAGINA

  let consulta = supabase
    .from('clientes')
    .select(CAMPOS_LISTADO, { count: 'exact' })
    .order('nombre')
    .range(primera, primera + CLIENTES_POR_PAGINA - 1)

  if (termino) {
    consulta = consulta.or(
      `nombre.ilike.%${termino}%,telefono.ilike.%${termino}%,codigo.ilike.%${termino}%`,
    )
  }

  const { data, error, count } = await consulta
  if (error) throw new Error(`No se pudo leer la lista de clientes: ${error.message}`)

  return { filas: (data ?? []).map(mapearClienteResumen), total: count ?? 0 }
}

/** Cambia la ficha, nunca los pedidos: esos guardan su copia congelada. */
export async function actualizarCliente(
  id: string,
  datos: { nombre: string; telefono: string; cedula: string; tipo: TipoCliente; notas: string },
): Promise<void> {
  const supabase = await crearClienteServidor()
  if (!datos.nombre.trim()) throw new Error('El cliente necesita un nombre')

  const { error } = await supabase
    .from('clientes')
    .update({
      nombre: datos.nombre.trim(),
      telefono: datos.telefono.trim() || null,
      cedula: datos.cedula.trim() || null,
      tipo: datos.tipo,
      notas: datos.notas.trim() || null,
    })
    .eq('id', id)

  if (error) throw new Error(`No se pudo guardar el cliente: ${error.message}`)
}

function filaDireccion(dir: DatosDireccion) {
  if (!dir.linea.trim()) throw new Error('La dirección necesita una línea')
  if (!dir.ciudad.trim()) throw new Error('La dirección necesita una ciudad')
  return {
    etiqueta: dir.etiqueta.trim() || null,
    linea: dir.linea.trim(),
    barrio: dir.barrio.trim() || null,
    ciudad: dir.ciudad.trim(),
    departamento: dir.departamento.trim() || null,
    indicaciones: dir.indicaciones.trim() || null,
  }
}

export async function agregarDireccion(
  clienteId: string,
  dir: DatosDireccion,
): Promise<void> {
  const supabase = await crearClienteServidor()
  const { error } = await supabase
    .from('direcciones')
    .insert({ cliente_id: clienteId, ...filaDireccion(dir), es_principal: false })
  if (error) throw new Error(`No se pudo agregar la dirección: ${error.message}`)
}

export async function actualizarDireccion(id: string, dir: DatosDireccion): Promise<void> {
  const supabase = await crearClienteServidor()
  const { error } = await supabase.from('direcciones').update(filaDireccion(dir)).eq('id', id)
  if (error) throw new Error(`No se pudo guardar la dirección: ${error.message}`)
}

export async function marcarDireccionPrincipal(
  clienteId: string,
  direccionId: string,
): Promise<void> {
  const supabase = await crearClienteServidor()

  // Confirmamos que la dirección sea de este cliente antes de escribir nada.
  // Sin esto, un `direccionId` equivocado (de otro cliente) marcaría como
  // principal una dirección ajena, o el paso de limpieza de más abajo
  // desprincipalizaría direcciones de un cliente distinto al que se le pasó.
  const { data: direccion, error: errorLectura } = await supabase
    .from('direcciones')
    .select('id, cliente_id')
    .eq('id', direccionId)
    .maybeSingle()

  if (errorLectura) throw new Error(`No se pudo verificar la dirección: ${errorLectura.message}`)
  if (!direccion) throw new Error('La dirección no existe')
  if (direccion.cliente_id !== clienteId) {
    throw new Error('La dirección no pertenece a este cliente')
  }

  // Se marca primero la elegida como principal, y solo después se limpian
  // las demás (excluyéndola con `.neq`, porque si no el paso de limpieza la
  // volvería a poner en `false`). El orden importa: si algo falla entre los
  // dos pasos —la conexión se cae, la segunda escritura falla—, el cliente
  // queda con DOS direcciones principales en vez de CERO. Con dos, la
  // pantalla de tomar pedido se recupera sola porque toma la primera
  // principal que encuentra; con cero, ese cliente pierde el valor por
  // defecto en silencio y nadie se entera hasta que alguien lo note.
  const { error: errorMarcar } = await supabase
    .from('direcciones').update({ es_principal: true }).eq('id', direccionId)
  if (errorMarcar) throw new Error(`No se pudo cambiar la principal: ${errorMarcar.message}`)

  const { error: errorLimpiar } = await supabase
    .from('direcciones')
    .update({ es_principal: false })
    .eq('cliente_id', clienteId)
    .neq('id', direccionId)
  if (errorLimpiar) throw new Error(`No se pudo cambiar la principal: ${errorLimpiar.message}`)
}
