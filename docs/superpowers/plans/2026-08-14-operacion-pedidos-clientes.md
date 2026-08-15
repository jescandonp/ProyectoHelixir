# Plan de implementación — Operación: lista de pedidos y clientes

> **Para agentes ejecutores:** SUB-SKILL REQUERIDA: usar `superpowers:subagent-driven-development` (recomendada) o `superpowers:executing-plans` para implementar tarea por tarea. Los pasos usan casillas (`- [ ]`) para seguimiento.

**Objetivo:** que un pedido confirmado se pueda encontrar, cobrar, despachar, reimprimir y anular sin entrar a la base de datos, y que la ficha de un cliente se pueda corregir.

**Arquitectura:** dos módulos puros nuevos —`periodo` traduce "hoy" a instantes en hora de Bogotá, `acciones` decide qué se puede hacer con un pedido— y el repositorio de pedidos se parte en dos: el que escribe y el que solo lee. Las pantallas son Server Components que leen el estado de la URL; solo las filas y los filtros son cliente.

**Stack:** Next.js (App Router) · TypeScript · Tailwind · Supabase (Postgres) · Vitest · Playwright

**Documento de diseño:** [`docs/superpowers/specs/2026-08-14-operacion-pedidos-clientes-design.md`](../specs/2026-08-14-operacion-pedidos-clientes-design.md)

## Global Constraints

Aplican a **todas** las tareas:

- **Moneda:** pesos colombianos, enteros. Formato `$ 240.000` vía `formatearPesos`.
- **Fechas en pantalla:** siempre por `formatearFechaCo` de `@/lib/fecha`. Nunca `toLocaleString` — lee la zona del servidor y en Vercel es UTC.
- **"Hoy" es hoy en Bogotá.** Todo rango de fechas sale de `@/lib/periodo`.
- **Nada se borra.** Los pedidos se anulan con motivo; los clientes no se borran.
- **El listado solo muestra pedidos con consecutivo.** Los borradores huérfanos no aparecen ni cuentan.
- **"Por cobrar" = `estado_pago != 'pagado'` Y `estado != 'anulado'`**, contraentrega incluida.
- **Editar un cliente nunca altera pedidos confirmados**: esos guardan su copia congelada.
- **La cédula completa solo se revela en `/clientes/[id]`.**
- **Idioma:** identificadores y mensajes en español.
- **Las pruebas se corren con `npm run test`.** Si el worker se cuelga sin correr nada, usar `npx vitest run --pool=forks` (ver el handoff del Plan 1).

## Estructura de archivos

| Archivo | Responsabilidad |
|---|---|
| `src/lib/periodo.ts` | "Hoy", "este mes" o un rango → instantes ISO en hora de Bogotá |
| `src/lib/pedidos/acciones.ts` | Qué se puede hacer con un pedido según su estado |
| `src/components/NavegacionPrincipal.tsx` | Barra superior, común a todas las pantallas |
| `src/lib/db/paginacion.ts` | Tamaños de página. Va aparte porque un archivo `'use server'` solo puede exportar funciones asíncronas |
| `src/lib/db/pedidos-consultas.ts` | **Solo lee:** listado, por cobrar, historial |
| `src/lib/db/pedidos.ts` | **Escribe:** se le agregan `marcarPagado`, `marcarEnviado`, `marcarEntregado` |
| `src/lib/db/clientes.ts` | Se le agregan listado, edición y direcciones |
| `src/app/(app)/pedidos/page.tsx` | Listado de pedidos |
| `src/components/pedidos/FilaPedido.tsx` | Una fila con sus acciones |
| `src/components/pedidos/FiltrosPedidos.tsx` | Pestañas y filtros, sobre la URL |
| `src/app/(app)/clientes/page.tsx` | Listado de clientes |
| `src/app/(app)/clientes/[id]/page.tsx` | Ficha del cliente |
| `src/app/(app)/clientes/[id]/FichaCliente.tsx` | Edición de datos y direcciones |

---

## Tarea 1: Módulo de periodo

Va primero porque todo el listado depende de él y es lógica pura, sin base ni React.

**Archivos:**
- Crear: `src/lib/periodo.ts`
- Crear test: `src/lib/periodo.test.ts`

**Interfaces:**
- Consume: nada
- Produce:
  - `interface Rango { desde: string; hasta: string }` — instantes ISO; `desde` inclusive, `hasta` exclusivo
  - `diaEnBogota(instante: Date): string` — `"2026-08-14"`
  - `rangoDelDia(ahora?: Date): Rango`
  - `rangoDelMes(ahora?: Date): Rango`
  - `rangoEntre(desdeDia: string, hastaDia: string): Rango` — ambos días inclusive

- [ ] **Paso 1: Escribir las pruebas**

Crear `src/lib/periodo.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { diaEnBogota, rangoDelDia, rangoDelMes, rangoEntre } from './periodo'

describe('diaEnBogota', () => {
  it('a las 7 p.m. de Colombia todavía es el mismo día, aunque en UTC ya sea el siguiente', () => {
    // 00:30 UTC del 15 son las 19:30 del 14 en Bogotá
    expect(diaEnBogota(new Date('2026-08-15T00:30:00Z'))).toBe('2026-08-14')
  })

  it('a las 6 a.m. de Colombia el día ya cambió', () => {
    expect(diaEnBogota(new Date('2026-08-15T11:00:00Z'))).toBe('2026-08-15')
  })
})

describe('rangoDelDia', () => {
  it('va de medianoche a medianoche en hora de Bogotá', () => {
    const rango = rangoDelDia(new Date('2026-08-14T18:00:00Z'))
    expect(rango.desde).toBe('2026-08-14T05:00:00.000Z')
    expect(rango.hasta).toBe('2026-08-15T05:00:00.000Z')
  })

  it('un pedido de las 8 p.m. cae en el día correcto y no en el siguiente', () => {
    // Este es el error que se evita: con la zona del servidor en UTC,
    // ese pedido saldría en el listado de mañana.
    const instante = new Date('2026-08-15T01:00:00Z')   // 20:00 del 14 en Bogotá
    const rango = rangoDelDia(instante)
    expect(instante.toISOString() >= rango.desde).toBe(true)
    expect(instante.toISOString() < rango.hasta).toBe(true)
  })
})

describe('rangoDelMes', () => {
  it('cubre el mes completo', () => {
    const rango = rangoDelMes(new Date('2026-08-14T18:00:00Z'))
    expect(rango.desde).toBe('2026-08-01T05:00:00.000Z')
    expect(rango.hasta).toBe('2026-09-01T05:00:00.000Z')
  })

  it('el último día del mes sigue contando en ese mes', () => {
    // 2026-08-31 a las 23:00 de Bogotá = 2026-09-01T04:00Z
    const rango = rangoDelMes(new Date('2026-09-01T04:00:00Z'))
    expect(rango.desde).toBe('2026-08-01T05:00:00.000Z')
    expect(rango.hasta).toBe('2026-09-01T05:00:00.000Z')
  })

  it('en diciembre el mes siguiente es enero del año entrante', () => {
    const rango = rangoDelMes(new Date('2026-12-15T18:00:00Z'))
    expect(rango.desde).toBe('2026-12-01T05:00:00.000Z')
    expect(rango.hasta).toBe('2027-01-01T05:00:00.000Z')
  })
})

describe('rangoEntre', () => {
  it('incluye los dos días escogidos', () => {
    const rango = rangoEntre('2026-08-01', '2026-08-15')
    expect(rango.desde).toBe('2026-08-01T05:00:00.000Z')
    // el 15 completo cuenta: el corte es la medianoche del 16
    expect(rango.hasta).toBe('2026-08-16T05:00:00.000Z')
  })

  it('un solo día es un rango de 24 horas', () => {
    const rango = rangoEntre('2026-08-14', '2026-08-14')
    expect(rango.desde).toBe('2026-08-14T05:00:00.000Z')
    expect(rango.hasta).toBe('2026-08-15T05:00:00.000Z')
  })
})
```

- [ ] **Paso 2: Correr para verificar que falla**

Ejecutar: `npm run test -- periodo`
Esperado: FAIL — no se encuentra el módulo `./periodo`.

- [ ] **Paso 3: Implementar**

Crear `src/lib/periodo.ts`:

```ts
/** Colombia no tiene horario de verano desde 1993, así que el desfase es
 *  fijo. Escribirlo a mano hace el cálculo determinista y probable, sin
 *  depender de la zona en que corra el servidor. */
const DESFASE = '-05:00'

const PARTES_BOGOTA = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Bogota',
  year: 'numeric', month: '2-digit', day: '2-digit',
})

export interface Rango {
  /** Instante ISO inclusive. */
  desde: string
  /** Instante ISO exclusivo. */
  hasta: string
}

/** Fecha civil en Bogotá para un instante dado: "2026-08-14". */
export function diaEnBogota(instante: Date): string {
  const partes = Object.fromEntries(
    PARTES_BOGOTA.formatToParts(instante).map((p) => [p.type, p.value]),
  ) as Record<string, string>
  return `${partes.year}-${partes.month}-${partes.day}`
}

/** Medianoche de ese día en Bogotá, como instante ISO. */
function medianoche(dia: string): string {
  return new Date(`${dia}T00:00:00${DESFASE}`).toISOString()
}

function sumarDias(dia: string, cuantos: number): string {
  const [anio, mes, numero] = dia.split('-').map(Number)
  return new Date(Date.UTC(anio, mes - 1, numero + cuantos)).toISOString().slice(0, 10)
}

export function rangoDelDia(ahora: Date = new Date()): Rango {
  const dia = diaEnBogota(ahora)
  return { desde: medianoche(dia), hasta: medianoche(sumarDias(dia, 1)) }
}

export function rangoDelMes(ahora: Date = new Date()): Rango {
  const [anio, mes] = diaEnBogota(ahora).split('-').map(Number)
  const primero = `${anio}-${String(mes).padStart(2, '0')}-01`
  const siguiente = mes === 12
    ? `${anio + 1}-01-01`
    : `${anio}-${String(mes + 1).padStart(2, '0')}-01`
  return { desde: medianoche(primero), hasta: medianoche(siguiente) }
}

/** Los dos días son inclusive: "del 1 al 15" incluye el 15 completo. */
export function rangoEntre(desdeDia: string, hastaDia: string): Rango {
  return { desde: medianoche(desdeDia), hasta: medianoche(sumarDias(hastaDia, 1)) }
}
```

- [ ] **Paso 4: Correr las pruebas**

Ejecutar: `npm run test -- periodo`
Esperado: PASS, 9 pruebas.

- [ ] **Paso 5: Commit**

```bash
git add src/lib/periodo.ts src/lib/periodo.test.ts
git commit -m "feat: rangos de fecha calculados en hora de Bogotá"
```

---

## Tarea 2: Módulo de acciones del pedido

**Archivos:**
- Crear: `src/lib/pedidos/acciones.ts`
- Crear test: `src/lib/pedidos/acciones.test.ts`

**Interfaces:**
- Consume: `puedeTransicionar` de `@/lib/pedidos/estados`; `EstadoPedido`, `EstadoPago` de `@/lib/tipos`
- Produce:
  - `interface AccionesPedido { puedeCobrar: boolean; puedeEnviar: boolean; puedeEntregar: boolean; puedeAnular: boolean; puedeVerDocumentos: boolean }`
  - `accionesDisponibles(estado: EstadoPedido, estadoPago: EstadoPago): AccionesPedido`

- [ ] **Paso 1: Escribir las pruebas**

Crear `src/lib/pedidos/acciones.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { accionesDisponibles } from './acciones'

describe('accionesDisponibles', () => {
  it('un pedido recién confirmado se puede cobrar, despachar y anular', () => {
    const a = accionesDisponibles('confirmado', 'pendiente')
    expect(a.puedeCobrar).toBe(true)
    expect(a.puedeEnviar).toBe(true)
    expect(a.puedeAnular).toBe(true)
    expect(a.puedeVerDocumentos).toBe(true)
  })

  it('no se puede entregar algo que no se ha enviado', () => {
    expect(accionesDisponibles('confirmado', 'pendiente').puedeEntregar).toBe(false)
  })

  it('un pedido enviado se puede entregar', () => {
    expect(accionesDisponibles('enviado', 'contraentrega').puedeEntregar).toBe(true)
  })

  it('un pedido ya pagado no se vuelve a cobrar', () => {
    expect(accionesDisponibles('entregado', 'pagado').puedeCobrar).toBe(false)
  })

  it('una contraentrega entregada todavía se puede cobrar', () => {
    // El mensajero volvió con la plata: el pedido ya se entregó pero
    // el cobro se registra después.
    expect(accionesDisponibles('entregado', 'contraentrega').puedeCobrar).toBe(true)
  })

  it('un pedido entregado ya no se anula', () => {
    expect(accionesDisponibles('entregado', 'pagado').puedeAnular).toBe(false)
  })

  it('un pedido anulado solo deja ver sus documentos', () => {
    const a = accionesDisponibles('anulado', 'pendiente')
    expect(a.puedeCobrar).toBe(false)
    expect(a.puedeEnviar).toBe(false)
    expect(a.puedeEntregar).toBe(false)
    expect(a.puedeAnular).toBe(false)
    expect(a.puedeVerDocumentos).toBe(true)
  })

  it('un borrador no tiene documentos que mostrar', () => {
    expect(accionesDisponibles('borrador', 'pendiente').puedeVerDocumentos).toBe(false)
  })
})
```

- [ ] **Paso 2: Correr para verificar que falla**

Ejecutar: `npm run test -- acciones`
Esperado: FAIL — no se encuentra el módulo.

- [ ] **Paso 3: Implementar**

Crear `src/lib/pedidos/acciones.ts`:

```ts
import type { EstadoPedido, EstadoPago } from '@/lib/tipos'
import { puedeTransicionar } from './estados'

export interface AccionesPedido {
  puedeCobrar: boolean
  puedeEnviar: boolean
  puedeEntregar: boolean
  puedeAnular: boolean
  puedeVerDocumentos: boolean
}

/** La fila del listado no decide nada: pinta lo que este módulo autoriza. */
export function accionesDisponibles(
  estado: EstadoPedido,
  estadoPago: EstadoPago,
): AccionesPedido {
  return {
    // Una contraentrega entregada sigue siendo cobrable: el registro del
    // pago llega cuando el mensajero vuelve.
    puedeCobrar: estado !== 'anulado' && estadoPago !== 'pagado',
    puedeEnviar: puedeTransicionar(estado, 'enviado'),
    puedeEntregar: puedeTransicionar(estado, 'entregado'),
    puedeAnular: puedeTransicionar(estado, 'anulado'),
    puedeVerDocumentos: estado !== 'borrador',
  }
}
```

- [ ] **Paso 4: Correr las pruebas**

Ejecutar: `npm run test -- acciones`
Esperado: PASS, 8 pruebas.

- [ ] **Paso 5: Commit**

```bash
git add src/lib/pedidos/acciones.ts src/lib/pedidos/acciones.test.ts
git commit -m "feat: qué se puede hacer con un pedido según su estado"
```

---

## Tarea 3: Navegación

Sin esto no se llega a ninguna de las pantallas que siguen. Hoy `/ajustes` solo se alcanza escribiendo la URL.

**Archivos:**
- Crear: `src/components/NavegacionPrincipal.tsx`
- Modificar: `src/app/(app)/layout.tsx`

**Interfaces:**
- Consume: `obtenerUsuarioActual` de `@/lib/db/cliente-supabase`
- Produce: `<NavegacionPrincipal />` — Server Component asíncrono

- [ ] **Paso 1: Escribir la barra**

Crear `src/components/NavegacionPrincipal.tsx`:

```tsx
import Link from 'next/link'
import { obtenerUsuarioActual } from '@/lib/db/cliente-supabase'

const ENLACES = [
  { href: '/pedidos/nuevo', texto: 'Nuevo pedido' },
  { href: '/pedidos', texto: 'Pedidos' },
  { href: '/clientes', texto: 'Clientes' },
  { href: '/ajustes', texto: 'Ajustes' },
]

export async function NavegacionPrincipal() {
  const usuario = await obtenerUsuarioActual()

  return (
    // `solo-pantalla` la esconde al imprimir: la pantalla de documentos
    // usa el mismo layout y el rótulo no puede salir con el menú encima.
    <header className="solo-pantalla border-b bg-white">
      <nav className="mx-auto flex max-w-6xl items-center gap-1 px-4 py-2">
        {ENLACES.map(({ href, texto }) => (
          <Link
            key={href}
            href={href}
            className="rounded-md px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100"
          >
            {texto}
          </Link>
        ))}
        {usuario && (
          <span className="ml-auto text-xs text-slate-500">
            {usuario.nombre} · {usuario.codigoAsesor}
          </span>
        )}
      </nav>
    </header>
  )
}
```

- [ ] **Paso 2: Colgarla del layout**

Reemplazar `src/app/(app)/layout.tsx`:

```tsx
import { NavegacionPrincipal } from '@/components/NavegacionPrincipal'

export default function LayoutApp({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-100">
      <NavegacionPrincipal />
      {children}
    </div>
  )
}
```

- [ ] **Paso 3: Verificar que compila**

Ejecutar: `npm run build`
Esperado: build exitoso.

- [ ] **Paso 4: Verificar a mano**

Con `npm run dev` y sesión iniciada, entrar a `/pedidos/nuevo` y comprobar que la barra aparece y que `/ajustes` se alcanza con un clic. Entrar a la pantalla de documentos de un pedido y comprobar en la vista previa de impresión del navegador que **la barra no sale en el papel**.

- [ ] **Paso 5: Commit**

```bash
git add src/components/NavegacionPrincipal.tsx "src/app/(app)/layout.tsx"
git commit -m "feat: barra de navegación común a todas las pantallas"
```

---

## Tarea 4: Repositorio de consultas de pedidos

**Archivos:**
- Crear: `src/lib/db/paginacion.ts`
- Crear: `src/lib/db/pedidos-consultas.ts`
- Crear test: `src/lib/db/pedidos-consultas.integracion.test.ts`
- Modificar: `src/lib/db/pedidos.ts` (quitar `listarPedidosDeHoyDelCliente`)
- Modificar: `src/app/(app)/pedidos/nuevo/FormularioPedido.tsx` (cambiar de dónde lo importa)

**Interfaces:**
- Consume: `crearClienteServidor` de `@/lib/db/cliente-supabase`; `Rango` de `@/lib/periodo`; `EstadoPedido`, `EstadoPago` de `@/lib/tipos`
- Produce:
  - `POR_PAGINA` y `CLIENTES_POR_PAGINA` en `@/lib/db/paginacion`
  - `interface FilaPedido { id, consecutivo, fecha, clienteNombre, clienteCodigo, dirCiudad, totalKg, total, estado, estadoPago }`
  - `interface FiltrosPedidos { rango?, estado?, estadoPago?, soloPorCobrar?, clienteId?, asesorId?, pagina? }`
  - `interface PaginaPedidos { filas: FilaPedido[]; total: number }`
  - `listarPedidos(filtros: FiltrosPedidos): Promise<PaginaPedidos>`
  - `resumenPorCobrar(): Promise<{ total: number; pedidos: number }>`
  - `historialDelCliente(clienteId: string): Promise<{ filas: FilaPedido[]; totalComprado: number }>`
  - `listarPedidosDeHoyDelCliente(clienteId: string): Promise<{ consecutivo: string; total: number }[]>` (movida desde `pedidos.ts`)

- [ ] **Paso 1: Escribir la prueba de integración**

Corre contra la base real: lo que verifica —que un borrador sin consecutivo no aparezca— no se puede simular. Crear `src/lib/db/pedidos-consultas.integracion.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

describe('el listado esconde los borradores', () => {
  it('un pedido sin consecutivo no aparece ni cuenta', async () => {
    const { data: cliente } = await supabase
      .from('clientes').insert({ nombre: 'Prueba borrador' }).select('id').single()

    // Un borrador huérfano, como el que deja un fallo a mitad de confirmar
    await supabase.from('pedidos').insert({ cliente_id: cliente!.id, total: 99999 })

    // Un pedido de verdad
    const { data: real } = await supabase
      .from('pedidos').insert({ cliente_id: cliente!.id, total: 11111 }).select('id').single()
    await supabase.rpc('asignar_consecutivo', { p_pedido_id: real!.id })

    const { data, count } = await supabase
      .from('pedidos')
      .select('consecutivo, total', { count: 'exact' })
      .eq('cliente_id', cliente!.id)
      .not('consecutivo', 'is', null)

    expect(count).toBe(1)
    expect(data![0].total).toBe(11111)

    await supabase.from('clientes').delete().eq('id', cliente!.id)
  }, 30000)
})
```

- [ ] **Paso 2: Correr la prueba**

Ejecutar: `npm run test:integracion`
Esperado: PASS. (Verifica el filtro que la Tarea usa; si falla, la base no está levantada — correr `npx supabase start`.)

- [ ] **Paso 3: Sacar los tamaños de página a su propio archivo**

Un archivo con `'use server'` **solo puede exportar funciones asíncronas**: exportar
una constante desde ahí rompe el build. Por eso los tamaños de página viven aparte.

Crear `src/lib/db/paginacion.ts`:

```ts
// Un archivo `'use server'` solo puede exportar funciones asíncronas, así que
// estas constantes no pueden vivir en los repositorios que las usan.
export const POR_PAGINA = 50
export const CLIENTES_POR_PAGINA = 50
```

- [ ] **Paso 4: Escribir el repositorio de consultas**

Crear `src/lib/db/pedidos-consultas.ts`:

```ts
'use server'

import { crearClienteServidor } from './cliente-supabase'
import { POR_PAGINA } from './paginacion'
import type { Rango } from '@/lib/periodo'
import type { EstadoPedido, EstadoPago } from '@/lib/tipos'

const COLUMNAS =
  'id, consecutivo, fecha, cliente_nombre, cliente_codigo, dir_ciudad, total_kg, total, estado, estado_pago'

export interface FilaPedido {
  id: string
  consecutivo: string
  fecha: string
  clienteNombre: string
  clienteCodigo: string
  dirCiudad: string | null
  totalKg: number
  total: number
  estado: EstadoPedido
  estadoPago: EstadoPago
}

export interface FiltrosPedidos {
  rango?: Rango
  estado?: EstadoPedido
  estadoPago?: EstadoPago
  soloPorCobrar?: boolean
  clienteId?: string
  asesorId?: string
  pagina?: number
}

export interface PaginaPedidos {
  filas: FilaPedido[]
  total: number
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapearFila(f: any): FilaPedido {
  return {
    id: f.id,
    consecutivo: f.consecutivo,
    fecha: f.fecha,
    clienteNombre: f.cliente_nombre ?? '',
    clienteCodigo: f.cliente_codigo ?? '',
    dirCiudad: f.dir_ciudad,
    totalKg: f.total_kg,
    total: f.total,
    estado: f.estado,
    estadoPago: f.estado_pago,
  }
}

export async function listarPedidos(filtros: FiltrosPedidos): Promise<PaginaPedidos> {
  const supabase = await crearClienteServidor()
  const pagina = filtros.pagina ?? 0
  const primera = pagina * POR_PAGINA

  let consulta = supabase
    .from('pedidos')
    .select(COLUMNAS, { count: 'exact' })
    // Un borrador huérfano de un fallo a mitad de confirmar no ensucia
    // la lista ni los totales.
    .not('consecutivo', 'is', null)
    .order('fecha', { ascending: false })
    .range(primera, primera + POR_PAGINA - 1)

  if (filtros.rango) {
    consulta = consulta.gte('fecha', filtros.rango.desde).lt('fecha', filtros.rango.hasta)
  }
  if (filtros.estado) consulta = consulta.eq('estado', filtros.estado)
  if (filtros.estadoPago) consulta = consulta.eq('estado_pago', filtros.estadoPago)
  if (filtros.soloPorCobrar) {
    consulta = consulta.neq('estado_pago', 'pagado').neq('estado', 'anulado')
  }
  if (filtros.clienteId) consulta = consulta.eq('cliente_id', filtros.clienteId)
  if (filtros.asesorId) consulta = consulta.eq('asesor_id', filtros.asesorId)

  const { data, error, count } = await consulta
  if (error) throw new Error(`No se pudo leer la lista de pedidos: ${error.message}`)

  return { filas: (data ?? []).map(mapearFila), total: count ?? 0 }
}

/** PostgREST no suma sin una función SQL, y meter la lógica del negocio en
 *  una migración la vuelve difícil de cambiar. Se trae una sola columna del
 *  conjunto pendiente —que el negocio trabaja para mantener pequeño— y se
 *  suma aquí. Si algún día crece, esto se cambia por un RPC. */
export async function resumenPorCobrar(): Promise<{ total: number; pedidos: number }> {
  const supabase = await crearClienteServidor()
  const { data, error } = await supabase
    .from('pedidos')
    .select('total')
    .not('consecutivo', 'is', null)
    .neq('estado_pago', 'pagado')
    .neq('estado', 'anulado')

  if (error) throw new Error(`No se pudo calcular lo pendiente por cobrar: ${error.message}`)

  const filas = data ?? []
  return {
    total: filas.reduce((suma, f) => suma + f.total, 0),
    pedidos: filas.length,
  }
}

export async function historialDelCliente(
  clienteId: string,
): Promise<{ filas: FilaPedido[]; totalComprado: number }> {
  const supabase = await crearClienteServidor()
  const { data, error } = await supabase
    .from('pedidos')
    .select(COLUMNAS)
    .eq('cliente_id', clienteId)
    .not('consecutivo', 'is', null)
    .neq('estado', 'anulado')
    .order('fecha', { ascending: false })
    .limit(100)

  if (error) throw new Error(`No se pudo leer el historial: ${error.message}`)

  const filas = (data ?? []).map(mapearFila)
  return {
    filas,
    totalComprado: filas.reduce((suma, f) => suma + f.total, 0),
  }
}

export async function listarPedidosDeHoyDelCliente(
  clienteId: string,
): Promise<{ consecutivo: string; total: number }[]> {
  const supabase = await crearClienteServidor()
  const inicioDelDia = new Date()
  inicioDelDia.setHours(0, 0, 0, 0)

  const { data } = await supabase
    .from('pedidos')
    .select('consecutivo, total')
    .eq('cliente_id', clienteId)
    .neq('estado', 'anulado')
    .not('consecutivo', 'is', null)
    .gte('fecha', inicioDelDia.toISOString())

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((p: any) => ({ consecutivo: p.consecutivo, total: p.total }))
}
```

- [ ] **Paso 5: Quitarla del repositorio de escritura**

En `src/lib/db/pedidos.ts`, borrar la función `listarPedidosDeHoyDelCliente` completa (es la última del archivo). El archivo debe terminar después de `anularPedido`.

- [ ] **Paso 6: Corregir el import del formulario**

En `src/app/(app)/pedidos/nuevo/FormularioPedido.tsx`, reemplazar:

```tsx
import {
  crearBorrador, guardarBorrador, confirmarPedido, listarPedidosDeHoyDelCliente,
} from '@/lib/db/pedidos'
```

por:

```tsx
import { crearBorrador, guardarBorrador, confirmarPedido } from '@/lib/db/pedidos'
import { listarPedidosDeHoyDelCliente } from '@/lib/db/pedidos-consultas'
```

- [ ] **Paso 7: Verificar que todo sigue en pie**

Ejecutar: `npm run test && npm run build`
Esperado: todas PASS, build exitoso.

- [ ] **Paso 8: Commit**

```bash
git add src/lib/db/ "src/app/(app)/pedidos/nuevo/FormularioPedido.tsx"
git commit -m "feat: repositorio de consultas de pedidos, separado del que escribe"
```

---

## Tarea 5: Acciones de escritura sobre el pedido

**Archivos:**
- Modificar: `src/lib/db/pedidos.ts`
- Crear test: `src/lib/db/cobro.integracion.test.ts`

**Interfaces:**
- Consume: `puedeTransicionar` de `@/lib/pedidos/estados` (ya importado en el archivo)
- Produce:
  - `marcarPagado(id: string, metodo?: string): Promise<void>`
  - `marcarEnviado(id: string): Promise<void>`
  - `marcarEntregado(id: string): Promise<void>`

- [ ] **Paso 1: Escribir la prueba de integración**

Crear `src/lib/db/cobro.integracion.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

async function pedidoConfirmado(clienteId: string): Promise<string> {
  const { data } = await supabase
    .from('pedidos')
    .insert({ cliente_id: clienteId, estado: 'confirmado', total: 50000 })
    .select('id').single()
  await supabase.rpc('asignar_consecutivo', { p_pedido_id: data!.id })
  return data!.id
}

describe('marcar pagado', () => {
  it('cobrar dos veces conserva la fecha del primer cobro', async () => {
    const { data: cliente } = await supabase
      .from('clientes').insert({ nombre: 'Prueba cobro' }).select('id').single()
    const id = await pedidoConfirmado(cliente!.id)

    // Primer cobro
    await supabase
      .from('pedidos')
      .update({ estado_pago: 'pagado', fecha_pago: new Date().toISOString() })
      .eq('id', id)
      .neq('estado_pago', 'pagado')

    const { data: primera } = await supabase
      .from('pedidos').select('fecha_pago').eq('id', id).single()

    await new Promise((r) => setTimeout(r, 50))

    // Segundo intento: la guarda `neq` impide que reescriba
    await supabase
      .from('pedidos')
      .update({ estado_pago: 'pagado', fecha_pago: new Date().toISOString() })
      .eq('id', id)
      .neq('estado_pago', 'pagado')

    const { data: segunda } = await supabase
      .from('pedidos').select('fecha_pago').eq('id', id).single()

    expect(segunda!.fecha_pago).toBe(primera!.fecha_pago)

    await supabase.from('clientes').delete().eq('id', cliente!.id)
  }, 30000)
})
```

- [ ] **Paso 2: Correr la prueba**

Ejecutar: `npm run test:integracion`
Esperado: PASS, 3 pruebas en total (las 2 del Plan 1 más esta).

- [ ] **Paso 3: Implementar las acciones**

Añadir al final de `src/lib/db/pedidos.ts`:

```ts
/** Idempotente: cobrar dos veces, o dos personas a la vez, no reescriben
 *  la fecha del primer cobro. La guarda va en el `update`, no solo en la
 *  lectura previa, porque entre leer y escribir cabe otra sesión. */
export async function marcarPagado(id: string, metodo?: string): Promise<void> {
  const supabase = await crearClienteServidor()

  const { data: pedido } = await supabase
    .from('pedidos').select('estado, estado_pago').eq('id', id).single()
  if (!pedido) throw new Error('No se encontró el pedido')
  if (pedido.estado === 'anulado') throw new Error('Un pedido anulado no se puede cobrar')
  if (pedido.estado_pago === 'pagado') return

  const { error } = await supabase
    .from('pedidos')
    .update({
      estado_pago: 'pagado',
      fecha_pago: new Date().toISOString(),
      metodo_pago: metodo?.trim() || null,
    })
    .eq('id', id)
    .neq('estado_pago', 'pagado')

  if (error) throw new Error(`No se pudo marcar pagado: ${error.message}`)
}

async function cambiarEstado(id: string, hacia: EstadoPedido): Promise<void> {
  const supabase = await crearClienteServidor()

  const { data: pedido } = await supabase
    .from('pedidos').select('estado').eq('id', id).single()
  if (!pedido) throw new Error('No se encontró el pedido')

  if (!puedeTransicionar(pedido.estado, hacia)) {
    throw new Error(`Un pedido en estado "${pedido.estado}" no se puede marcar como "${hacia}"`)
  }

  const { error } = await supabase
    .from('pedidos')
    .update({ estado: hacia })
    .eq('id', id)
    .eq('estado', pedido.estado)   // si otro lo movió mientras tanto, no pisa

  if (error) throw new Error(`No se pudo cambiar el estado: ${error.message}`)
}

export async function marcarEnviado(id: string): Promise<void> {
  return cambiarEstado(id, 'enviado')
}

export async function marcarEntregado(id: string): Promise<void> {
  return cambiarEstado(id, 'entregado')
}
```

- [ ] **Paso 4: Verificar que compila**

Ejecutar: `npm run build`
Esperado: build exitoso.

- [ ] **Paso 5: Commit**

```bash
git add src/lib/db/pedidos.ts src/lib/db/cobro.integracion.test.ts
git commit -m "feat: marcar un pedido pagado, enviado o entregado"
```

---

## Tarea 6: Pantalla del listado de pedidos

**Archivos:**
- Crear: `src/app/(app)/pedidos/page.tsx`
- Crear: `src/components/pedidos/FiltrosPedidos.tsx`
- Crear: `src/components/pedidos/FilaPedido.tsx`

**Interfaces:**
- Consume: `listarPedidos`, `resumenPorCobrar`, `FilaPedido` de `@/lib/db/pedidos-consultas`; `POR_PAGINA` de `@/lib/db/paginacion`; `rangoDelDia`, `rangoEntre` de `@/lib/periodo`; `accionesDisponibles` de `@/lib/pedidos/acciones`; `marcarPagado`, `marcarEnviado`, `marcarEntregado`, `anularPedido` de `@/lib/db/pedidos`
- Produce: la ruta `/pedidos`, con el estado en la URL (`?pestana=`, `?pagina=`, `?desde=`, `?hasta=`, `?estado=`)

El estado vive en la URL y no en React: así la pantalla es un Server Component, el botón "atrás" funciona y un filtro se puede compartir por chat.

- [ ] **Paso 1: Escribir los filtros**

Crear `src/components/pedidos/FiltrosPedidos.tsx`:

```tsx
'use client'

import { useRouter, useSearchParams } from 'next/navigation'

const PESTANAS = [
  { clave: 'hoy', texto: 'Hoy' },
  { clave: 'porcobrar', texto: 'Por cobrar' },
  { clave: 'todos', texto: 'Todos' },
]

const ESTADOS = ['confirmado', 'enviado', 'entregado', 'anulado']

export function FiltrosPedidos() {
  const router = useRouter()
  const params = useSearchParams()
  const pestanaActual = params.get('pestana') ?? 'hoy'

  function cambiar(clave: string, valor: string) {
    const nuevos = new URLSearchParams(params.toString())
    if (valor) nuevos.set(clave, valor)
    else nuevos.delete(clave)
    nuevos.delete('pagina')   // cambiar de filtro vuelve a la primera página
    router.push(`/pedidos?${nuevos.toString()}`)
  }

  return (
    <div className="mb-3 space-y-2">
      <div className="flex gap-1">
        {PESTANAS.map(({ clave, texto }) => (
          <button
            key={clave} type="button" onClick={() => cambiar('pestana', clave)}
            className={`rounded-md px-4 py-1.5 text-sm ${
              pestanaActual === clave
                ? 'bg-slate-900 font-semibold text-white'
                : 'border bg-white text-slate-700'
            }`}
          >
            {texto}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <input
          type="date" value={params.get('desde') ?? ''}
          onChange={(e) => cambiar('desde', e.target.value)}
          className="rounded border px-2 py-1"
        />
        <span className="text-slate-400">a</span>
        <input
          type="date" value={params.get('hasta') ?? ''}
          onChange={(e) => cambiar('hasta', e.target.value)}
          className="rounded border px-2 py-1"
        />
        <select
          value={params.get('estado') ?? ''}
          onChange={(e) => cambiar('estado', e.target.value)}
          className="rounded border px-2 py-1"
        >
          <option value="">Todos los estados</option>
          {ESTADOS.map((e) => <option key={e} value={e}>{e}</option>)}
        </select>
      </div>
    </div>
  )
}
```

- [ ] **Paso 2: Escribir la fila**

Crear `src/components/pedidos/FilaPedido.tsx`:

```tsx
'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { formatearPesos } from '@/lib/dinero'
import { formatearFechaCo } from '@/lib/fecha'
import { accionesDisponibles } from '@/lib/pedidos/acciones'
import { marcarPagado, marcarEnviado, marcarEntregado, anularPedido } from '@/lib/db/pedidos'
import type { FilaPedido as Datos } from '@/lib/db/pedidos-consultas'

const METODOS = ['Nequi', 'Efectivo', 'Transferencia']

export function FilaPedido({ pedido }: { pedido: Datos }) {
  const router = useRouter()
  const [pendiente, iniciar] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [anulando, setAnulando] = useState(false)
  const [motivo, setMotivo] = useState('')
  const [metodo, setMetodo] = useState('')

  const acciones = accionesDisponibles(pedido.estado, pedido.estadoPago)

  function ejecutar(accion: () => Promise<void>) {
    setError(null)
    iniciar(async () => {
      try {
        await accion()
        router.refresh()
      } catch (e) {
        // El error sale en la fila: el listado no se pierde y se reintenta.
        setError(e instanceof Error ? e.message : 'No se pudo completar la acción')
      }
    })
  }

  return (
    <>
      <tr className="border-b text-sm">
        <td className="px-2 py-2 font-mono text-xs">{pedido.consecutivo}</td>
        <td className="px-2 py-2 text-xs text-slate-500">{formatearFechaCo(pedido.fecha)}</td>
        <td className="px-2 py-2">
          {pedido.clienteNombre}
          <span className="block text-xs text-slate-500">{pedido.dirCiudad}</span>
        </td>
        <td className="px-2 py-2 text-right tabular-nums">{pedido.totalKg} kg</td>
        <td className="px-2 py-2 text-right tabular-nums font-semibold">
          {formatearPesos(pedido.total)}
        </td>
        <td className="px-2 py-2 text-xs">
          {pedido.estado}
          <span className={`ml-1 rounded px-1.5 py-0.5 ${
            pedido.estadoPago === 'pagado'
              ? 'bg-emerald-100 text-emerald-700'
              : 'bg-amber-100 text-amber-700'
          }`}>
            {pedido.estadoPago}
          </span>
        </td>
        <td className="px-2 py-2">
          <div className="flex flex-wrap items-center gap-1">
            {acciones.puedeVerDocumentos && (
              <Link href={`/pedidos/${pedido.id}/documentos`}
                className="rounded border px-2 py-1 text-xs">Documentos</Link>
            )}
            {acciones.puedeCobrar && (
              <>
                <select value={metodo} onChange={(e) => setMetodo(e.target.value)}
                  className="rounded border px-1 py-1 text-xs">
                  <option value="">Método…</option>
                  {METODOS.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
                <button type="button" disabled={pendiente}
                  onClick={() => ejecutar(() => marcarPagado(pedido.id, metodo))}
                  className="rounded bg-emerald-600 px-2 py-1 text-xs font-semibold text-white disabled:opacity-50">
                  Pagado
                </button>
              </>
            )}
            {acciones.puedeEnviar && (
              <button type="button" disabled={pendiente}
                onClick={() => ejecutar(() => marcarEnviado(pedido.id))}
                className="rounded border px-2 py-1 text-xs disabled:opacity-50">Enviado</button>
            )}
            {acciones.puedeEntregar && (
              <button type="button" disabled={pendiente}
                onClick={() => ejecutar(() => marcarEntregado(pedido.id))}
                className="rounded border px-2 py-1 text-xs disabled:opacity-50">Entregado</button>
            )}
            {acciones.puedeAnular && (
              <button type="button" onClick={() => setAnulando(true)}
                className="rounded border border-red-300 px-2 py-1 text-xs text-red-700">Anular</button>
            )}
          </div>
          {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
        </td>
      </tr>

      {anulando && (
        <tr>
          <td colSpan={7} className="bg-red-50 px-2 py-2">
            <div className="flex items-center gap-2">
              <input autoFocus value={motivo} onChange={(e) => setMotivo(e.target.value)}
                placeholder="Motivo de la anulación"
                className="flex-1 rounded border px-2 py-1 text-sm" />
              <button type="button" disabled={pendiente || !motivo.trim()}
                onClick={() => { ejecutar(() => anularPedido(pedido.id, motivo)); setAnulando(false) }}
                className="rounded bg-red-600 px-3 py-1 text-sm font-semibold text-white disabled:opacity-50">
                Anular
              </button>
              <button type="button" onClick={() => setAnulando(false)}
                className="rounded border px-3 py-1 text-sm">Cancelar</button>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}
```

- [ ] **Paso 3: Escribir la página**

Crear `src/app/(app)/pedidos/page.tsx`:

```tsx
import Link from 'next/link'
import { listarPedidos, resumenPorCobrar } from '@/lib/db/pedidos-consultas'
import { POR_PAGINA } from '@/lib/db/paginacion'
import { rangoDelDia, rangoEntre } from '@/lib/periodo'
import { formatearPesos } from '@/lib/dinero'
import { FiltrosPedidos } from '@/components/pedidos/FiltrosPedidos'
import { FilaPedido } from '@/components/pedidos/FilaPedido'
import type { EstadoPedido } from '@/lib/tipos'

type Params = Promise<Record<string, string | undefined>>

/** Descarta los indefinidos: sin esto la URL termina con `?estado=undefined`. */
function conservar(sp: Record<string, string | undefined>): URLSearchParams {
  const limpios = new URLSearchParams()
  for (const [clave, valor] of Object.entries(sp)) {
    if (valor) limpios.set(clave, valor)
  }
  return limpios
}

export default async function PaginaPedidos({ searchParams }: { searchParams: Params }) {
  const sp = await searchParams
  const pestana = sp.pestana ?? 'hoy'
  const pagina = Number(sp.pagina ?? 0)

  const rango =
    sp.desde && sp.hasta ? rangoEntre(sp.desde, sp.hasta)
    : pestana === 'hoy' ? rangoDelDia()
    : undefined

  const [{ filas, total }, porCobrar] = await Promise.all([
    listarPedidos({
      rango,
      estado: (sp.estado as EstadoPedido | undefined) || undefined,
      soloPorCobrar: pestana === 'porcobrar',
      pagina,
    }),
    resumenPorCobrar(),
  ])

  const paginas = Math.ceil(total / POR_PAGINA)

  function enlacePagina(n: number) {
    const nuevos = conservar(sp)
    nuevos.set('pagina', String(n))
    return `/pedidos?${nuevos.toString()}`
  }

  return (
    <div className="mx-auto max-w-6xl p-4">
      <div className="mb-3 flex items-center justify-between">
        <h1 className="text-lg font-bold">Pedidos</h1>
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-right">
          <span className="block text-[10px] font-bold tracking-wider text-amber-700">
            POR COBRAR
          </span>
          <span className="text-lg font-extrabold tabular-nums text-amber-800">
            {formatearPesos(porCobrar.total)}
          </span>
          <span className="ml-2 text-xs text-amber-700">
            {porCobrar.pedidos} pedido{porCobrar.pedidos === 1 ? '' : 's'}
          </span>
        </div>
      </div>

      <FiltrosPedidos />

      <div className="overflow-x-auto rounded-lg border bg-white">
        <table className="w-full">
          <thead className="border-b bg-slate-50 text-left text-[10px] font-bold tracking-wider text-slate-500">
            <tr>
              <th className="px-2 py-2">ORDEN</th>
              <th className="px-2 py-2">FECHA</th>
              <th className="px-2 py-2">CLIENTE</th>
              <th className="px-2 py-2 text-right">KG</th>
              <th className="px-2 py-2 text-right">TOTAL</th>
              <th className="px-2 py-2">ESTADO</th>
              <th className="px-2 py-2">ACCIONES</th>
            </tr>
          </thead>
          <tbody>
            {filas.length === 0 && (
              <tr><td colSpan={7} className="px-2 py-6 text-center text-sm text-slate-400">
                No hay pedidos con esos filtros
              </td></tr>
            )}
            {filas.map((pedido) => <FilaPedido key={pedido.id} pedido={pedido} />)}
          </tbody>
        </table>
      </div>

      {paginas > 1 && (
        <div className="mt-3 flex items-center gap-2 text-sm">
          {pagina > 0 && <Link href={enlacePagina(pagina - 1)} className="rounded border bg-white px-3 py-1">← Anterior</Link>}
          <span className="text-slate-500">Página {pagina + 1} de {paginas} · {total} pedidos</span>
          {pagina + 1 < paginas && <Link href={enlacePagina(pagina + 1)} className="rounded border bg-white px-3 py-1">Siguiente →</Link>}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Paso 4: Verificar que compila**

Ejecutar: `npm run build`
Esperado: build exitoso, con la ruta `/pedidos` listada.

- [ ] **Paso 5: Probar a mano**

Con `npm run dev`, tomar un pedido nuevo y luego entrar a `/pedidos`. Verificar: aparece en la pestaña Hoy; el total por cobrar de arriba lo incluye; marcar pagado lo saca de "Por cobrar" y el total baja; marcar enviado y luego entregado funciona en ese orden y no al revés; anular exige motivo.

- [ ] **Paso 6: Commit**

```bash
git add "src/app/(app)/pedidos/page.tsx" src/components/pedidos/
git commit -m "feat: listado de pedidos con pestañas, filtros y acciones por fila"
```

---

## Tarea 7: Repositorio de clientes ampliado

**Archivos:**
- Modificar: `src/lib/db/clientes.ts`
- Crear test: `src/lib/db/clientes.integracion.test.ts`

**Interfaces:**
- Consume: `crearClienteServidor`; `Cliente`, `TipoCliente` de `@/lib/tipos`
- Consume además: `CLIENTES_POR_PAGINA` de `@/lib/db/paginacion` (creado en la Tarea 4)
- Produce:
  - `listarClientes(texto: string, pagina?: number): Promise<{ filas: Cliente[]; total: number }>`
  - `actualizarCliente(id: string, datos: { nombre: string; telefono: string; cedula: string; tipo: TipoCliente; notas: string }): Promise<void>`
  - `agregarDireccion(clienteId: string, dir: DatosDireccion): Promise<void>`
  - `actualizarDireccion(id: string, dir: DatosDireccion): Promise<void>`
  - `marcarDireccionPrincipal(clienteId: string, direccionId: string): Promise<void>`
  - `interface DatosDireccion { etiqueta: string; linea: string; barrio: string; ciudad: string; departamento: string; indicaciones: string }`

- [ ] **Paso 1: Escribir la prueba de integración**

La regla más importante del diseño para esta tarea: editar un cliente no puede reescribir un pedido ya confirmado. Crear `src/lib/db/clientes.integracion.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

describe('editar un cliente', () => {
  it('no reescribe los pedidos ya confirmados', async () => {
    const { data: cliente } = await supabase
      .from('clientes')
      .insert({ nombre: 'Nombre Viejo', telefono: '3000000000' })
      .select('id, codigo').single()

    // Un pedido confirmado guarda su propia copia congelada
    const { data: pedido } = await supabase
      .from('pedidos')
      .insert({
        cliente_id: cliente!.id,
        estado: 'confirmado',
        cliente_nombre: 'Nombre Viejo',
        cliente_codigo: cliente!.codigo,
        cliente_telefono: '3000000000',
        dir_ciudad: 'Medellín',
        total: 50000,
      })
      .select('id').single()
    await supabase.rpc('asignar_consecutivo', { p_pedido_id: pedido!.id })

    // Se corrige la ficha del cliente
    await supabase
      .from('clientes')
      .update({ nombre: 'Nombre Corregido', telefono: '3111111111' })
      .eq('id', cliente!.id)

    const { data: despues } = await supabase
      .from('pedidos')
      .select('cliente_nombre, cliente_telefono')
      .eq('id', pedido!.id).single()

    expect(despues!.cliente_nombre).toBe('Nombre Viejo')
    expect(despues!.cliente_telefono).toBe('3000000000')

    await supabase.from('clientes').delete().eq('id', cliente!.id)
  }, 30000)
})
```

- [ ] **Paso 2: Correr la prueba**

Ejecutar: `npm run test:integracion`
Esperado: PASS, 4 pruebas en total.

- [ ] **Paso 3: Ampliar el repositorio**

Añadir el import de `CLIENTES_POR_PAGINA` arriba del archivo, junto a los que ya
están (no puede declararse aquí: `clientes.ts` lleva `'use server'` y esos
archivos solo exportan funciones asíncronas):

```ts
import { CLIENTES_POR_PAGINA } from './paginacion'
```

Y añadir al final de `src/lib/db/clientes.ts`:

```ts
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
): Promise<{ filas: Cliente[]; total: number }> {
  const supabase = await crearClienteServidor()
  const termino = texto.trim()
  const primera = pagina * CLIENTES_POR_PAGINA

  let consulta = supabase
    .from('clientes')
    .select(CAMPOS, { count: 'exact' })
    .order('nombre')
    .range(primera, primera + CLIENTES_POR_PAGINA - 1)

  if (termino) {
    consulta = consulta.or(
      `nombre.ilike.%${termino}%,telefono.ilike.%${termino}%,codigo.ilike.%${termino}%`,
    )
  }

  const { data, error, count } = await consulta
  if (error) throw new Error(`No se pudo leer la lista de clientes: ${error.message}`)

  return { filas: (data ?? []).map(mapearCliente), total: count ?? 0 }
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

  const { error: errorLimpiar } = await supabase
    .from('direcciones').update({ es_principal: false }).eq('cliente_id', clienteId)
  if (errorLimpiar) throw new Error(`No se pudo cambiar la principal: ${errorLimpiar.message}`)

  const { error } = await supabase
    .from('direcciones').update({ es_principal: true }).eq('id', direccionId)
  if (error) throw new Error(`No se pudo cambiar la principal: ${error.message}`)
}
```

- [ ] **Paso 4: Verificar que compila**

Ejecutar: `npm run build`
Esperado: build exitoso.

- [ ] **Paso 5: Commit**

```bash
git add src/lib/db/clientes.ts src/lib/db/clientes.integracion.test.ts
git commit -m "feat: listado, edición y direcciones de clientes"
```

---

## Tarea 8: Listado de clientes

**Archivos:**
- Crear: `src/app/(app)/clientes/page.tsx`
- Crear: `src/components/clientes/BuscadorListado.tsx`

**Interfaces:**
- Consume: `listarClientes` de `@/lib/db/clientes`; `CLIENTES_POR_PAGINA` de `@/lib/db/paginacion`
- Produce: la ruta `/clientes`, con `?q=` y `?pagina=`

- [ ] **Paso 1: Escribir el buscador**

Crear `src/components/clientes/BuscadorListado.tsx`:

```tsx
'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useState } from 'react'

export function BuscadorListado() {
  const router = useRouter()
  const params = useSearchParams()
  const [texto, setTexto] = useState(params.get('q') ?? '')

  function buscar(e: React.FormEvent) {
    e.preventDefault()
    const nuevos = new URLSearchParams()
    if (texto.trim()) nuevos.set('q', texto.trim())
    router.push(`/clientes?${nuevos.toString()}`)
  }

  return (
    <form onSubmit={buscar} className="mb-3 flex gap-2">
      <input
        value={texto} onChange={(e) => setTexto(e.target.value)}
        placeholder="Buscar por nombre, teléfono o código…"
        className="flex-1 rounded-lg border px-3 py-2 text-sm"
      />
      <button type="submit" className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
        Buscar
      </button>
    </form>
  )
}
```

- [ ] **Paso 2: Escribir la página**

Crear `src/app/(app)/clientes/page.tsx`:

```tsx
import Link from 'next/link'
import { listarClientes } from '@/lib/db/clientes'
import { CLIENTES_POR_PAGINA } from '@/lib/db/paginacion'
import { BuscadorListado } from '@/components/clientes/BuscadorListado'

type Params = Promise<Record<string, string | undefined>>

export default async function PaginaClientes({ searchParams }: { searchParams: Params }) {
  const sp = await searchParams
  const pagina = Number(sp.pagina ?? 0)
  const { filas, total } = await listarClientes(sp.q ?? '', pagina)
  const paginas = Math.ceil(total / CLIENTES_POR_PAGINA)

  function enlacePagina(n: number) {
    const nuevos = new URLSearchParams()
    if (sp.q) nuevos.set('q', sp.q)
    nuevos.set('pagina', String(n))
    return `/clientes?${nuevos.toString()}`
  }

  return (
    <div className="mx-auto max-w-4xl p-4">
      <h1 className="mb-3 text-lg font-bold">Clientes</h1>

      <BuscadorListado />

      <div className="overflow-hidden rounded-lg border bg-white">
        {filas.length === 0 && (
          <p className="px-3 py-6 text-center text-sm text-slate-400">No hay clientes</p>
        )}
        {filas.map((cliente) => (
          <Link key={cliente.id} href={`/clientes/${cliente.id}`}
            className="flex items-center justify-between border-b px-3 py-2 text-sm hover:bg-slate-50">
            <span>
              <span className="block font-semibold">{cliente.nombre}</span>
              <span className="block text-xs text-slate-500">
                {cliente.telefono ?? 'sin teléfono'} · {cliente.direcciones?.[0]?.ciudad ?? 'sin ciudad'}
              </span>
            </span>
            <span className="rounded bg-blue-100 px-1.5 py-0.5 font-mono text-[10px] text-blue-700">
              {cliente.codigo}
            </span>
          </Link>
        ))}
      </div>

      {paginas > 1 && (
        <div className="mt-3 flex items-center gap-2 text-sm">
          {pagina > 0 && <Link href={enlacePagina(pagina - 1)} className="rounded border bg-white px-3 py-1">← Anterior</Link>}
          <span className="text-slate-500">Página {pagina + 1} de {paginas} · {total} clientes</span>
          {pagina + 1 < paginas && <Link href={enlacePagina(pagina + 1)} className="rounded border bg-white px-3 py-1">Siguiente →</Link>}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Paso 3: Verificar que compila**

Ejecutar: `npm run build`
Esperado: build exitoso, con la ruta `/clientes` listada.

- [ ] **Paso 4: Commit**

```bash
git add "src/app/(app)/clientes/page.tsx" src/components/clientes/
git commit -m "feat: listado de clientes con buscador y paginación"
```

---

## Tarea 9: Ficha del cliente

**Archivos:**
- Crear: `src/app/(app)/clientes/[id]/page.tsx`
- Crear: `src/app/(app)/clientes/[id]/FichaCliente.tsx`

**Interfaces:**
- Consume: `obtenerCliente`, `actualizarCliente`, `agregarDireccion`, `actualizarDireccion`, `marcarDireccionPrincipal`, `DatosDireccion` de `@/lib/db/clientes`; `historialDelCliente` de `@/lib/db/pedidos-consultas`
- Produce: la ruta `/clientes/[id]`

- [ ] **Paso 1: Escribir la página servidor**

Crear `src/app/(app)/clientes/[id]/page.tsx`:

```tsx
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
```

- [ ] **Paso 2: Escribir la ficha**

Crear `src/app/(app)/clientes/[id]/FichaCliente.tsx`:

```tsx
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

  function ejecutar(accion: () => Promise<void>, exito: string) {
    setError(null); setMensaje(null)
    iniciar(async () => {
      try {
        await accion()
        setMensaje(exito)
        router.refresh()
      } catch (e) {
        setError(e instanceof Error ? e.message : 'No se pudo guardar')
      }
    })
  }

  function enmascarar(cedula: string): string {
    if (!cedula) return '—'
    return `${cedula.slice(0, 4)}${'x'.repeat(Math.max(0, cedula.length - 4))}`
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4">
      <div className="flex items-center gap-2">
        <Link href="/clientes" className="text-sm text-blue-600">← Clientes</Link>
        <span className="rounded bg-blue-100 px-1.5 py-0.5 font-mono text-[10px] text-blue-700">
          {cliente.codigo}
        </span>
      </div>

      <section className="rounded-lg border bg-white p-4">
        <h2 className="mb-3 text-sm font-bold">Datos del cliente</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="block">
            <span className="text-xs text-slate-500">Nombre</span>
            <input value={datos.nombre} onChange={(e) => setDatos({ ...datos, nombre: e.target.value })}
              className="mt-1 w-full rounded border px-2 py-1.5 text-sm" />
          </label>
          <label className="block">
            <span className="text-xs text-slate-500">Teléfono</span>
            <input value={datos.telefono} onChange={(e) => setDatos({ ...datos, telefono: e.target.value })}
              className="mt-1 w-full rounded border px-2 py-1.5 text-sm" />
          </label>
          <label className="block">
            <span className="text-xs text-slate-500">
              Cédula
              <button type="button" onClick={() => setCedulaVisible(!cedulaVisible)}
                className="ml-2 text-blue-600">
                {cedulaVisible ? 'ocultar' : 'revelar'}
              </button>
            </span>
            {cedulaVisible ? (
              <input value={datos.cedula} onChange={(e) => setDatos({ ...datos, cedula: e.target.value })}
                className="mt-1 w-full rounded border px-2 py-1.5 text-sm" />
            ) : (
              <p className="mt-1 rounded border bg-slate-50 px-2 py-1.5 text-sm tabular-nums">
                {enmascarar(datos.cedula)}
              </p>
            )}
          </label>
          <label className="block">
            <span className="text-xs text-slate-500">Tipo</span>
            <select value={datos.tipo}
              onChange={(e) => setDatos({ ...datos, tipo: e.target.value as Cliente['tipo'] })}
              className="mt-1 w-full rounded border px-2 py-1.5 text-sm">
              <option value="detal">Detal</option>
              <option value="mayorista">Mayorista</option>
            </select>
          </label>
        </div>
        <label className="mt-2 block">
          <span className="text-xs text-slate-500">Notas</span>
          <textarea value={datos.notas} rows={2}
            onChange={(e) => setDatos({ ...datos, notas: e.target.value })}
            className="mt-1 w-full rounded border px-2 py-1.5 text-sm" />
        </label>
        <button type="button" disabled={pendiente}
          onClick={() => ejecutar(() => actualizarCliente(cliente.id, datos), 'Guardado')}
          className="mt-3 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
          Guardar
        </button>
      </section>

      <section className="rounded-lg border bg-white p-4">
        <h2 className="mb-3 text-sm font-bold">Direcciones</h2>
        {(cliente.direcciones ?? []).map((d) => (
          <div key={d.id} className="mb-2 rounded border p-2 text-sm">
            {editandoDireccion === d.id ? (
              <CamposDireccion
                valores={formDireccion} onCambiar={setFormDireccion}
                onGuardar={() => {
                  ejecutar(() => actualizarDireccion(d.id, formDireccion), 'Dirección guardada')
                  setEditandoDireccion(null)
                }}
                onCancelar={() => setEditandoDireccion(null)}
                pendiente={pendiente}
              />
            ) : (
              <div className="flex items-start justify-between">
                <div>
                  <strong>{d.etiqueta ?? d.linea}</strong>
                  {d.esPrincipal && (
                    <span className="ml-2 rounded bg-emerald-100 px-1.5 text-[10px] text-emerald-700">
                      principal
                    </span>
                  )}
                  <div className="text-slate-600">
                    {d.linea} · {d.barrio} · {d.ciudad}
                  </div>
                  {d.indicaciones && <div className="text-xs italic text-slate-500">{d.indicaciones}</div>}
                </div>
                <div className="flex gap-2 text-xs">
                  <button type="button" className="text-blue-600"
                    onClick={() => { setFormDireccion(desdeDireccion(d)); setEditandoDireccion(d.id) }}>
                    editar
                  </button>
                  {!d.esPrincipal && (
                    <button type="button" className="text-blue-600" disabled={pendiente}
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
          <div className="rounded border border-emerald-300 bg-emerald-50 p-2">
            <CamposDireccion
              valores={formDireccion} onCambiar={setFormDireccion}
              onGuardar={() => {
                ejecutar(() => agregarDireccion(cliente.id, formDireccion), 'Dirección agregada')
                setEditandoDireccion(null)
              }}
              onCancelar={() => setEditandoDireccion(null)}
              pendiente={pendiente}
            />
          </div>
        ) : (
          <button type="button"
            onClick={() => { setFormDireccion(DIRECCION_VACIA); setEditandoDireccion('nueva') }}
            className="rounded border border-dashed px-3 py-1.5 text-xs font-semibold text-emerald-700">
            ＋ Agregar dirección
          </button>
        )}
      </section>

      {error && <p className="rounded bg-red-50 p-2 text-sm text-red-700">{error}</p>}
      {mensaje && <p className="text-sm text-emerald-700">{mensaje}</p>}

      <section className="rounded-lg border bg-white p-4">
        <h2 className="mb-1 text-sm font-bold">Historial</h2>
        <p className="mb-3 text-sm text-slate-600">
          {historial.filas.length} pedido{historial.filas.length === 1 ? '' : 's'} ·
          total comprado <strong>{formatearPesos(historial.totalComprado)}</strong>
        </p>
        {historial.filas.map((p) => (
          <Link key={p.id} href={`/pedidos/${p.id}/documentos`}
            className="flex justify-between border-b py-1.5 text-sm hover:bg-slate-50">
            <span className="font-mono text-xs">{p.consecutivo}</span>
            <span className="text-xs text-slate-500">{formatearFechaCo(p.fecha)}</span>
            <span className="tabular-nums">{formatearPesos(p.total)}</span>
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
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <input placeholder="Etiqueta (casa, oficina…)" value={valores.etiqueta}
          onChange={(e) => onCambiar({ ...valores, etiqueta: e.target.value })}
          className="rounded border px-2 py-1 text-sm" />
        <input placeholder="Dirección" value={valores.linea}
          onChange={(e) => onCambiar({ ...valores, linea: e.target.value })}
          className="rounded border px-2 py-1 text-sm" />
      </div>
      <div className="grid grid-cols-3 gap-2">
        <input placeholder="Barrio" value={valores.barrio}
          onChange={(e) => onCambiar({ ...valores, barrio: e.target.value })}
          className="rounded border px-2 py-1 text-sm" />
        <input placeholder="Ciudad" value={valores.ciudad}
          onChange={(e) => onCambiar({ ...valores, ciudad: e.target.value })}
          className="rounded border px-2 py-1 text-sm" />
        <input placeholder="Depto." value={valores.departamento}
          onChange={(e) => onCambiar({ ...valores, departamento: e.target.value })}
          className="rounded border px-2 py-1 text-sm" />
      </div>
      <input placeholder="Indicaciones" value={valores.indicaciones}
        onChange={(e) => onCambiar({ ...valores, indicaciones: e.target.value })}
        className="w-full rounded border px-2 py-1 text-sm" />
      <div className="flex gap-2">
        <button type="button" onClick={onGuardar} disabled={pendiente}
          className="rounded bg-emerald-600 px-3 py-1 text-sm font-semibold text-white disabled:opacity-50">
          Guardar
        </button>
        <button type="button" onClick={onCancelar} className="rounded border px-3 py-1 text-sm">
          Cancelar
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Paso 3: Verificar que compila**

Ejecutar: `npm run build`
Esperado: build exitoso, con la ruta `/clientes/[id]` listada.

- [ ] **Paso 4: Probar a mano**

Entrar a `/clientes`, abrir un cliente, corregirle el teléfono y guardar. Agregarle una segunda dirección y marcarla como principal. Verificar que la cédula sale enmascarada hasta pulsar "revelar". Volver a un pedido viejo de ese cliente en `/pedidos` y confirmar que **sigue diciendo el nombre y el teléfono que tenía cuando se confirmó**.

- [ ] **Paso 5: Commit**

```bash
git add "src/app/(app)/clientes/[id]/"
git commit -m "feat: ficha del cliente con datos editables, direcciones e historial"
```

---

## Tarea 10: Prueba de extremo a extremo del camino de cobro

**Archivos:**
- Crear: `e2e/cobrar-pedido.spec.ts`

**Interfaces:**
- Consume: la aplicación completa; `E2E_CORREO` y `E2E_CLAVE` de `.env.local`
- Produce: nada

- [ ] **Paso 1: Escribir la prueba**

Crear `e2e/cobrar-pedido.spec.ts`:

```ts
import { test, expect } from '@playwright/test'

const SUFIJO = Date.now().toString().slice(-6)
const NOMBRE_CLIENTE = `Cobro Prueba ${SUFIJO}`

test('toma un pedido, lo cobra desde la lista y el recibo sale pagado', async ({ page }) => {
  await page.goto('/ingresar')
  await page.getByPlaceholder('Correo').fill(process.env.E2E_CORREO!)
  await page.getByPlaceholder('Contraseña').fill(process.env.E2E_CLAVE!)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page).toHaveURL(/\/pedidos\/nuevo/)

  // Un pedido nuevo con un cliente nuevo
  await page.getByPlaceholder(/Buscar cliente/).fill(NOMBRE_CLIENTE)
  await page.getByText(/Crear cliente nuevo/).click()
  await page.getByPlaceholder('Teléfono').fill('3124567890')
  await page.getByPlaceholder('Dirección').fill('Cra 45 # 23-18')
  await page.getByPlaceholder('Ciudad').fill('Medellín')
  await page.getByRole('button', { name: 'Guardar y usar' }).click()
  await expect(page.getByText(NOMBRE_CLIENTE)).toBeVisible()

  for (let i = 0; i < 2; i++) await page.getByRole('button', { name: /^Vainilla/ }).click()
  await page.getByRole('button', { name: /Generar recibo/ }).click()
  await expect(page).toHaveURL(/\/pedidos\/.+\/documentos/)

  const consecutivo = (await page.getByText(/ORDEN No\./).innerText())
    .replace('ORDEN No.', '').trim()

  // El pedido aparece en la lista de hoy y suma a lo pendiente por cobrar
  await page.getByRole('link', { name: 'Pedidos', exact: true }).click()
  await expect(page).toHaveURL(/\/pedidos(\?|$)/)
  const fila = page.getByRole('row').filter({ hasText: consecutivo })
  await expect(fila).toBeVisible()

  // Cobrarlo
  await fila.getByRole('button', { name: 'Pagado' }).click()
  await expect(fila.getByText('pagado')).toBeVisible()

  // El recibo reimpreso ya dice PAGADO
  await fila.getByRole('link', { name: 'Documentos' }).click()
  await expect(page.getByText(/PAGADO/)).toBeVisible()
  await expect(page.getByText('PENDIENTE DE PAGO')).toHaveCount(0)
})
```

- [ ] **Paso 2: Correr la prueba**

Ejecutar: `npm run test:e2e`
Esperado: 2 pruebas PASS (la del Plan 1 más esta).

- [ ] **Paso 3: Verificación final completa**

```bash
npm run test && npm run test:integracion && npm run test:e2e && npm run lint && npm run build
```

Esperado: todo en verde.

- [ ] **Paso 4: Commit**

```bash
git add e2e/cobrar-pedido.spec.ts
git commit -m "test: prueba end-to-end del camino de cobro"
```

---

## Verificación de cobertura del diseño

| Sección del diseño | Tarea |
|---|---|
| §4 Módulos puros (`periodo`, `acciones`) | 1, 2 |
| §4 Repositorios partidos por naturaleza | 4, 5 |
| §4 Navegación | 3 |
| §4 Lo congelado no se toca | 7 (prueba de integración), 9 (paso 4) |
| §5.1 Listado, pestañas, filtros, paginación | 6 |
| §5.1 Total por cobrar siempre visible | 6 |
| §5.1 Acciones por fila y anulación con motivo | 6 |
| §2 Método de pago, opcional al cobrar | 5 (`marcarPagado`), 6 (el desplegable) |
| §5.1 Reimprimir = enlace a los documentos que ya existen | 6 |
| §5.2 Listado de clientes con buscador propio | 7, 8 |
| §5.3 Ficha, cédula revelable, direcciones, historial | 7, 9 |
| §6 "Por cobrar" incluye contraentrega | 4 (`resumenPorCobrar`), 2 (`puedeCobrar`) |
| §6 Solo pedidos con consecutivo | 4 |
| §6 Marcar pagado es idempotente | 5 |
| §6 Estados por `puedeTransicionar` | 5 |
| §6 "Hoy" es hoy en Bogotá | 1, 6 |
| §7 Errores en la fila, sin perder el listado | 6 |
| §8 Pruebas unitarias, integración y e2e | 1, 2, 4, 5, 7, 10 |

**Fuera de este plan, van en el plan del balance:** reportes por sabor, clientes distintos y nuevos, totales de kilos y valor, mayores y menores compradores, comparación contra el periodo anterior, exportación a `.xlsx`, clientes inactivos, ventas por asesor y desglose por método de pago.
