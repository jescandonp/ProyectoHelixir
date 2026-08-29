# Exportar listado de pedidos (Excel/PDF) — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dos botones en `/pedidos` ("Excel" y "PDF") que descargan el resultado ya filtrado del listado — todas las filas que cumplen el filtro/pestaña activa, no solo la página de 50 visibles.

**Architecture:** Una ruta HTTP (`GET /api/pedidos/exportar`) reutiliza el mismo parseo de filtros de URL que ya usa `/pedidos` (extraído a un módulo puro compartido), trae **todas** las filas con una nueva consulta sin paginar, y las convierte a un archivo — `.xlsx` con `exceljs`, `.pdf` con `@react-pdf/renderer` (sin navegador headless: JS puro, sin binario de Chromium). Es una ruta HTTP y no una acción de servidor para que sea un enlace de descarga normal del navegador.

**Tech Stack:** Next.js Route Handlers, `exceljs`, `@react-pdf/renderer`, Vitest, Playwright.

## Global Constraints

- Ninguna función que use `crearClienteServidor()` (y por lo tanto `next/headers`) se puede llamar directamente desde una prueba de Vitest — solo desde una petición real de Next.js. Las pruebas de esas funciones van como pruebas de integración armando la consulta a mano, o como pruebas end-to-end contra el servidor real.
- El módulo de filtros de URL (`fechaValida`, `estadoPagoValido`) es puro y compartido entre `/pedidos` (la pantalla) y `/api/pedidos/exportar` (la ruta): un cambio en cómo se valida una fecha de la URL debe aplicar igual en los dos sitios, no en una copia.
- La exportación nunca pagina: siempre trae todo lo que cumple el filtro activo.
- Los nombres de archivo descargado usan la fecha de hoy en formato `AAAA-MM-DD`.

---

### Task 1: Instalar `exceljs` y `@react-pdf/renderer`

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`

- [ ] **Step 1: Instalar las dependencias**

Run: `npm install exceljs @react-pdf/renderer`
Expected: `package.json` gana dos entradas nuevas en `dependencies`; el comando
termina sin errores de peer dependencies.

- [ ] **Step 2: Verificar que el build sigue pasando**

Run: `npm run build`
Expected: build exitoso, sin errores de tipos ni de bundling por las
dependencias nuevas.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: agrega exceljs y @react-pdf/renderer para exportar pedidos"
```

---

### Task 2: Extraer los filtros de URL a un módulo compartido

**Files:**
- Create: `src/lib/pedidos/filtros-url.ts`
- Test: `src/lib/pedidos/filtros-url.test.ts`
- Modify: `src/app/(app)/pedidos/page.tsx`

**Interfaces:**
- Produces: `fechaValida(valor: string | undefined): string | undefined` y
  `estadoPagoValido(valor: string | undefined): EstadoPago | undefined`,
  exportados desde `src/lib/pedidos/filtros-url.ts`. La ruta de exportación
  (Task 6) los usa también.

Este módulo no es código nuevo: es exactamente el que ya vive hoy dentro de
`page.tsx` (líneas 12-18 y 31-45), movido para poder reusarlo desde la ruta
de exportación sin copiarlo. Por eso este paso empieza escribiendo la prueba
sobre el comportamiento ya existente (que hoy no tiene prueba propia), y
luego mueve el código.

- [ ] **Step 1: Escribir la prueba (falla primero, el módulo no existe)**

```typescript
// src/lib/pedidos/filtros-url.test.ts
import { describe, it, expect } from 'vitest'
import { fechaValida, estadoPagoValido } from './filtros-url'

describe('fechaValida', () => {
  it('acepta una fecha real en formato AAAA-MM-DD', () => {
    expect(fechaValida('2026-08-14')).toBe('2026-08-14')
  })

  it('rechaza un formato que no es AAAA-MM-DD', () => {
    expect(fechaValida('14-08-2026')).toBeUndefined()
  })

  it('rechaza una fecha que no existe, como el 30 de febrero', () => {
    expect(fechaValida('2026-02-30')).toBeUndefined()
  })

  it('rechaza vacío o indefinido', () => {
    expect(fechaValida('')).toBeUndefined()
    expect(fechaValida(undefined)).toBeUndefined()
  })
})

describe('estadoPagoValido', () => {
  it('acepta los tres estados de pago válidos', () => {
    expect(estadoPagoValido('pendiente')).toBe('pendiente')
    expect(estadoPagoValido('contraentrega')).toBe('contraentrega')
    expect(estadoPagoValido('pagado')).toBe('pagado')
  })

  it('rechaza un valor que no es un estado de pago, sin lanzar', () => {
    expect(estadoPagoValido('otro-cualquiera')).toBeUndefined()
    expect(estadoPagoValido(undefined)).toBeUndefined()
  })
})
```

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `npm test -- filtros-url`
Expected: FAIL — `Cannot find module './filtros-url'`.

- [ ] **Step 3: Crear el módulo con el código movido de `page.tsx`**

```typescript
// src/lib/pedidos/filtros-url.ts
import type { EstadoPago } from '@/lib/tipos'

const ESTADOS_PAGO: EstadoPago[] = ['pendiente', 'contraentrega', 'pagado']

/** Un valor fuera de esta lista (URL retocada a mano) se ignora en vez de
 *  romper la pantalla, igual que ya hace `fechaValida` con las fechas. */
export function estadoPagoValido(valor: string | undefined): EstadoPago | undefined {
  return ESTADOS_PAGO.includes(valor as EstadoPago) ? (valor as EstadoPago) : undefined
}

const FORMATO_FECHA = /^\d{4}-\d{2}-\d{2}$/

/** Exige la forma AAAA-MM-DD y que sea una fecha real (rechaza p.ej.
 *  "2026-02-30", que `Date` normalizaría en vez de rechazar). Una fecha
 *  inválida en la URL no debe romper la pantalla: se ignora y quien llama
 *  cae al comportamiento por defecto, en vez de dejar que `rangoEntre`
 *  reviente con un `RangeError` al construir el ISO. */
export function fechaValida(valor: string | undefined): string | undefined {
  if (!valor || !FORMATO_FECHA.test(valor)) return undefined
  const [anio, mes, dia] = valor.split('-').map(Number)
  const fecha = new Date(Date.UTC(anio, mes - 1, dia))
  const esReal =
    fecha.getUTCFullYear() === anio && fecha.getUTCMonth() === mes - 1 && fecha.getUTCDate() === dia
  return esReal ? valor : undefined
}
```

- [ ] **Step 4: Ejecutar y verificar que pasa**

Run: `npm test -- filtros-url`
Expected: PASS

- [ ] **Step 5: Quitar el código movido de `page.tsx` e importarlo**

En `src/app/(app)/pedidos/page.tsx`:

```typescript
// Agregar al bloque de imports (junto a los demás):
import { fechaValida, estadoPagoValido } from '@/lib/pedidos/filtros-url'
```

```typescript
// Borrar por completo estas líneas del archivo (12-18 y 31-45 del original):
//   const ESTADOS_PAGO: EstadoPago[] = [...]
//   function estadoPagoValido(...) { ... }
//   const FORMATO_FECHA = /.../
//   function fechaValida(...) { ... }
// `conservar` y el tipo `Params` se quedan tal cual en page.tsx: son
// específicos de esta pantalla (arman URLSearchParams desde searchParams de
// Next), la ruta de exportación no los necesita.
```

`EstadoPago` deja de usarse directamente en `page.tsx` salvo dentro del tipo
`EstadoPedido | undefined` que ya usaba `estado`; revisar el import de tipos
en la línea 10 y quitar `EstadoPago` si ya no queda ninguna otra referencia
en el archivo (sigue haciendo falta `EstadoPedido`).

- [ ] **Step 6: Verificar que la pantalla sigue funcionando**

Run: `npm test -- filtros-url`
Expected: PASS (sin cambios; confirma que el movimiento no rompió nada en
Vitest)

Run: `npm run build`
Expected: build exitoso — confirma que `page.tsx` sigue compilando después
de quitar las funciones movidas.

- [ ] **Step 7: Commit**

```bash
git add src/lib/pedidos/filtros-url.ts src/lib/pedidos/filtros-url.test.ts "src/app/(app)/pedidos/page.tsx"
git commit -m "refactor: extrae los filtros de URL de pedidos a un módulo compartido"
```

---

### Task 3: `listarPedidosParaExportar` — todas las filas, sin paginar

**Files:**
- Modify: `src/lib/db/pedidos-consultas.ts`
- Modify: `src/lib/db/pedidos-consultas.integracion.test.ts`

**Interfaces:**
- Produces: `listarPedidosParaExportar(filtros: Omit<FiltrosPedidos, 'pagina'>): Promise<FilaPedido[]>`,
  exportada desde `src/lib/db/pedidos-consultas.ts`. Usa el mismo tipo
  `FilaPedido` y `FiltrosPedidos` que ya existen ahí.

`listarPedidosParaExportar` usa `crearClienteServidor()`, así que —igual que
`listarPedidos`— no se puede llamar directamente desde Vitest (ver
`Global Constraints`). Esta tarea prueba, igual que ya hace el archivo de
integración existente, el comportamiento real de la tabla con una consulta
armada a mano; la función se verifica de punta a punta en la Task 7 (e2e).

- [ ] **Step 1: Escribir la prueba de integración (falla primero)**

Agregar al final de `src/lib/db/pedidos-consultas.integracion.test.ts`,
dentro de un nuevo `describe`:

```typescript
// Agregar al final del archivo existente:
describe('exportar trae todas las filas del filtro, sin paginar', () => {
  it('con más de una página de datos sembrados, trae todas', async () => {
    const { data: cliente } = await supabase
      .from('clientes').insert({ nombre: 'Prueba exportar todas' }).select('id').single()

    try {
      // 3 pedidos reales del mismo cliente: de sobra para distinguir "todas"
      // de "una página", sin sembrar cientos de filas solo para la prueba.
      // `estado: 'confirmado'` es explícito a propósito: `asignar_consecutivo`
      // solo asigna el consecutivo, no cambia el estado (es justo lo que
      // prueba el segundo test de este archivo, "un borrador con consecutivo
      // ya asignado no aparece ni cuenta"), así que sin esto los tres
      // quedarían en `borrador` y `filtrarPedidosReales` los excluiría a
      // todos, no solo a la paginación.
      const ids: string[] = []
      for (let i = 0; i < 3; i++) {
        const { data: pedido } = await supabase
          .from('pedidos')
          .insert({ cliente_id: cliente!.id, estado: 'confirmado', total: 10000 + i })
          .select('id').single()
        await supabase.rpc('asignar_consecutivo', { p_pedido_id: pedido!.id })
        ids.push(pedido!.id)
      }

      const { data, error } = await filtrarPedidosReales(
        supabase
          .from('pedidos')
          .select('id, total')
          .eq('cliente_id', cliente!.id),
      )
      if (error) throw new Error(`Falló la consulta: ${error.message}`)

      expect(data).toHaveLength(3)
      expect(data!.map((f) => f.id).sort()).toEqual([...ids].sort())
    } finally {
      const { error: errorPedidos } = await supabase.from('pedidos').delete().eq('cliente_id', cliente!.id)
      if (errorPedidos) throw new Error(`No se pudieron limpiar los pedidos de prueba: ${errorPedidos.message}`)
      const { error: errorCliente } = await supabase.from('clientes').delete().eq('id', cliente!.id)
      if (errorCliente) throw new Error(`No se pudo limpiar el cliente de prueba: ${errorCliente.message}`)
    }
  }, 30000)
})
```

- [ ] **Step 2: Ejecutar y verificar que pasa ya (es la base sin cambios)**

Run: `npm run test:integracion -- pedidos-consultas`
Expected: PASS — esta prueba no depende de código nuevo todavía, prueba que
una consulta sin `.range()` trae todas las filas del filtro. Sirve de
referencia de comportamiento antes de tocar `pedidos-consultas.ts`.

- [ ] **Step 3: Refactorizar `listarPedidos` para compartir el armado de filtros, y agregar `listarPedidosParaExportar`**

En `src/lib/db/pedidos-consultas.ts`, reemplazar la función `listarPedidos`
completa (lo demás del archivo no cambia) y agregar la nueva función justo
después:

```typescript
/** Encadena los filtros comunes a `listarPedidos` y `listarPedidosParaExportar`.
 *  `T` no lleva restricción de tipo por la misma razón documentada en
 *  `filtrarPedidosReales` (filtros-pedidos.ts): las firmas sobrecargadas del
 *  `PostgrestFilterBuilder` real disparan "Type instantiation is excessively
 *  deep" si TypeScript intenta comprobarlas contra una restricción genérica. */
function aplicarFiltros<T>(consulta: T, filtros: Omit<FiltrosPedidos, 'pagina'>): T {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let c = consulta as any
  if (filtros.rango) c = c.gte('fecha', filtros.rango.desde).lt('fecha', filtros.rango.hasta)
  if (filtros.estado) c = c.eq('estado', filtros.estado)
  if (filtros.estadoPago) c = c.eq('estado_pago', filtros.estadoPago)
  if (filtros.soloPorCobrar) c = c.neq('estado_pago', 'pagado').neq('estado', 'anulado')
  if (filtros.clienteId) c = c.eq('cliente_id', filtros.clienteId)
  if (filtros.asesorId) c = c.eq('asesor_id', filtros.asesorId)
  return c as T
}

export async function listarPedidos(filtros: FiltrosPedidos): Promise<PaginaPedidos> {
  const supabase = await crearClienteServidor()
  const pagina = filtros.pagina ?? 0
  const primera = pagina * POR_PAGINA

  const consulta = aplicarFiltros(
    filtrarPedidosReales(supabase.from('pedidos').select(COLUMNAS, { count: 'exact' })),
    filtros,
  )
    .order('fecha', { ascending: false })
    .order('id', { ascending: false })
    .range(primera, primera + POR_PAGINA - 1)

  const { data, error, count } = await consulta
  if (error) throw new Error(`No se pudo leer la lista de pedidos: ${error.message}`)

  return { filas: (data ?? []).map(mapearFila), total: count ?? 0 }
}

/** Igual que `listarPedidos`, pero sin `.range()`: trae todas las filas que
 *  cumplen el filtro. La usa la exportación a Excel/PDF, donde "el resultado
 *  filtrado" tiene que ser todo, no la página de 50 que se ve en pantalla. */
export async function listarPedidosParaExportar(
  filtros: Omit<FiltrosPedidos, 'pagina'>,
): Promise<FilaPedido[]> {
  const supabase = await crearClienteServidor()

  const consulta = aplicarFiltros(
    filtrarPedidosReales(supabase.from('pedidos').select(COLUMNAS)),
    filtros,
  )
    .order('fecha', { ascending: false })
    .order('id', { ascending: false })

  const { data, error } = await consulta
  if (error) throw new Error(`No se pudo leer los pedidos para exportar: ${error.message}`)
  return (data ?? []).map(mapearFila)
}
```

- [ ] **Step 4: Verificar que no se rompió nada existente**

Run: `npm run test:integracion -- pedidos-consultas`
Expected: PASS — las pruebas ya existentes de `listarPedidos`/el filtro de
borradores siguen pasando después del refactor de `aplicarFiltros`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/db/pedidos-consultas.ts src/lib/db/pedidos-consultas.integracion.test.ts
git commit -m "feat: agrega listarPedidosParaExportar, sin paginar"
```

---

### Task 4: Generar el Excel

**Files:**
- Create: `src/lib/documentos/a-excel.ts`
- Test: `src/lib/documentos/a-excel.test.ts`

**Interfaces:**
- Consumes: `FilaPedido` de `@/lib/db/pedidos-consultas` (ya existe).
- Produces: `generarExcelPedidos(filas: FilaPedido[]): Promise<Buffer>`,
  exportada desde `src/lib/documentos/a-excel.ts`.

- [ ] **Step 1: Escribir las pruebas (fallan primero)**

```typescript
// src/lib/documentos/a-excel.test.ts
import { describe, it, expect } from 'vitest'
import ExcelJS from 'exceljs'
import { generarExcelPedidos } from './a-excel'
import type { FilaPedido } from '@/lib/db/pedidos-consultas'

const FILA: FilaPedido = {
  id: 'p1', consecutivo: 'PED-000148', fecha: '2026-08-11T21:17:00.000Z',
  clienteNombre: 'Juanito González', clienteCodigo: 'CL-0042', dirCiudad: 'Medellín',
  totalKg: 10, total: 240000, estado: 'confirmado', estadoPago: 'pendiente',
}

describe('generarExcelPedidos', () => {
  it('arma una hoja "Pedidos" con encabezado y una fila por pedido', async () => {
    const buffer = await generarExcelPedidos([FILA])
    const libro = new ExcelJS.Workbook()
    await libro.xlsx.load(buffer)
    const hoja = libro.getWorksheet('Pedidos')!

    expect(hoja.getRow(1).getCell(1).value).toBe('Orden')
    expect(hoja.getRow(2).getCell(1).value).toBe('PED-000148')
    expect(hoja.getRow(2).getCell(3).value).toBe('Juanito González')
    expect(hoja.getRow(2).getCell(4).value).toBe('Medellín')
    expect(hoja.getRow(2).getCell(6).value).toBe(240000)
  })

  it('con ciudad nula, deja la celda vacía en vez de lanzar', async () => {
    const buffer = await generarExcelPedidos([{ ...FILA, dirCiudad: null }])
    const libro = new ExcelJS.Workbook()
    await libro.xlsx.load(buffer)
    const hoja = libro.getWorksheet('Pedidos')!
    expect(hoja.getRow(2).getCell(4).value).toBeNull()
  })

  it('con una lista vacía, arma solo el encabezado', async () => {
    const buffer = await generarExcelPedidos([])
    const libro = new ExcelJS.Workbook()
    await libro.xlsx.load(buffer)
    const hoja = libro.getWorksheet('Pedidos')!
    expect(hoja.rowCount).toBe(1)
  })
})
```

- [ ] **Step 2: Ejecutar y verificar que fallan**

Run: `npm test -- a-excel`
Expected: FAIL — `Cannot find module './a-excel'`.

- [ ] **Step 3: Implementar**

```typescript
// src/lib/documentos/a-excel.ts
import ExcelJS from 'exceljs'
import type { FilaPedido } from '@/lib/db/pedidos-consultas'
import { formatearFechaCo } from '@/lib/fecha'

export async function generarExcelPedidos(filas: FilaPedido[]): Promise<Buffer> {
  const libro = new ExcelJS.Workbook()
  const hoja = libro.addWorksheet('Pedidos')

  hoja.columns = [
    { header: 'Orden', key: 'consecutivo', width: 16 },
    { header: 'Fecha', key: 'fecha', width: 20 },
    { header: 'Cliente', key: 'clienteNombre', width: 28 },
    { header: 'Ciudad', key: 'dirCiudad', width: 18 },
    { header: 'Kg', key: 'totalKg', width: 10 },
    { header: 'Total', key: 'total', width: 14 },
    { header: 'Estado', key: 'estado', width: 14 },
    { header: 'Estado de pago', key: 'estadoPago', width: 16 },
  ]

  for (const fila of filas) {
    hoja.addRow({
      consecutivo: fila.consecutivo,
      fecha: formatearFechaCo(fila.fecha),
      clienteNombre: fila.clienteNombre,
      dirCiudad: fila.dirCiudad,
      totalKg: fila.totalKg,
      total: fila.total,
      estado: fila.estado,
      estadoPago: fila.estadoPago,
    })
  }

  hoja.getColumn('total').numFmt = '#,##0'
  hoja.getRow(1).font = { bold: true }

  return Buffer.from(await libro.xlsx.writeBuffer())
}
```

- [ ] **Step 4: Ejecutar y verificar que pasan**

Run: `npm test -- a-excel`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/documentos/a-excel.ts src/lib/documentos/a-excel.test.ts
git commit -m "feat: agrega generarExcelPedidos"
```

---

### Task 5: Generar el PDF del listado

**Files:**
- Create: `src/lib/documentos/pdf/ListadoPedidosPdf.tsx`
- Test: `src/lib/documentos/pdf/ListadoPedidosPdf.test.tsx`

**Interfaces:**
- Consumes: `FilaPedido` de `@/lib/db/pedidos-consultas`.
- Produces: `renderListadoPedidosPdf(filas: FilaPedido[], titulo: string): Promise<Buffer>`,
  exportada desde `src/lib/documentos/pdf/ListadoPedidosPdf.tsx`. Esta es la
  única función que el resto del código llama — la ruta de exportación
  (Task 6) no necesita JSX ni conocer el componente `ListadoPedidosPdf`.

- [ ] **Step 1: Escribir la prueba (falla primero)**

```typescript
// src/lib/documentos/pdf/ListadoPedidosPdf.test.tsx
import { describe, it, expect } from 'vitest'
import { renderListadoPedidosPdf } from './ListadoPedidosPdf'
import type { FilaPedido } from '@/lib/db/pedidos-consultas'

const FILA: FilaPedido = {
  id: 'p1', consecutivo: 'PED-000148', fecha: '2026-08-11T21:17:00.000Z',
  clienteNombre: 'Juanito González', clienteCodigo: 'CL-0042', dirCiudad: 'Medellín',
  totalKg: 10, total: 240000, estado: 'confirmado', estadoPago: 'pendiente',
}

describe('renderListadoPedidosPdf', () => {
  it('renderiza un PDF no vacío con filas', async () => {
    const buffer = await renderListadoPedidosPdf([FILA], 'Pedidos — Hoy')
    expect(buffer.byteLength).toBeGreaterThan(0)
  })

  it('renderiza un PDF no vacío sin filas, en vez de lanzar', async () => {
    const buffer = await renderListadoPedidosPdf([], 'Pedidos — Hoy')
    expect(buffer.byteLength).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `npm test -- ListadoPedidosPdf`
Expected: FAIL — `Cannot find module './ListadoPedidosPdf'`.

- [ ] **Step 3: Implementar el componente y la función de render**

```tsx
// src/lib/documentos/pdf/ListadoPedidosPdf.tsx
import { Document, Page, View, Text, StyleSheet, renderToBuffer } from '@react-pdf/renderer'
import type { FilaPedido } from '@/lib/db/pedidos-consultas'
import { formatearPesos } from '@/lib/dinero'
import { formatearFechaCo } from '@/lib/fecha'

const estilos = StyleSheet.create({
  pagina: { padding: 24, fontSize: 9, fontFamily: 'Helvetica' },
  titulo: { fontSize: 14, marginBottom: 12, fontWeight: 700 },
  fila: {
    flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: '#cccccc', paddingVertical: 4,
  },
  filaEncabezado: {
    flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#000000',
    paddingVertical: 4, fontWeight: 700,
  },
  colOrden: { width: '14%' },
  colFecha: { width: '18%' },
  colCliente: { width: '26%' },
  colCiudad: { width: '16%' },
  colKg: { width: '8%', textAlign: 'right' },
  colTotal: { width: '12%', textAlign: 'right' },
  colEstado: { width: '6%' },
})

function ListadoPedidosPdf({ filas, titulo }: { filas: FilaPedido[]; titulo: string }) {
  return (
    <Document>
      <Page size="A4" style={estilos.pagina}>
        <Text style={estilos.titulo}>{titulo}</Text>
        <View style={estilos.filaEncabezado}>
          <Text style={estilos.colOrden}>Orden</Text>
          <Text style={estilos.colFecha}>Fecha</Text>
          <Text style={estilos.colCliente}>Cliente</Text>
          <Text style={estilos.colCiudad}>Ciudad</Text>
          <Text style={estilos.colKg}>Kg</Text>
          <Text style={estilos.colTotal}>Total</Text>
          <Text style={estilos.colEstado}>Estado</Text>
        </View>
        {filas.map((fila) => (
          <View key={fila.id} style={estilos.fila}>
            <Text style={estilos.colOrden}>{fila.consecutivo}</Text>
            <Text style={estilos.colFecha}>{formatearFechaCo(fila.fecha)}</Text>
            <Text style={estilos.colCliente}>{fila.clienteNombre}</Text>
            <Text style={estilos.colCiudad}>{fila.dirCiudad ?? ''}</Text>
            <Text style={estilos.colKg}>{fila.totalKg}</Text>
            <Text style={estilos.colTotal}>{formatearPesos(fila.total)}</Text>
            <Text style={estilos.colEstado}>{fila.estado}</Text>
          </View>
        ))}
      </Page>
    </Document>
  )
}

export async function renderListadoPedidosPdf(filas: FilaPedido[], titulo: string): Promise<Buffer> {
  return renderToBuffer(<ListadoPedidosPdf filas={filas} titulo={titulo} />)
}
```

- [ ] **Step 4: Ejecutar y verificar que pasan**

Run: `npm test -- ListadoPedidosPdf`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/documentos/pdf/ListadoPedidosPdf.tsx src/lib/documentos/pdf/ListadoPedidosPdf.test.tsx
git commit -m "feat: agrega el PDF del listado de pedidos"
```

---

### Task 6: La ruta `GET /api/pedidos/exportar`

**Files:**
- Create: `src/app/api/pedidos/exportar/route.ts`

**Interfaces:**
- Consumes: `listarPedidosParaExportar` (Task 3), `generarExcelPedidos`
  (Task 4), `renderListadoPedidosPdf` (Task 5), `fechaValida`/`estadoPagoValido`
  (Task 2), `rangoDelDia`/`rangoEntre` de `@/lib/periodo` (ya existen).
- Produces: `GET` exportado desde `src/app/api/pedidos/exportar/route.ts`.

No hay paso de prueba de Vitest en esta tarea: la ruta llama a
`listarPedidosParaExportar`, que usa `next/headers` y por lo tanto solo
funciona dentro de una petición real (ver `Global Constraints`). Se
verifica con la prueba end-to-end de la Task 7, que sí hace una petición
HTTP real contra el servidor de desarrollo.

- [ ] **Step 1: Implementar la ruta**

```typescript
// src/app/api/pedidos/exportar/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { listarPedidosParaExportar } from '@/lib/db/pedidos-consultas'
import { rangoDelDia, rangoEntre } from '@/lib/periodo'
import { fechaValida, estadoPagoValido } from '@/lib/pedidos/filtros-url'
import { generarExcelPedidos } from '@/lib/documentos/a-excel'
import { renderListadoPedidosPdf } from '@/lib/documentos/pdf/ListadoPedidosPdf'
import type { EstadoPedido } from '@/lib/tipos'

const TITULOS_PESTANA: Record<string, string> = {
  hoy: 'Pedidos — Hoy',
  porcobrar: 'Pedidos — Por cobrar',
  todos: 'Pedidos — Todos',
}

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams
  const formato = sp.get('formato')
  if (formato !== 'excel' && formato !== 'pdf') {
    return NextResponse.json({ error: 'formato debe ser "excel" o "pdf"' }, { status: 400 })
  }

  const pestana = sp.get('pestana') ?? 'hoy'
  const desde = fechaValida(sp.get('desde') ?? undefined)
  const hasta = fechaValida(sp.get('hasta') ?? undefined)

  const rango =
    desde && hasta ? rangoEntre(desde, hasta)
    : pestana === 'hoy' ? rangoDelDia()
    : undefined

  const filas = await listarPedidosParaExportar({
    rango,
    estado: (sp.get('estado') as EstadoPedido | undefined) || undefined,
    estadoPago: estadoPagoValido(sp.get('estadoPago') ?? undefined),
    clienteId: sp.get('clienteId') || undefined,
    asesorId: sp.get('asesorId') || undefined,
    soloPorCobrar: pestana === 'porcobrar',
  })

  const nombreArchivo = `pedidos-${new Date().toISOString().slice(0, 10)}`

  if (formato === 'excel') {
    const buffer = await generarExcelPedidos(filas)
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${nombreArchivo}.xlsx"`,
      },
    })
  }

  const buffer = await renderListadoPedidosPdf(filas, TITULOS_PESTANA[pestana] ?? 'Pedidos')
  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${nombreArchivo}.pdf"`,
    },
  })
}
```

- [ ] **Step 2: Verificar a mano**

Con el stack local levantado y `npm run dev` corriendo, entrar primero a
`/pedidos` en el navegador (para tener sesión), y luego abrir en la misma
pestaña:

`http://localhost:3000/api/pedidos/exportar?formato=excel`

Expected: se descarga un `.xlsx` con las filas de "Hoy" (la pestaña por
defecto). Repetir con `formato=pdf`: se descarga un `.pdf`. Repetir sin
`formato` (o con `formato=csv`): responde `400` con el mensaje de error.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/pedidos/exportar/route.ts
git commit -m "feat: agrega la ruta de exportación de pedidos a Excel y PDF"
```

---

### Task 7: Botones en `/pedidos` y prueba end-to-end

**Files:**
- Modify: `src/app/(app)/pedidos/page.tsx`
- Modify: `e2e/cobrar-pedido.spec.ts`

**Interfaces:**
- Consumes: `GET /api/pedidos/exportar` (Task 6).

- [ ] **Step 1: Agregar los botones, conservando los filtros activos**

En `src/app/(app)/pedidos/page.tsx`:

```typescript
// Agregar al import de estilos ya existente (línea 9 del archivo original):
import { TARJETA, BOTON_SECUNDARIO } from '@/components/estilos'
```

```typescript
// Agregar junto a la función `enlacePagina` ya existente, dentro del componente:
  function enlaceExportar(formato: 'excel' | 'pdf'): string {
    const nuevos = conservar(sp)
    nuevos.delete('pagina')
    nuevos.set('formato', formato)
    return `/api/pedidos/exportar?${nuevos.toString()}`
  }
```

```tsx
// Dentro del <div> que envuelve el título "Pedidos" y la tarjeta de "Por
// cobrar" (el `flex flex-wrap items-start justify-between` del inicio del
// return), agregar un tercer bloque de botones, después de la tarjeta de
// "Por cobrar" y antes de cerrar ese div:
        <div className="flex gap-2">
          <a href={enlaceExportar('excel')} className={BOTON_SECUNDARIO}>⬇ Excel</a>
          <a href={enlaceExportar('pdf')} className={BOTON_SECUNDARIO}>⬇ PDF</a>
        </div>
```

- [ ] **Step 2: Escribir la prueba end-to-end**

Agregar al final de `e2e/cobrar-pedido.spec.ts` un test independiente (inicia
sesión por su cuenta, como ya hace cada test de este archivo):

```typescript
test('exportar el listado descarga un archivo de cada formato', async ({ page }) => {
  await page.goto('/ingresar')
  await page.getByLabel('Correo electrónico').fill(process.env.E2E_CORREO!)
  await page.getByLabel('Contraseña').fill(process.env.E2E_CLAVE!)
  await page.getByRole('button', { name: 'Iniciar sesión' }).click()

  await page.goto('/pedidos')

  const excel = await page.request.get('/api/pedidos/exportar?pestana=todos&formato=excel')
  expect(excel.ok()).toBe(true)
  expect(excel.headers()['content-type']).toBe(
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  )

  const pdf = await page.request.get('/api/pedidos/exportar?pestana=todos&formato=pdf')
  expect(pdf.ok()).toBe(true)
  expect(pdf.headers()['content-type']).toBe('application/pdf')

  const invalido = await page.request.get('/api/pedidos/exportar?pestana=todos&formato=csv')
  expect(invalido.status()).toBe(400)
})
```

`page.request` comparte las cookies de sesión con `page` (la misma pestaña
que ya inició sesión), así que la petición pasa la autenticación del
middleware (`src/proxy.ts`) igual que cualquier navegación normal.

- [ ] **Step 3: Ejecutar y verificar que pasa**

Con el dev server corriendo contra el Supabase local:

Run: `npm run test:e2e -- cobrar-pedido`
Expected: PASS

- [ ] **Step 4: Verificar a mano en el navegador**

Entrar a `/pedidos`, aplicar un filtro (por ejemplo la pestaña "Todos" y un
rango de fechas), y confirmar que los botones "⬇ Excel" y "⬇ PDF" descargan
el resultado de ese filtro — no solo "Hoy".

- [ ] **Step 5: Commit**

```bash
git add "src/app/(app)/pedidos/page.tsx" e2e/cobrar-pedido.spec.ts
git commit -m "feat: agrega los botones de exportar Excel y PDF en /pedidos"
```

---

## Resumen de lo que queda operable al terminar

`/pedidos` tiene dos botones que descargan, en Excel o en PDF, exactamente
el resultado del filtro y la pestaña activos — todas las filas, no solo la
página visible. No se agregó ningún navegador headless al despliegue: toda
la generación de archivos es JS puro (`exceljs`, `@react-pdf/renderer`).
