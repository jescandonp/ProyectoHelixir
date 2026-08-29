# Transportadoras predefinidas — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar el campo de texto libre de transportadora en el formulario de pedido nacional por un desplegable con las transportadoras que el negocio usa hoy, conservando una opción "Otra" para el caso no contemplado.

**Architecture:** Tabla nueva `transportadoras` (mismo patrón que `productos`: `activa`/`orden`, solo lectura desde la app). Una consulta de solo lectura `listarTransportadorasActivas()` se pasa como prop desde el Server Component `pedidos/nuevo/page.tsx` hasta `ResumenPedido.tsx`, que la pinta como `<select>`. El pedido sigue guardando la transportadora como texto plano (`pedidos.transportadora`); no cambia nada del esquema de pedidos, ni de `validacion.ts`, ni de `borrador-local.ts`.

**Tech Stack:** Next.js (App Router, Server Components), Supabase (Postgres), Vitest + Testing Library.

## Global Constraints

- Módulos que se llaman desde un Server Component sin pasar por un formulario de cliente (como `productos.ts`) NO llevan `'use server'` — solo lo llevan los módulos invocados desde Client Components. `transportadoras.ts` sigue el patrón de `productos.ts`.
- El valor final guardado en `pedidos.transportadora` sigue siendo un `string | null` de texto libre — no se introduce ninguna relación (`transportadora_id`) hacia la tabla nueva.
- Semilla real, no de ejemplo: Interrapidísimo, Servientrega, TCC, Coordinadora.
- Todo archivo de prueba nuevo sigue el patrón ya usado en el repo: Vitest + `@testing-library/react` para componentes (`environment: 'jsdom'`, ver `vitest.config.ts`); pruebas contra la base real en `*.integracion.test.ts` (`environment: 'node'`, ver `vitest.integracion.config.ts`), usando `SUPABASE_SERVICE_ROLE_KEY` para saltar RLS y limpiando lo que se inserte.

---

### Task 1: Migración — tabla `transportadoras` sembrada

**Files:**
- Create: `supabase/migrations/0005_transportadoras.sql`

**Interfaces:**
- Produces: tabla `transportadoras (id uuid, nombre text, activa boolean, orden integer)`, con 4 filas sembradas (Interrapidísimo, Servientrega, TCC, Coordinadora, `orden` 1-4, `activa = true`).

- [ ] **Step 1: Escribir la migración**

```sql
create table transportadoras (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique,
  activa boolean not null default true,
  orden integer not null default 0
);

insert into transportadoras (nombre, orden) values
  ('Interrapidísimo', 1),
  ('Servientrega',    2),
  ('TCC',             3),
  ('Coordinadora',    4);
```

- [ ] **Step 2: Aplicar la migración contra el Supabase local**

Requiere Docker Desktop abierto y el stack local levantado (`npx supabase start`
si no está corriendo ya). Con el stack arriba:

Run: `npx supabase db reset`
Expected: la salida termina en `Finished supabase db reset` sin errores, y
reaplica las cinco migraciones (`0001` a `0005`) más la semilla de `0004`.

- [ ] **Step 3: Verificar la siembra a mano**

Run: `npx supabase db query --local "select nombre, activa, orden from transportadoras order by orden"`
Expected: cuatro filas, en este orden — Interrapidísimo, Servientrega, TCC,
Coordinadora — todas con `activa = t`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0005_transportadoras.sql
git commit -m "feat: agrega tabla transportadoras con la semilla del negocio"
```

---

### Task 2: `lib/db/transportadoras.ts` — consulta de solo lectura

**Files:**
- Create: `src/lib/db/transportadoras.ts`
- Test: `src/lib/db/transportadoras.integracion.test.ts`

**Interfaces:**
- Consumes: `crearClienteServidor()` de `src/lib/db/cliente-supabase.ts` (ya existe).
- Produces: `interface Transportadora { id: string; nombre: string }` y
  `async function listarTransportadorasActivas(): Promise<Transportadora[]>`,
  ambos exportados desde `src/lib/db/transportadoras.ts`.

**Nota sobre el orden de esta tarea:** `crearClienteServidor()` usa
`cookies()` de `next/headers`, que solo funciona dentro de una petición real
de Next.js (Server Component, Server Action o Route Handler) — no corriendo
Vitest en Node. Es la misma razón por la que
`src/lib/db/clientes.integracion.test.ts` y
`src/lib/db/pedidos-consultas.integracion.test.ts` nunca llaman a las
funciones de sus propios repositorios (`crearCliente`, `listarPedidos`),
sino que arman la consulta a mano contra Supabase con la service role key.
`listarTransportadorasActivas` cae en el mismo caso: no tiene ninguna lógica
propia que valga la pena extraer a una función pura (a diferencia de
`filtrarPedidosReales`, que sí tiene reglas de negocio). Por eso aquí la
prueba de integración verifica el comportamiento real de la tabla y la
semilla con una consulta armada a mano — igual que ya hace el archivo de
`pedidos-consultas` — y la función en sí queda cubierta de punta a punta por
la prueba end-to-end de la Task 5, que sí pasa por una petición real de
Next.js. Por esto esta tarea implementa primero y prueba después, al revés
del resto del plan: no hay manera de que la prueba falle "por falta de
código" cuando lo que prueba es la tabla, no la función.

- [ ] **Step 1: Implementar el módulo**

```typescript
// src/lib/db/transportadoras.ts
import { crearClienteServidor } from './cliente-supabase'

export interface Transportadora {
  id: string
  nombre: string
}

export async function listarTransportadorasActivas(): Promise<Transportadora[]> {
  const supabase = await crearClienteServidor()
  const { data, error } = await supabase
    .from('transportadoras')
    .select('id, nombre')
    .eq('activa', true)
    .order('orden')

  if (error) throw new Error(`No se pudo leer las transportadoras: ${error.message}`)
  return data ?? []
}
```

- [ ] **Step 2: Escribir la prueba de integración de la tabla y la semilla**

```typescript
// src/lib/db/transportadoras.integracion.test.ts
// Ver la nota en el plan: no se llama a `listarTransportadorasActivas` porque
// usa `next/headers`, que no existe corriendo Vitest en Node. Se prueba la
// misma consulta armada a mano, igual que ya hace `pedidos-consultas.integracion.test.ts`.
import { describe, it, expect } from 'vitest'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

describe('la tabla transportadoras', () => {
  it('la consulta de activas, en orden, trae solo la semilla del negocio', async () => {
    const { data: inactiva, error } = await supabase
      .from('transportadoras')
      .insert({ nombre: 'Transportadora De Prueba Inactiva', activa: false, orden: 99 })
      .select('id').single()
    if (error) throw new Error(`No se pudo sembrar la transportadora de prueba: ${error.message}`)

    try {
      const { data: activas, error: errorConsulta } = await supabase
        .from('transportadoras')
        .select('id, nombre')
        .eq('activa', true)
        .order('orden')
      if (errorConsulta) throw new Error(`Falló la consulta: ${errorConsulta.message}`)

      expect(activas!.map((t) => t.nombre)).toEqual([
        'Interrapidísimo', 'Servientrega', 'TCC', 'Coordinadora',
      ])
      expect(activas!.find((t) => t.id === inactiva!.id)).toBeUndefined()
    } finally {
      await supabase.from('transportadoras').delete().eq('id', inactiva!.id)
    }
  })
})
```

- [ ] **Step 3: Ejecutar y verificar que pasa**

Run: `npm run test:integracion -- transportadoras`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/lib/db/transportadoras.ts src/lib/db/transportadoras.integracion.test.ts
git commit -m "feat: agrega listarTransportadorasActivas"
```

---

### Task 3: `ResumenPedido.tsx` — desplegable con opción "Otra"

**Files:**
- Modify: `src/components/pedido/ResumenPedido.tsx`
- Test: `src/components/pedido/ResumenPedido.test.tsx`

**Interfaces:**
- Consumes: `Transportadora` de `@/lib/db/transportadoras` (Task 2) — solo el
  tipo `{ id: string; nombre: string }`, sin llamar a la consulta desde el
  componente (llega como prop).
- Produces: nueva prop `transportadoras: { id: string; nombre: string }[]` en
  `ResumenPedido`. Las demás props (`transportadora: string`,
  `onCambiarTransportadora: (nombre: string) => void`) no cambian de forma —
  el componente sigue subiendo un `string` plano al padre.

- [ ] **Step 1: Escribir las pruebas (fallan primero)**

```typescript
// src/components/pedido/ResumenPedido.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ResumenPedido } from './ResumenPedido'

const TRANSPORTADORAS = [
  { id: 't1', nombre: 'Interrapidísimo' },
  { id: 't2', nombre: 'Servientrega' },
]

function propsBase(extra: Partial<Parameters<typeof ResumenPedido>[0]> = {}) {
  return {
    items: [], totales: { subtotal: 0, totalKg: 0, total: 0 }, valorDomicilio: 0,
    tipoEntrega: 'nacional' as const, transportadora: '', estadoPago: 'pendiente' as const,
    observaciones: '', problemas: [], confirmando: false,
    transportadoras: TRANSPORTADORAS,
    onCambiarDomicilio: vi.fn(), onCambiarEntrega: vi.fn(),
    onCambiarTransportadora: vi.fn(), onCambiarPago: vi.fn(),
    onCambiarObservaciones: vi.fn(), onConfirmar: vi.fn(),
    ...extra,
  }
}

describe('ResumenPedido — transportadora', () => {
  it('no muestra el selector de transportadora en entrega local', () => {
    render(<ResumenPedido {...propsBase({ tipoEntrega: 'local' })} />)
    expect(screen.queryByLabelText('Transportadora')).toBeNull()
  })

  it('lista las transportadoras activas como opciones en entrega nacional', () => {
    render(<ResumenPedido {...propsBase()} />)
    const select = screen.getByLabelText('Transportadora')
    expect(screen.getByRole('option', { name: 'Interrapidísimo' })).toBeDefined()
    expect(screen.getByRole('option', { name: 'Servientrega' })).toBeDefined()
    expect(select).toBeDefined()
  })

  it('al elegir una transportadora de la lista, avisa al padre con su nombre', () => {
    const onCambiarTransportadora = vi.fn()
    render(<ResumenPedido {...propsBase({ onCambiarTransportadora })} />)
    fireEvent.change(screen.getByLabelText('Transportadora'), { target: { value: 'Servientrega' } })
    expect(onCambiarTransportadora).toHaveBeenCalledWith('Servientrega')
  })

  it('al elegir "Otra", muestra un campo de texto libre', () => {
    render(<ResumenPedido {...propsBase()} />)
    fireEvent.change(screen.getByLabelText('Transportadora'), { target: { value: '__otra__' } })
    expect(screen.getByPlaceholderText('Nombre de la transportadora')).toBeDefined()
  })

  it('escribir en el campo libre avisa al padre con el texto escrito', () => {
    const onCambiarTransportadora = vi.fn()
    render(<ResumenPedido {...propsBase({ onCambiarTransportadora })} />)
    fireEvent.change(screen.getByLabelText('Transportadora'), { target: { value: '__otra__' } })
    fireEvent.change(screen.getByPlaceholderText('Nombre de la transportadora'), {
      target: { value: 'Envíos del Valle' },
    })
    expect(onCambiarTransportadora).toHaveBeenCalledWith('Envíos del Valle')
  })

  it('si ya trae un valor que no está en la lista, arranca en modo "Otra" con el texto visible', () => {
    render(<ResumenPedido {...propsBase({ transportadora: 'Envíos del Valle' })} />)
    expect(screen.getByPlaceholderText('Nombre de la transportadora')).toHaveValue('Envíos del Valle')
  })
})
```

- [ ] **Step 2: Ejecutar y verificar que fallan**

Run: `npm test -- ResumenPedido`
Expected: FAIL — `screen.getByLabelText('Transportadora')` no encuentra nada
todavía (el campo actual no tiene ese `aria-label`) y la prop `transportadoras`
no existe en el tipo de `Props`.

- [ ] **Step 3: Implementar el desplegable**

Reemplazar el bloque de la transportadora (líneas 125-130 del archivo actual)
y agregar la prop nueva:

```typescript
// En la interfaz Props, agregar:
  transportadoras: { id: string; nombre: string }[]
```

```typescript
// Constante de módulo, junto a ENTREGAS y PAGOS:
const OTRA_TRANSPORTADORA = '__otra__'
```

```tsx
// Dentro de ResumenPedido, antes del return, agregar el estado y el efecto:
  const [modoOtra, setModoOtra] = useState(false)

  useEffect(() => {
    if (p.transportadora && !p.transportadoras.some((t) => t.nombre === p.transportadora)) {
      setModoOtra(true)
    }
  }, [p.transportadora, p.transportadoras])

  function alElegirTransportadora(valor: string) {
    if (valor === OTRA_TRANSPORTADORA) {
      setModoOtra(true)
      p.onCambiarTransportadora('')
    } else {
      setModoOtra(false)
      p.onCambiarTransportadora(valor)
    }
  }
```

```tsx
// Reemplaza el <input> de transportadora (líneas 125-130):
          {p.tipoEntrega === 'nacional' && (
            <div className="mt-2 space-y-2">
              <select
                value={modoOtra ? OTRA_TRANSPORTADORA : p.transportadora}
                onChange={(e) => alElegirTransportadora(e.target.value)}
                aria-label="Transportadora"
                className={`${CAMPO} bg-tarjeta`}
              >
                <option value="" disabled>Selecciona transportadora…</option>
                {p.transportadoras.map((t) => (
                  <option key={t.id} value={t.nombre}>{t.nombre}</option>
                ))}
                <option value={OTRA_TRANSPORTADORA}>Otra…</option>
              </select>
              {modoOtra && (
                <input
                  value={p.transportadora}
                  onChange={(e) => p.onCambiarTransportadora(e.target.value)}
                  placeholder="Nombre de la transportadora"
                  className={CAMPO}
                />
              )}
            </div>
          )}
```

Agregar `useEffect` al import de React ya existente:

```typescript
import { useEffect, useState } from 'react'
```

(el archivo hoy no importa hooks porque no tenía estado propio — se agrega esta línea al inicio del archivo, junto a los demás imports).

- [ ] **Step 4: Ejecutar y verificar que pasan**

Run: `npm test -- ResumenPedido`
Expected: PASS, las 6 pruebas.

- [ ] **Step 5: Commit**

```bash
git add src/components/pedido/ResumenPedido.tsx src/components/pedido/ResumenPedido.test.tsx
git commit -m "feat: reemplaza el campo libre de transportadora por un selector"
```

---

### Task 4: Conectar la consulta al formulario de pedido

**Files:**
- Modify: `src/app/(app)/pedidos/nuevo/page.tsx`
- Modify: `src/app/(app)/pedidos/nuevo/FormularioPedido.tsx`

**Interfaces:**
- Consumes: `listarTransportadorasActivas()` (Task 2), prop `transportadoras`
  de `ResumenPedido` (Task 3).
- Produces: `FormularioPedido` recibe una prop nueva `transportadoras: { id: string; nombre: string }[]` y la reenvía a `ResumenPedido`.

No hay paso de prueba unitaria aquí: es cableado de props entre un Server
Component y sus hijos, ya cubierto por las pruebas de Task 3 (que reciben la
prop directamente) y por la prueba end-to-end de Task 5 (que ejercita el
cableado real). Verificación manual en Step 2.

- [ ] **Step 1: Traer la consulta en la página y pasarla al formulario**

```typescript
// src/app/(app)/pedidos/nuevo/page.tsx — reemplaza el archivo completo
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
```

```typescript
// src/app/(app)/pedidos/nuevo/FormularioPedido.tsx
// Cambiar la línea de Props (línea 24):
interface Props {
  productos: Producto[]
  transportadoras: { id: string; nombre: string }[]
  valorDomicilioDefault: number
}

// Cambiar la firma del componente (línea 26):
export function FormularioPedido({ productos, transportadoras, valorDomicilioDefault }: Props) {

// Y en el JSX, pasar la prop a ResumenPedido (dentro del bloque que ya arma
// sus props, junto a `tipoEntrega={tipoEntrega} transportadora={transportadora}`):
              tipoEntrega={tipoEntrega} transportadora={transportadora}
              transportadoras={transportadoras}
```

- [ ] **Step 2: Verificar a mano en el navegador**

Con el stack local levantado (`npx supabase start`) y el dev server corriendo
(`npm run dev`), entrar a `/pedidos/nuevo`, escoger un cliente, marcar entrega
"Nacional" y confirmar que el desplegable muestra Interrapidísimo,
Servientrega, TCC, Coordinadora y "Otra…", y que elegir "Otra…" revela el
campo de texto.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(app)/pedidos/nuevo/page.tsx" "src/app/(app)/pedidos/nuevo/FormularioPedido.tsx"
git commit -m "feat: conecta el catálogo de transportadoras al formulario de pedido"
```

---

### Task 5: Prueba end-to-end del camino nacional

**Files:**
- Modify: `e2e/pedido-completo.spec.ts`

**Interfaces:**
- Consumes: la pantalla `/pedidos/nuevo` ya cableada (Task 4).

- [ ] **Step 1: Agregar los dos casos al final de `e2e/pedido-completo.spec.ts`**

Cada test inicia sesión y crea su propio cliente, igual que el test ya
existente en este archivo — un e2e no comparte estado entre tests.

```typescript
test('pedido nacional con transportadora de la lista', async ({ page }) => {
  const nombreCliente = `Cliente Prueba Transportadora ${Date.now().toString().slice(-6)}`

  await page.goto('/ingresar')
  await page.getByLabel('Correo electrónico').fill(process.env.E2E_CORREO!)
  await page.getByLabel('Contraseña').fill(process.env.E2E_CLAVE!)
  await page.getByRole('button', { name: 'Iniciar sesión' }).click()
  await expect(page).toHaveURL(/\/pedidos\/nuevo/)

  await page.getByPlaceholder(/Buscar cliente/).fill(nombreCliente)
  await page.getByText(/Crear cliente nuevo/).click()
  await page.getByPlaceholder('Teléfono').fill('3124567890')
  await page.getByPlaceholder('Dirección').fill('Cra 45 # 23-18')
  await page.getByPlaceholder('Barrio').fill('La Floresta')
  await page.getByPlaceholder('Ciudad').fill('Medellín')
  await page.getByRole('button', { name: 'Guardar y usar' }).click()
  await expect(page.getByText(nombreCliente)).toBeVisible()

  await page.getByRole('button', { name: /^Vainilla/ }).click()

  await page.getByRole('button', { name: 'Nacional' }).click()

  // Cubre lo que la prueba de integración de la Task 2 no puede probar en
  // Node: que `listarTransportadorasActivas()` de verdad llega al
  // desplegable, con la semilla completa y en el orden sembrado.
  const opciones = await page.getByLabel('Transportadora').locator('option').allTextContents()
  expect(opciones).toEqual([
    'Selecciona transportadora…', 'Interrapidísimo', 'Servientrega', 'TCC', 'Coordinadora', 'Otra…',
  ])

  await page.getByLabel('Transportadora').selectOption({ label: 'Servientrega' })
  await page.getByRole('button', { name: /Generar recibo/ }).click()

  await expect(page).toHaveURL(/\/pedidos\/.+\/documentos/)
  // El recibo (pestaña por defecto) muestra la transportadora; el rótulo
  // nacional, a propósito, no — lo lee la propia transportadora (§7.3 del
  // diseño original), así que no repite ahí su propio nombre.
  await expect(page.getByText('Servientrega')).toBeVisible()
})

test('pedido nacional con transportadora "Otra"', async ({ page }) => {
  const nombreCliente = `Cliente Prueba Transportadora Otra ${Date.now().toString().slice(-6)}`

  await page.goto('/ingresar')
  await page.getByLabel('Correo electrónico').fill(process.env.E2E_CORREO!)
  await page.getByLabel('Contraseña').fill(process.env.E2E_CLAVE!)
  await page.getByRole('button', { name: 'Iniciar sesión' }).click()
  await expect(page).toHaveURL(/\/pedidos\/nuevo/)

  await page.getByPlaceholder(/Buscar cliente/).fill(nombreCliente)
  await page.getByText(/Crear cliente nuevo/).click()
  await page.getByPlaceholder('Teléfono').fill('3124567890')
  await page.getByPlaceholder('Dirección').fill('Cra 45 # 23-18')
  await page.getByPlaceholder('Barrio').fill('La Floresta')
  await page.getByPlaceholder('Ciudad').fill('Medellín')
  await page.getByRole('button', { name: 'Guardar y usar' }).click()
  await expect(page.getByText(nombreCliente)).toBeVisible()

  await page.getByRole('button', { name: /^Vainilla/ }).click()

  await page.getByRole('button', { name: 'Nacional' }).click()
  await page.getByLabel('Transportadora').selectOption({ label: 'Otra…' })
  await page.getByPlaceholder('Nombre de la transportadora').fill('Envíos del Valle')
  await page.getByRole('button', { name: /Generar recibo/ }).click()

  await expect(page).toHaveURL(/\/pedidos\/.+\/documentos/)
  // Igual que en el caso anterior: la transportadora sale en el recibo,
  // nunca en el rótulo nacional (§7.3 del diseño original).
  await expect(page.getByText('Envíos del Valle')).toBeVisible()
})
```

- [ ] **Step 2: Ejecutar y verificar que pasan**

Con el dev server corriendo contra el Supabase local:

Run: `npm run test:e2e -- pedido-completo`
Expected: PASS, incluidos los dos casos nuevos.

- [ ] **Step 3: Commit**

```bash
git add e2e/pedido-completo.spec.ts
git commit -m "test: cubre el pedido nacional con transportadora de lista y libre"
```

---

## Resumen de lo que queda operable al terminar

Un pedido nacional se toma escogiendo la transportadora de un desplegable
sembrado con las cuatro que el negocio usa hoy, con "Otra…" como válvula de
escape. El recibo y el rótulo siguen mostrando lo mismo que antes — solo
cambió cómo se captura el dato, no cómo se imprime.
