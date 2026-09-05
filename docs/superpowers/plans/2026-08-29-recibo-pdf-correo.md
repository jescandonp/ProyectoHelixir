# Recibo en PDF y envío por correo — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Un cliente puede tener correo registrado; el pedido lo congela al confirmarse; y desde `/pedidos/[id]/documentos` se puede descargar el recibo en PDF o enviarlo por correo con Resend.

**Architecture:** Correo nuevo, opcional, en `clientes` — validado por formato con un módulo puro reusado en los dos formularios que lo capturan. El pedido congela `cliente_correo` al confirmarse, igual que ya hace con nombre/teléfono/cédula. El PDF del recibo se genera con `@react-pdf/renderer` (la misma librería que ya trajo el plan de exportación, sin navegador headless), a través de una ruta HTTP de descarga (mismo patrón que `/api/pedidos/exportar`). El envío es una acción de servidor que arma el correo con una función pura testable por separado, y lo despacha con el SDK `resend`, leyendo la API key de una variable de entorno — sin pasar por el marketplace de Vercel, porque el negocio ya la creó directamente en Resend.

**Tech Stack:** Next.js Route Handlers y Server Actions, `resend`, `@react-pdf/renderer` (ya instalado por el plan de exportación), Vitest, Playwright.

## Global Constraints

- Ninguna función que use `crearClienteServidor()` (y por lo tanto `next/headers`) se puede llamar directamente desde una prueba de Vitest — solo desde una petición real de Next.js. Donde el diseño pedía una prueba de integración sobre una de esas funciones y no hay una función pura equivalente que extraer, este plan lo dice explícitamente y mueve esa verificación a comprobación manual y/o a la prueba end-to-end.
- **No se envían correos reales durante las pruebas.** Toda prueba automatizada que toque el envío simula el SDK de Resend (`vi.mock('resend')`); nunca llama a la API real. Enviar de verdad se verifica a mano (Task 11, Step 3, y Task 12, Step 2).
- Mientras la cuenta de Resend del negocio siga en el dominio de pruebas (`onboarding@resend.dev`), el correo solo llega a la casilla dueña de esa cuenta, nunca a un cliente real. Es una limitación de Resend, no de este código — ver Task 1.
- El correo del cliente es **opcional**: nunca se exige para crear o guardar un cliente. Si se escribe algo, debe tener formato de correo válido.
- `RESEND_API_KEY` y `RESEND_FROM_EMAIL` son variables de servidor: **nunca** llevan el prefijo `NEXT_PUBLIC_` (no deben llegar al bundle del navegador).

---

### Task 1: Instalar `resend` y documentar las variables de entorno

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `.env.example`

- [ ] **Step 1: Instalar el SDK**

Run: `npm install resend`
Expected: `package.json` gana una entrada nueva en `dependencies`.

- [ ] **Step 2: Documentar las variables nuevas en `.env.example`**

Agregar al final de `.env.example`:

```
# --- Solo local/producción, nunca con prefijo NEXT_PUBLIC ---
# La API key de la cuenta de Resend del negocio (creada directamente en
# Resend, no vía el marketplace de Vercel). Sin dominio propio verificado en
# Resend, el correo solo llega a la casilla dueña de esa cuenta — no a
# clientes reales.
RESEND_API_KEY=

# Remitente de los correos. Si se deja vacío, el código usa
# onboarding@resend.dev (el dominio de pruebas de Resend). Cambiar aquí
# cuando se verifique un dominio propio — no hace falta tocar código.
RESEND_FROM_EMAIL=
```

- [ ] **Step 3: Configurar la clave real en el entorno local (manual, no se automatiza)**

Agregar `RESEND_API_KEY=<la clave real de tu cuenta de Resend>` a
`.env.local` (que no se versiona). Este paso lo hace quien ejecuta el plan,
con su propia clave — no se escribe ningún secreto real en el repositorio.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json .env.example
git commit -m "chore: agrega el SDK de resend y documenta sus variables de entorno"
```

---

### Task 2: Migración — correo en clientes, congelado en pedidos

**Files:**
- Create: `supabase/migrations/0006_correo_cliente.sql`

**Interfaces:**
- Produces: columna `clientes.correo text` (nullable); columna
  `pedidos.cliente_correo text` (nullable, copia congelada — mismo patrón que
  `cliente_nombre`, `cliente_telefono`, `cliente_cedula`).

- [ ] **Step 1: Escribir la migración**

```sql
alter table clientes add column correo text;
alter table pedidos add column cliente_correo text;
```

- [ ] **Step 2: Aplicar contra el Supabase local**

Requiere Docker Desktop abierto y el stack local levantado.

Run: `npx supabase db reset`
Expected: termina en `Finished supabase db reset` sin errores; reaplica las
seis migraciones (`0001` a `0006`).

- [ ] **Step 3: Verificar a mano**

Run: `npx supabase db query --local "select column_name from information_schema.columns where table_name = 'clientes' and column_name = 'correo'"`
Expected: una fila, `correo`.

Run: `npx supabase db query --local "select column_name from information_schema.columns where table_name = 'pedidos' and column_name = 'cliente_correo'"`
Expected: una fila, `cliente_correo`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0006_correo_cliente.sql
git commit -m "feat: agrega correo en clientes y su copia congelada en pedidos"
```

---

### Task 3: `correoValido` — validación pura de formato

**Files:**
- Create: `src/lib/clientes/validacion.ts`
- Test: `src/lib/clientes/validacion.test.ts`

**Interfaces:**
- Produces: `correoValido(texto: string): boolean`, exportada desde
  `src/lib/clientes/validacion.ts`. La usan `crearCliente` y
  `actualizarCliente` (Task 4) y los dos formularios (Tasks 6 y 7).

- [ ] **Step 1: Escribir la prueba (falla primero)**

```typescript
// src/lib/clientes/validacion.test.ts
import { describe, it, expect } from 'vitest'
import { correoValido } from './validacion'

describe('correoValido', () => {
  it('acepta un correo con formato normal', () => {
    expect(correoValido('cliente@correo.com')).toBe(true)
  })

  it('acepta subdominios y sufijos largos', () => {
    expect(correoValido('pedidos@mail.minegocio.com.co')).toBe(true)
  })

  it('rechaza sin arroba', () => {
    expect(correoValido('cliente-correo.com')).toBe(false)
  })

  it('rechaza sin dominio', () => {
    expect(correoValido('cliente@')).toBe(false)
  })

  it('rechaza con espacios', () => {
    expect(correoValido('cliente @correo.com')).toBe(false)
  })

  it('rechaza vacío', () => {
    expect(correoValido('')).toBe(false)
    expect(correoValido('   ')).toBe(false)
  })
})
```

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `npm test -- validacion`
Expected: FAIL — `Cannot find module './validacion'`.

- [ ] **Step 3: Implementar**

```typescript
// src/lib/clientes/validacion.ts
const FORMATO_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Formato básico: algo@algo.algo, sin espacios. No valida que el dominio
 *  exista de verdad — eso solo se sabe al intentar enviar. */
export function correoValido(texto: string): boolean {
  return FORMATO_CORREO.test(texto.trim())
}
```

- [ ] **Step 4: Ejecutar y verificar que pasan**

Run: `npm test -- validacion`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/clientes/validacion.ts src/lib/clientes/validacion.test.ts
git commit -m "feat: agrega correoValido"
```

---

### Task 4: Correo en el modelo y el repositorio de clientes

**Files:**
- Modify: `src/lib/tipos.ts`
- Modify: `src/lib/db/clientes.ts`
- Modify: `src/lib/db/clientes.integracion.test.ts`

**Interfaces:**
- Produces: `Cliente.correo: string | null` (tipo); `crearCliente` y
  `actualizarCliente` reciben y persisten `correo: string`.

`crearCliente` y `actualizarCliente` usan `crearClienteServidor()`, así que
no se pueden llamar directamente desde Vitest (ver `Global Constraints`).
Que el formato se valida ya quedó cubierto por la prueba pura de la Task 3;
que el valor persiste de verdad se verifica con la prueba end-to-end de la
Task 12. Esta tarea sí añade una prueba de integración, pero sobre el
congelamiento en `pedidos` (que no depende de esas funciones), extendiendo
la que ya existe.

- [ ] **Step 1: Agregar `correo` al tipo `Cliente`**

```typescript
// src/lib/tipos.ts — dentro de la interfaz Cliente, después de `cedula`:
  correo: string | null
```

- [ ] **Step 2: Agregar `correo` al repositorio de clientes**

En `src/lib/db/clientes.ts`:

```typescript
// Cambiar CAMPOS (línea 7-11 del archivo actual):
const CAMPOS = `
  id, codigo, nombre, telefono, cedula, correo, tipo, notas,
  direcciones ( id, cliente_id, etiqueta, linea, barrio, ciudad,
                departamento, indicaciones, es_principal )
`
```

```typescript
// Agregar el import de la validación, junto a los demás imports:
import { correoValido } from '@/lib/clientes/validacion'
```

```typescript
// Cambiar mapearCliente (línea 42-49):
function mapearCliente(f: any): Cliente {
  return {
    id: f.id, codigo: f.codigo, nombre: f.nombre, telefono: f.telefono,
    cedula: f.cedula, correo: f.correo, tipo: f.tipo, notas: f.notas,
    direcciones: (f.direcciones ?? []).map(mapearDireccion),
  }
}
```

```typescript
// Cambiar crearCliente (línea 95-101, la firma y el inicio del cuerpo):
export async function crearCliente(
  datos: { nombre: string; telefono: string; cedula: string; correo: string; tipo: TipoCliente },
  direccion: {
    linea: string; barrio: string; ciudad: string
    departamento: string; indicaciones: string
  },
): Promise<Cliente> {
  const supabase = await crearClienteServidor()

  if (datos.correo.trim() && !correoValido(datos.correo.trim())) {
    throw new Error('El correo no tiene un formato válido')
  }

  const { data: cliente, error } = await supabase
    .from('clientes')
    .insert({
      nombre: datos.nombre.trim(),
      telefono: datos.telefono.trim() || null,
      cedula: datos.cedula.trim() || null,
      correo: datos.correo.trim() || null,
      tipo: datos.tipo,
    })
    .select('id')
    .single()
```

```typescript
// Cambiar actualizarCliente (línea 175-194) completa:
export async function actualizarCliente(
  id: string,
  datos: {
    nombre: string; telefono: string; cedula: string; correo: string
    tipo: TipoCliente; notas: string
  },
): Promise<void> {
  const supabase = await crearClienteServidor()
  if (!datos.nombre.trim()) throw new Error('El cliente necesita un nombre')
  if (datos.correo.trim() && !correoValido(datos.correo.trim())) {
    throw new Error('El correo no tiene un formato válido')
  }

  const { error } = await supabase
    .from('clientes')
    .update({
      nombre: datos.nombre.trim(),
      telefono: datos.telefono.trim() || null,
      cedula: datos.cedula.trim() || null,
      correo: datos.correo.trim() || null,
      tipo: datos.tipo,
      notas: datos.notas.trim() || null,
    })
    .eq('id', id)

  if (error) throw new Error(`No se pudo guardar el cliente: ${error.message}`)
}
```

- [ ] **Step 3: Verificar que el resto del archivo sigue compilando**

Run: `npm run build`
Expected: build exitoso — confirma que los tipos nuevos no rompieron ningún
otro punto donde se llame a `crearCliente`/`actualizarCliente` (esos
llamadores se actualizan en las Tasks 6 y 7; si el build falla aquí es
esperado hasta completarlas — este paso es solo para confirmar que el error,
si aparece, es exactamente "falta la propiedad `correo`" en esos dos sitios,
no algo distinto).

- [ ] **Step 4: Extender la prueba de integración del congelamiento**

Agregar al final de `src/lib/db/clientes.integracion.test.ts`, dentro de un
nuevo `it` en el mismo `describe`:

```typescript
  it('el correo tampoco se reescribe en un pedido confirmado', async () => {
    const { data: cliente } = await supabase
      .from('clientes')
      .insert({ nombre: 'Nombre Viejo', correo: 'viejo@correo.com' })
      .select('id, codigo').single()

    try {
      const { data: pedido } = await supabase
        .from('pedidos')
        .insert({
          cliente_id: cliente!.id,
          estado: 'confirmado',
          cliente_nombre: 'Nombre Viejo',
          cliente_codigo: cliente!.codigo,
          cliente_correo: 'viejo@correo.com',
          dir_ciudad: 'Medellín',
          total: 50000,
        })
        .select('id').single()
      await supabase.rpc('asignar_consecutivo', { p_pedido_id: pedido!.id })

      await supabase
        .from('clientes')
        .update({ correo: 'nuevo@correo.com' })
        .eq('id', cliente!.id)

      const { data: despues } = await supabase
        .from('pedidos')
        .select('cliente_correo')
        .eq('id', pedido!.id).single()

      expect(despues!.cliente_correo).toBe('viejo@correo.com')
    } finally {
      await limpiarClienteDePrueba(cliente!.id)
    }
  }, 30000)
```

- [ ] **Step 5: Ejecutar y verificar que pasa**

Run: `npm run test:integracion -- clientes`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/tipos.ts src/lib/db/clientes.ts src/lib/db/clientes.integracion.test.ts
git commit -m "feat: agrega correo al modelo de cliente, validado y congelable"
```

---

### Task 5: Congelar el correo al confirmar el pedido

**Files:**
- Modify: `src/lib/db/pedidos.ts`
- Modify: `src/components/documentos/Recibo.test.tsx`
- Modify: `src/components/documentos/Rotulos.test.tsx`

**Interfaces:**
- Produces: `PedidoCompleto.clienteCorreo: string | null` (tipo nuevo en la
  interfaz ya existente, **requerido, no opcional** — igual que
  `clienteCedula` y `clienteTelefono`). `confirmarPedido` copia
  `clientes.correo` a `pedidos.cliente_correo`; `obtenerPedido` lo lee y lo
  mapea.

No hay prueba nueva en esta tarea: el congelamiento ya quedó cubierto por la
prueba de integración de la Task 4 (que inserta las columnas directamente,
sin pasar por `confirmarPedido`, por la misma restricción de `next/headers`).
Esta tarea cablea el mismo comportamiento dentro de la función real; se
verifica con el build y con la prueba end-to-end de la Task 12.

Como `clienteCorreo` pasa a ser un campo requerido de `PedidoCompleto`, los
dos archivos de prueba que ya construyen un objeto `PedidoCompleto` completo
a mano dejan de compilar hasta que se les agregue el campo — no es opcional
arreglarlo después, es parte de esta misma tarea (Step 4).

- [ ] **Step 1: Agregar el campo a `PedidoCompleto`**

```typescript
// src/lib/db/pedidos.ts — dentro de la interfaz PedidoCompleto, después de
// `clienteCedula: string | null`:
  clienteCorreo: string | null
```

- [ ] **Step 2: Congelar el correo en `confirmarPedido`**

```typescript
// Cambiar el select de confirmarPedido (dentro de la función, la línea que
// hoy dice):
    .select('*, pedido_items(*), clientes(codigo, nombre, telefono, cedula), direcciones(*)')
// por:
    .select('*, pedido_items(*), clientes(codigo, nombre, telefono, cedula, correo), direcciones(*)')
```

```typescript
// Y en el `.update(...)` de confirmarPedido, agregar la línea después de
// `cliente_cedula: pedido.clientes.cedula,`:
      cliente_correo: pedido.clientes.correo,
```

- [ ] **Step 3: Leer el correo en `obtenerPedido`**

```typescript
// Dentro del objeto que retorna obtenerPedido, agregar después de
// `clienteCedula: data.cliente_cedula,`:
    clienteCorreo: data.cliente_correo,
```

- [ ] **Step 4: Actualizar los fixtures de prueba que ya construyen un `PedidoCompleto`**

```typescript
// src/components/documentos/Recibo.test.tsx — agregar el campo al objeto
// `pedido` ya existente, junto a `clienteCedula`:
  clienteTelefono: '312 456 7890', clienteCedula: '1017456789', clienteCorreo: null,
```

```typescript
// src/components/documentos/Rotulos.test.tsx — agregar el campo al objeto
// `base` ya existente, junto a `clienteCedula`:
  clienteTelefono: '312 456 7890', clienteCedula: '1017456789', clienteCorreo: null,
```

- [ ] **Step 5: Verificar que todo compila y las pruebas existentes siguen pasando**

Run: `npm run build`
Expected: build exitoso.

Run: `npm test -- Recibo Rotulos`
Expected: PASS — ninguna aserción de estos archivos depende de
`clienteCorreo`, así que agregarlo no cambia lo que ya verificaban.

- [ ] **Step 6: Commit**

```bash
git add src/lib/db/pedidos.ts src/components/documentos/Recibo.test.tsx src/components/documentos/Rotulos.test.tsx
git commit -m "feat: congela el correo del cliente al confirmar el pedido"
```

---

### Task 6: Campo de correo en la creación rápida de cliente

**Files:**
- Modify: `src/components/pedido/BuscadorCliente.tsx`

**Interfaces:**
- Consumes: `crearCliente` con la firma nueva de la Task 4, `correoValido`
  de `@/lib/clientes/validacion`.

- [ ] **Step 1: Agregar el campo al formulario y a la validación previa**

```typescript
// Cambiar FORM_VACIO (línea 11-14):
const FORM_VACIO = {
  nombre: '', telefono: '', cedula: '', correo: '',
  linea: '', barrio: '', ciudad: '', departamento: '', indicaciones: '',
}
```

```typescript
// Agregar el import, junto a los demás:
import { correoValido } from '@/lib/clientes/validacion'
```

```typescript
// Cambiar la función guardar (línea 37-57): validar antes de llamar a
// crearCliente, y pasar form.correo:
  async function guardar(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (form.correo.trim() && !correoValido(form.correo.trim())) {
      setError('El correo no tiene un formato válido')
      return
    }
    setGuardando(true)
    try {
      const cliente = await crearCliente(
        { nombre: form.nombre, telefono: form.telefono, cedula: form.cedula, correo: form.correo, tipo: 'detal' },
        {
          linea: form.linea, barrio: form.barrio, ciudad: form.ciudad,
          departamento: form.departamento, indicaciones: form.indicaciones,
        },
      )
      setCreando(false)
      setTexto('')
      onSeleccionar(cliente)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo crear el cliente')
    } finally {
      setGuardando(false)
    }
  }
```

```tsx
// Agregar el campo, dentro del grid de teléfono/cédula (línea 69-76),
// como una fila nueva debajo:
        <div className="grid gap-3 sm:grid-cols-2">
          <input placeholder="Teléfono" value={form.telefono}
            onChange={(e) => setForm({ ...form, telefono: e.target.value })}
            className={`${CAMPO} bg-tarjeta`} />
          <input placeholder="Cédula (opcional)" value={form.cedula}
            onChange={(e) => setForm({ ...form, cedula: e.target.value })}
            className={`${CAMPO} bg-tarjeta`} />
        </div>
        <input type="email" placeholder="Correo (opcional)" value={form.correo}
          onChange={(e) => setForm({ ...form, correo: e.target.value })}
          className={`${CAMPO} bg-tarjeta`} />
```

- [ ] **Step 2: Verificar que compila**

Run: `npm run build`
Expected: build exitoso.

- [ ] **Step 3: Verificar a mano**

Con el stack local y el dev server corriendo, crear un cliente nuevo desde
`/pedidos/nuevo` con un correo mal escrito (por ejemplo `sin-arroba.com`):
debe salir el aviso y no crear el cliente. Con un correo válido, debe crear
el cliente normalmente.

- [ ] **Step 4: Commit**

```bash
git add src/components/pedido/BuscadorCliente.tsx
git commit -m "feat: agrega el campo correo a la creación rápida de cliente"
```

---

### Task 7: Campo de correo en la ficha editable de cliente

**Files:**
- Modify: `src/app/(app)/clientes/[id]/FichaCliente.tsx`

**Interfaces:**
- Consumes: `actualizarCliente` con la firma nueva de la Task 4,
  `correoValido` de `@/lib/clientes/validacion`.

- [ ] **Step 1: Agregar el campo al estado y al formulario**

```typescript
// Cambiar el estado inicial `datos` (línea 38-44):
  const [datos, setDatos] = useState({
    nombre: cliente.nombre,
    telefono: cliente.telefono ?? '',
    cedula: cliente.cedula ?? '',
    correo: cliente.correo ?? '',
    tipo: cliente.tipo,
    notas: cliente.notas ?? '',
  })
```

```typescript
// Agregar el import, junto a los demás:
import { correoValido } from '@/lib/clientes/validacion'
```

```typescript
// Cambiar el botón "Guardar" (línea 139-143): validar antes de ejecutar.
        <button type="button" disabled={pendiente}
          onClick={() => {
            if (datos.correo.trim() && !correoValido(datos.correo.trim())) {
              setError('El correo no tiene un formato válido')
              return
            }
            ejecutar(() => actualizarCliente(cliente.id, datos), 'Guardado')
          }}
          className={`${BOTON_PRIMARIO} mt-4`}>
          Guardar
        </button>
```

```tsx
// Dentro del grid de "Datos del cliente", insertar esta etiqueta justo
// después de que cierra el bloque de Teléfono (después de la línea
// `<input value={datos.telefono} ... className={CAMPO} />` seguida de
// `</label>`, línea 107 del archivo actual) y antes del bloque de Cédula:
          <label className="block">
            <span className={ETIQUETA}>Correo</span>
            <input type="email" value={datos.correo}
              onChange={(e) => cambiarDatos({ correo: e.target.value })}
              className={CAMPO} />
          </label>
```

- [ ] **Step 2: Verificar que compila**

Run: `npm run build`
Expected: build exitoso.

- [ ] **Step 3: Verificar a mano**

En `/clientes/[id]` de un cliente existente, agregar un correo válido y
guardar; recargar la página y confirmar que el campo sigue lleno. Escribir
un correo inválido y confirmar que "Guardar" muestra el error sin llamar al
servidor (el cliente no cambia).

- [ ] **Step 4: Commit**

```bash
git add "src/app/(app)/clientes/[id]/FichaCliente.tsx"
git commit -m "feat: agrega el campo correo a la ficha editable de cliente"
```

---

### Task 8: `lib/correo/resend.ts` — envío con adjunto

**Files:**
- Create: `src/lib/correo/resend.ts`
- Test: `src/lib/correo/resend.test.ts`

**Interfaces:**
- Produces: `interface CorreoConAdjunto { destinatario: string; asunto: string; textoPlano: string; adjunto: { nombreArchivo: string; contenido: Buffer } }`
  y `async function enviarCorreoConAdjunto(datos: CorreoConAdjunto): Promise<void>`,
  exportados desde `src/lib/correo/resend.ts`.

- [ ] **Step 1: Escribir las pruebas (fallan primero, simulando el SDK)**

```typescript
// src/lib/correo/resend.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

// `vi.mock` se sube (hoist) al principio del archivo automáticamente en
// Vitest, así que este mock aplica también al `import` de más abajo aunque
// aparezca antes en el código fuente.
const enviarMock = vi.fn()

vi.mock('resend', () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: { send: enviarMock },
  })),
}))

import { enviarCorreoConAdjunto } from './resend'

describe('enviarCorreoConAdjunto', () => {
  beforeEach(() => {
    enviarMock.mockReset()
    process.env.RESEND_API_KEY = 'clave-de-prueba'
    delete process.env.RESEND_FROM_EMAIL
  })

  it('envía con el remitente por defecto cuando no hay RESEND_FROM_EMAIL', async () => {
    enviarMock.mockResolvedValue({ data: { id: 'abc' }, error: null })

    await enviarCorreoConAdjunto({
      destinatario: 'cliente@correo.com',
      asunto: 'Recibo de tu pedido PED-000148',
      textoPlano: 'Hola',
      adjunto: { nombreArchivo: 'PED-000148.pdf', contenido: Buffer.from('contenido') },
    })

    expect(enviarMock).toHaveBeenCalledWith({
      from: 'onboarding@resend.dev',
      to: 'cliente@correo.com',
      subject: 'Recibo de tu pedido PED-000148',
      text: 'Hola',
      attachments: [{ filename: 'PED-000148.pdf', content: Buffer.from('contenido') }],
    })
  })

  it('usa RESEND_FROM_EMAIL cuando está configurado', async () => {
    process.env.RESEND_FROM_EMAIL = 'pedidos@minegocio.com'
    enviarMock.mockResolvedValue({ data: { id: 'abc' }, error: null })

    await enviarCorreoConAdjunto({
      destinatario: 'cliente@correo.com', asunto: 'Asunto', textoPlano: 'Texto',
      adjunto: { nombreArchivo: 'a.pdf', contenido: Buffer.from('x') },
    })

    expect(enviarMock).toHaveBeenCalledWith(expect.objectContaining({ from: 'pedidos@minegocio.com' }))
  })

  it('lanza un error legible cuando Resend responde con error', async () => {
    enviarMock.mockResolvedValue({ data: null, error: { message: 'dominio no verificado' } })

    await expect(enviarCorreoConAdjunto({
      destinatario: 'cliente@correo.com', asunto: 'Asunto', textoPlano: 'Texto',
      adjunto: { nombreArchivo: 'a.pdf', contenido: Buffer.from('x') },
    })).rejects.toThrow('dominio no verificado')
  })

  it('lanza si falta RESEND_API_KEY', async () => {
    delete process.env.RESEND_API_KEY
    await expect(enviarCorreoConAdjunto({
      destinatario: 'cliente@correo.com', asunto: 'Asunto', textoPlano: 'Texto',
      adjunto: { nombreArchivo: 'a.pdf', contenido: Buffer.from('x') },
    })).rejects.toThrow('RESEND_API_KEY')
  })
})
```

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `npm test -- resend`
Expected: FAIL — `Cannot find module './resend'`.

- [ ] **Step 3: Implementar**

```typescript
// src/lib/correo/resend.ts
import { Resend } from 'resend'

const REMITENTE_POR_DEFECTO = 'onboarding@resend.dev'

export interface CorreoConAdjunto {
  destinatario: string
  asunto: string
  textoPlano: string
  adjunto: { nombreArchivo: string; contenido: Buffer }
}

export async function enviarCorreoConAdjunto(datos: CorreoConAdjunto): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) throw new Error('Falta configurar RESEND_API_KEY')

  const resend = new Resend(apiKey)
  const remitente = process.env.RESEND_FROM_EMAIL || REMITENTE_POR_DEFECTO

  const { error } = await resend.emails.send({
    from: remitente,
    to: datos.destinatario,
    subject: datos.asunto,
    text: datos.textoPlano,
    attachments: [{ filename: datos.adjunto.nombreArchivo, content: datos.adjunto.contenido }],
  })

  if (error) throw new Error(`No se pudo enviar el correo: ${error.message}`)
}
```

- [ ] **Step 4: Ejecutar y verificar que pasan**

Run: `npm test -- resend`
Expected: PASS, las 4 pruebas.

- [ ] **Step 5: Commit**

```bash
git add src/lib/correo/resend.ts src/lib/correo/resend.test.ts
git commit -m "feat: agrega enviarCorreoConAdjunto sobre el SDK de Resend"
```

---

### Task 9: `construirCorreoRecibo` — el mensaje, como función pura

**Files:**
- Create: `src/lib/correo/recibo.ts`
- Test: `src/lib/correo/recibo.test.ts`

**Interfaces:**
- Consumes: `PedidoCompleto` de `@/lib/db/pedidos`, `Ajustes` de
  `@/lib/db/ajustes`, `CorreoConAdjunto` de `@/lib/correo/resend` (Task 8).
- Produces: `construirCorreoRecibo(pedido: PedidoCompleto, ajustes: Ajustes, pdf: Buffer): CorreoConAdjunto`,
  exportada desde `src/lib/correo/recibo.ts`.

Separar el armado del mensaje (esta tarea, pura, sin I/O) de mandarlo de
verdad (Task 11, que sí necesita `next/headers`) es lo que permite probar la
parte que importa —a quién, con qué asunto, con qué adjunto— sin tocar la
restricción de `crearClienteServidor()` ni enviar un correo real.

- [ ] **Step 1: Escribir las pruebas (fallan primero)**

```typescript
// src/lib/correo/recibo.test.ts
import { describe, it, expect } from 'vitest'
import { construirCorreoRecibo } from './recibo'
import type { PedidoCompleto } from '@/lib/db/pedidos'
import type { Ajustes } from '@/lib/db/ajustes'

const ajustes: Ajustes = {
  nombreNegocio: 'MI NEGOCIO', eslogan: 'Helado Artesanal', logoUrl: null,
  telefonos: '305 724 10 22', datosPago: 'Nequi 305 724 10 22',
  prefijoConsecutivo: 'PED', valorDomicilioDefault: 8000,
  etiquetaAnchoMm: 100, etiquetaAltoMm: 150, pieRecibo: 'Gracias por su compra',
}

const pedido: PedidoCompleto = {
  id: 'p1', consecutivo: 'PED-000148', fecha: '2026-08-11T21:17:00.000Z',
  estado: 'confirmado', estadoPago: 'pendiente', tipoEntrega: 'local',
  transportadora: null, fechaPago: null,
  clienteCodigo: 'CL-0042', clienteNombre: 'Juanito González',
  clienteTelefono: '312 456 7890', clienteCedula: '1017456789',
  clienteCorreo: 'juanito@correo.com',
  dirLinea: 'Cra 45 # 23-18', dirBarrio: 'La Floresta', dirCiudad: 'Medellín',
  dirDepartamento: 'Antioquia', dirIndicaciones: null,
  asesorCodigo: '002', valorDomicilio: 8000, descuento: 0,
  subtotal: 232000, total: 240000, totalKg: 10, observaciones: null,
  items: [],
}

const pdf = Buffer.from('contenido-del-pdf')

describe('construirCorreoRecibo', () => {
  it('arma el correo con el destinatario, asunto y adjunto correctos', () => {
    const correo = construirCorreoRecibo(pedido, ajustes, pdf)

    expect(correo.destinatario).toBe('juanito@correo.com')
    expect(correo.asunto).toBe('Recibo de tu pedido PED-000148 — MI NEGOCIO')
    expect(correo.adjunto).toEqual({ nombreArchivo: 'PED-000148.pdf', contenido: pdf })
    expect(correo.textoPlano).toContain('PED-000148')
    expect(correo.textoPlano).toContain('Gracias por su compra')
  })

  it('lanza si el pedido no tiene correo', () => {
    expect(() => construirCorreoRecibo({ ...pedido, clienteCorreo: null }, ajustes, pdf))
      .toThrow('Este cliente no tiene correo registrado')
  })
})
```

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `npm test -- correo/recibo`
Expected: FAIL — `Cannot find module './recibo'`.

- [ ] **Step 3: Implementar**

```typescript
// src/lib/correo/recibo.ts
import type { PedidoCompleto } from '@/lib/db/pedidos'
import type { Ajustes } from '@/lib/db/ajustes'
import type { CorreoConAdjunto } from './resend'

export function construirCorreoRecibo(
  pedido: PedidoCompleto,
  ajustes: Ajustes,
  pdf: Buffer,
): CorreoConAdjunto {
  if (!pedido.clienteCorreo) {
    throw new Error('Este cliente no tiene correo registrado')
  }

  return {
    destinatario: pedido.clienteCorreo,
    asunto: `Recibo de tu pedido ${pedido.consecutivo} — ${ajustes.nombreNegocio}`,
    textoPlano:
      `Hola ${pedido.clienteNombre}, adjunto el recibo de tu pedido ${pedido.consecutivo}.\n\n${ajustes.pieRecibo}`,
    adjunto: {
      nombreArchivo: `${pedido.consecutivo ?? pedido.id}.pdf`,
      contenido: pdf,
    },
  }
}
```

- [ ] **Step 4: Ejecutar y verificar que pasan**

Run: `npm test -- correo/recibo`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/correo/recibo.ts src/lib/correo/recibo.test.ts
git commit -m "feat: agrega construirCorreoRecibo"
```

---

### Task 10: El PDF del recibo

**Files:**
- Create: `src/lib/documentos/pdf/ReciboPdf.tsx`
- Test: `src/lib/documentos/pdf/ReciboPdf.test.tsx`

**Interfaces:**
- Consumes: `PedidoCompleto`, `Ajustes` (los mismos tipos que `Recibo.tsx`).
- Produces: `renderReciboPdf(pedido: PedidoCompleto, ajustes: Ajustes): Promise<Buffer>`,
  exportada desde `src/lib/documentos/pdf/ReciboPdf.tsx`.

La cédula va completa, sin máscara — igual que `Recibo.tsx` después del
plan de la cédula: este componente nace ya así, no necesita ese cambio por
separado.

- [ ] **Step 1: Escribir la prueba (falla primero)**

```typescript
// src/lib/documentos/pdf/ReciboPdf.test.tsx
import { describe, it, expect } from 'vitest'
import { renderReciboPdf } from './ReciboPdf'
import type { PedidoCompleto } from '@/lib/db/pedidos'
import type { Ajustes } from '@/lib/db/ajustes'

const ajustes: Ajustes = {
  nombreNegocio: 'MI NEGOCIO', eslogan: 'Helado Artesanal', logoUrl: null,
  telefonos: '305 724 10 22', datosPago: 'Nequi 305 724 10 22',
  prefijoConsecutivo: 'PED', valorDomicilioDefault: 8000,
  etiquetaAnchoMm: 100, etiquetaAltoMm: 150, pieRecibo: 'Gracias por su compra',
}

const pedido: PedidoCompleto = {
  id: 'p1', consecutivo: 'PED-000148', fecha: '2026-08-11T21:17:00.000Z',
  estado: 'confirmado', estadoPago: 'pendiente', tipoEntrega: 'nacional',
  transportadora: 'Servientrega', fechaPago: null,
  clienteCodigo: 'CL-0042', clienteNombre: 'Juanito González',
  clienteTelefono: '312 456 7890', clienteCedula: '1017456789',
  clienteCorreo: 'juanito@correo.com',
  dirLinea: 'Cra 45 # 23-18', dirBarrio: 'La Floresta', dirCiudad: 'Medellín',
  dirDepartamento: 'Antioquia', dirIndicaciones: 'Portería, timbre 302',
  asesorCodigo: '002', valorDomicilio: 8000, descuento: 0,
  subtotal: 232000, total: 240000, totalKg: 10, observaciones: 'Pago contraentrega',
  items: [
    { productoId: 'a', descripcion: 'Vainilla', cantidad: 4, precioUnitario: 22000, subtotal: 88000 },
    { productoId: 'b', descripcion: 'Maracuyá', cantidad: 4, precioUnitario: 25000, subtotal: 100000 },
  ],
}

describe('renderReciboPdf', () => {
  it('renderiza un PDF no vacío, pendiente de pago', async () => {
    const buffer = await renderReciboPdf(pedido, ajustes)
    expect(buffer.byteLength).toBeGreaterThan(0)
  })

  it('renderiza un PDF no vacío, ya pagado', async () => {
    const buffer = await renderReciboPdf(
      { ...pedido, estadoPago: 'pagado', fechaPago: '2026-08-11T22:00:00.000Z' }, ajustes,
    )
    expect(buffer.byteLength).toBeGreaterThan(0)
  })

  it('renderiza sin lanzar cuando faltan datos opcionales', async () => {
    const buffer = await renderReciboPdf(
      { ...pedido, clienteCedula: null, observaciones: null, transportadora: null }, ajustes,
    )
    expect(buffer.byteLength).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `npm test -- ReciboPdf`
Expected: FAIL — `Cannot find module './ReciboPdf'`.

- [ ] **Step 3: Implementar**

```tsx
// src/lib/documentos/pdf/ReciboPdf.tsx
import { Document, Page, View, Text, StyleSheet, renderToBuffer } from '@react-pdf/renderer'
import type { PedidoCompleto } from '@/lib/db/pedidos'
import type { Ajustes } from '@/lib/db/ajustes'
import { formatearPesos } from '@/lib/dinero'
import { valorEnLetras } from '@/lib/numero-a-letras'
import { formatearFechaCo } from '@/lib/fecha'

// 80mm de ancho, igual que el recibo térmico impreso, con un alto fijo
// generoso: a diferencia del CSS `@page { size: 80mm auto }` del recibo en
// pantalla, el `size` de una `Page` de react-pdf no admite alto automático.
// Si un recibo con muchos ítems no cabe, react-pdf sigue solo a una segunda
// página en vez de recortar contenido.
const TAMANO_PAGINA: [number, number] = [226.77, 707]

const estilos = StyleSheet.create({
  pagina: { paddingHorizontal: 14, paddingVertical: 16, fontSize: 8.5 },
  centro: { textAlign: 'center' },
  nombreNegocio: { fontSize: 13, fontWeight: 700 },
  eslogan: { fontSize: 9, fontWeight: 700, marginTop: 2 },
  linea: { marginVertical: 4, borderTopWidth: 1.5, borderTopColor: '#000000' },
  ordenNo: { fontSize: 11, fontWeight: 700, textAlign: 'center', marginVertical: 6 },
  filaDato: { flexDirection: 'row', marginBottom: 1 },
  etiquetaDato: { width: 50, fontWeight: 700 },
  encabezadoDetalle: {
    backgroundColor: '#000000', color: '#ffffff', textAlign: 'center',
    paddingVertical: 2, fontWeight: 700, marginVertical: 6,
  },
  filaItem: { flexDirection: 'row', justifyContent: 'space-between' },
  separador: { marginVertical: 6, borderTopWidth: 1, borderTopColor: '#000000', borderStyle: 'dashed' },
  filaTotalParcial: { flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 2 },
  total: {
    flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#000000',
    color: '#ffffff', paddingHorizontal: 6, paddingVertical: 4, marginVertical: 6, fontSize: 11, fontWeight: 700,
  },
  cajaPago: { borderWidth: 1.5, borderColor: '#000000', padding: 6, textAlign: 'center', marginTop: 6 },
})

function ReciboPdf({ pedido, ajustes }: { pedido: PedidoCompleto; ajustes: Ajustes }) {
  const pagado = pedido.estadoPago === 'pagado'

  return (
    <Document>
      <Page size={TAMANO_PAGINA} style={estilos.pagina}>
        <View style={estilos.centro}>
          <Text style={estilos.nombreNegocio}>{ajustes.nombreNegocio}</Text>
          <View style={estilos.linea} />
          <Text style={estilos.eslogan}>{ajustes.eslogan}</Text>
          <Text>PEDIDOS : {ajustes.telefonos}</Text>
        </View>

        <Text style={estilos.ordenNo}>ORDEN No. {pedido.consecutivo}</Text>

        <View style={estilos.filaDato}>
          <Text style={estilos.etiquetaDato}>Cliente:</Text><Text>{pedido.clienteNombre}</Text>
        </View>
        <View style={estilos.filaDato}>
          <Text style={estilos.etiquetaDato}>Fecha:</Text><Text>{formatearFechaCo(pedido.fecha)}</Text>
        </View>
        <View style={estilos.filaDato}>
          <Text style={estilos.etiquetaDato}>Cédula:</Text><Text>{pedido.clienteCedula ?? '—'}</Text>
        </View>
        <View style={estilos.filaDato}>
          <Text style={estilos.etiquetaDato}>Teléfono:</Text><Text>{pedido.clienteTelefono ?? '—'}</Text>
        </View>
        <View style={estilos.filaDato}>
          <Text style={estilos.etiquetaDato}>Asesor:</Text><Text>{pedido.asesorCodigo ?? '—'}</Text>
        </View>
        <View style={estilos.filaDato}>
          <Text style={estilos.etiquetaDato}>Envío:</Text>
          <Text>
            {pedido.tipoEntrega === 'local'
              ? 'Local · domicilio propio'
              : `Nacional · ${pedido.transportadora ?? ''}`}
          </Text>
        </View>
        <View style={estilos.filaDato}>
          <Text style={estilos.etiquetaDato}>Dirección:</Text>
          <Text>
            {pedido.dirLinea} — {[pedido.dirBarrio, pedido.dirCiudad].filter(Boolean).join(' · ')}
          </Text>
        </View>

        <Text style={estilos.encabezadoDetalle}>Detalle del Pedido</Text>
        <Text style={{ marginBottom: 4 }}>{pedido.totalKg} Kg · Helado Artesanal en tarro</Text>

        {pedido.items.map((item, i) => (
          <View key={i} style={{ marginBottom: 2 }}>
            <View style={estilos.filaItem}>
              <Text>{item.cantidad} {item.descripcion}</Text>
              <Text>{formatearPesos(item.subtotal)}</Text>
            </View>
            {item.cantidad > 1 && (
              <Text style={{ fontSize: 7 }}>
                {item.cantidad} kg × {formatearPesos(item.precioUnitario)}
              </Text>
            )}
          </View>
        ))}

        <View style={estilos.separador} />

        <View style={estilos.filaTotalParcial}>
          <Text>Subtotal: {formatearPesos(pedido.subtotal)}</Text>
        </View>
        <View style={estilos.filaTotalParcial}>
          <Text>Valor Domicilio: {formatearPesos(pedido.valorDomicilio)}</Text>
        </View>

        <View style={estilos.total}>
          <Text>TOTAL:</Text>
          <Text>{formatearPesos(pedido.total)}</Text>
        </View>

        <Text style={{ fontWeight: 700 }}>Valor Total en Letras:</Text>
        <Text>{valorEnLetras(pedido.total)}</Text>

        {pedido.observaciones && (
          <>
            <Text style={{ fontWeight: 700, marginTop: 3 }}>Observaciones:</Text>
            <Text>{pedido.observaciones}</Text>
          </>
        )}

        <View style={estilos.cajaPago}>
          {pagado ? (
            <>
              <Text style={{ fontWeight: 700 }}>PAGADO ✓</Text>
              {pedido.fechaPago && <Text>{formatearFechaCo(pedido.fechaPago)}</Text>}
            </>
          ) : (
            <>
              <Text style={{ fontWeight: 700 }}>PENDIENTE DE PAGO</Text>
              <Text>{ajustes.datosPago}</Text>
            </>
          )}
        </View>

        <View style={estilos.separador} />
        <Text style={estilos.centro}>{ajustes.pieRecibo}</Text>
      </Page>
    </Document>
  )
}

export async function renderReciboPdf(pedido: PedidoCompleto, ajustes: Ajustes): Promise<Buffer> {
  return renderToBuffer(<ReciboPdf pedido={pedido} ajustes={ajustes} />)
}
```

- [ ] **Step 4: Ejecutar y verificar que pasan**

Run: `npm test -- ReciboPdf`
Expected: PASS, las 3 pruebas.

- [ ] **Step 5: Commit**

```bash
git add src/lib/documentos/pdf/ReciboPdf.tsx src/lib/documentos/pdf/ReciboPdf.test.tsx
git commit -m "feat: agrega el PDF del recibo"
```

---

### Task 11: `enviarReciboPorCorreo` y la ruta de descarga

**Files:**
- Modify: `src/lib/db/pedidos.ts`
- Create: `src/app/api/pedidos/[id]/recibo/route.ts`

**Interfaces:**
- Consumes: `obtenerPedido`, `obtenerAjustes`, `renderReciboPdf` (Task 10),
  `construirCorreoRecibo` (Task 9), `enviarCorreoConAdjunto` (Task 8).
- Produces: `enviarReciboPorCorreo(id: string): Promise<void>`, exportada
  desde `src/lib/db/pedidos.ts`; `GET` exportado desde
  `src/app/api/pedidos/[id]/recibo/route.ts`.

Ninguna de las dos partes se puede probar directamente en Vitest: la
primera porque `obtenerPedido` usa `next/headers`; la segunda porque toda
ruta que dependa de esa misma cadena tiene la misma restricción (ver
`Global Constraints` de este plan y del plan de exportación). Lo que sí
importa —el contenido del correo— ya quedó cubierto en la Task 9. Aquí se
verifica con pasos manuales (Step 3) y con la prueba end-to-end de la
Task 12.

- [ ] **Step 1: Agregar `enviarReciboPorCorreo` a `pedidos.ts`**

```typescript
// Agregar a los imports de src/lib/db/pedidos.ts:
import { obtenerAjustes } from './ajustes'
import { renderReciboPdf } from '@/lib/documentos/pdf/ReciboPdf'
import { construirCorreoRecibo } from '@/lib/correo/recibo'
import { enviarCorreoConAdjunto } from '@/lib/correo/resend'
```

```typescript
// Agregar al final del archivo:
export async function enviarReciboPorCorreo(id: string): Promise<void> {
  const pedido = await obtenerPedido(id)
  if (!pedido) throw new Error('No se encontró el pedido')

  const ajustes = await obtenerAjustes()
  const pdf = await renderReciboPdf(pedido, ajustes)
  const correo = construirCorreoRecibo(pedido, ajustes, pdf)
  await enviarCorreoConAdjunto(correo)
}
```

- [ ] **Step 2: Crear la ruta de descarga del PDF**

```typescript
// src/app/api/pedidos/[id]/recibo/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { obtenerPedido } from '@/lib/db/pedidos'
import { obtenerAjustes } from '@/lib/db/ajustes'
import { renderReciboPdf } from '@/lib/documentos/pdf/ReciboPdf'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const [pedido, ajustes] = await Promise.all([obtenerPedido(id), obtenerAjustes()])
  if (!pedido) return NextResponse.json({ error: 'No se encontró el pedido' }, { status: 404 })

  const buffer = await renderReciboPdf(pedido, ajustes)
  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${pedido.consecutivo ?? id}.pdf"`,
    },
  })
}
```

- [ ] **Step 3: Verificar a mano**

Con el stack local, `RESEND_API_KEY` configurada en `.env.local` (Task 1,
Step 3) y `npm run dev` corriendo:

1. Confirmar un pedido de prueba para un cliente **con** correo (creado en
   la Task 6 con tu propio correo, el mismo con el que abriste la cuenta de
   Resend — mientras siga en el dominio de pruebas, es el único destinatario
   que Resend acepta).
2. Entrar a `http://localhost:3000/api/pedidos/<id>/recibo` y confirmar que
   se descarga un PDF legible, con la cédula completa.
3. Desde la consola del navegador o una petición manual, invocar
   `enviarReciboPorCorreo` a través del botón que se agrega en la Task 12
   (este paso se retoma allá, ya con la interfaz lista).

- [ ] **Step 4: Commit**

```bash
git add src/lib/db/pedidos.ts "src/app/api/pedidos/[id]/recibo/route.ts"
git commit -m "feat: agrega enviarReciboPorCorreo y la descarga del recibo en PDF"
```

---

### Task 12: Botones en la pantalla de documentos

**Files:**
- Modify: `src/app/(app)/pedidos/[id]/documentos/VistaDocumentos.tsx`
- Modify: `e2e/pedido-completo.spec.ts`

**Interfaces:**
- Consumes: `enviarReciboPorCorreo` (Task 11), la ruta
  `/api/pedidos/[id]/recibo` (Task 11).

Los dos botones nuevos solo aparecen en la pestaña "Recibo": enviar o
descargar en PDF el rótulo de envío no tiene sentido de negocio (el rótulo
es para el mensajero o la transportadora, nunca para el cliente).

- [ ] **Step 1: Agregar los botones y el manejo de envío**

```typescript
// Agregar a los imports de VistaDocumentos.tsx:
import { enviarReciboPorCorreo } from '@/lib/db/pedidos'
```

```typescript
// Cambiar el import de estilos ya existente (línea 9 del archivo actual)
// para incluir los dos avisos nuevos, en vez de agregar un import aparte:
import { BOTON_PRIMARIO, BOTON_SECUNDARIO, BOTON_EXITO, AVISO_ERROR, AVISO_EXITO } from '@/components/estilos'
```

`useState` ya está importado (línea 3); agregar `useTransition` a esa misma
línea:

```typescript
import { useRef, useState, useTransition } from 'react'
```

```typescript
// Dentro de VistaDocumentos, junto a los demás useState:
  const [pendienteCorreo, iniciarCorreo] = useTransition()
  const [mensajeCorreo, setMensajeCorreo] = useState<string | null>(null)
  const [errorCorreo, setErrorCorreo] = useState<string | null>(null)

  function enviarPorCorreo() {
    setErrorCorreo(null)
    setMensajeCorreo(null)
    iniciarCorreo(async () => {
      try {
        await enviarReciboPorCorreo(pedido.id)
        setMensajeCorreo('Recibo enviado por correo')
      } catch (e) {
        setErrorCorreo(e instanceof Error ? e.message : 'No se pudo enviar el correo')
      }
    })
  }
```

```tsx
// Dentro del div "solo-pantalla mb-6 flex flex-wrap items-center gap-3",
// después del botón "⬇ Imagen para WhatsApp" y antes de cerrar ese div:
        {pestana === 'recibo' && (
          <>
            <a href={`/api/pedidos/${pedido.id}/recibo`} className={BOTON_SECUNDARIO}>
              ⬇ Descargar PDF
            </a>
            <button
              type="button" onClick={enviarPorCorreo}
              disabled={pendienteCorreo || !pedido.clienteCorreo}
              title={!pedido.clienteCorreo ? 'Este cliente no tiene correo registrado' : undefined}
              className={BOTON_SECUNDARIO}
            >
              {pendienteCorreo ? 'Enviando…' : '✉ Enviar por correo'}
            </button>
          </>
        )}
```

```tsx
// Después de cerrar ese div (justo antes del "flex justify-center" que
// envuelve el documento), agregar los avisos:
      {mensajeCorreo && <p className={`${AVISO_EXITO} solo-pantalla mb-4`}>{mensajeCorreo}</p>}
      {errorCorreo && <p className={`${AVISO_ERROR} solo-pantalla mb-4`}>{errorCorreo}</p>}
```

`PedidoCompleto` ya trae `clienteCorreo` desde la Task 5 — no hace falta
ningún cambio de tipo aquí, `VistaDocumentos` ya recibe `pedido: PedidoCompleto`
completo como prop.

- [ ] **Step 2: Verificar a mano**

Con el dev server corriendo, entrar a `/pedidos/[id]/documentos` de un
pedido con cliente sin correo: el botón "Enviar por correo" debe verse
deshabilitado con el motivo al pasar el mouse. Con un cliente con correo
(el mismo de tu cuenta de Resend, mientras siga en el dominio de pruebas):
el botón debe habilitarse, y al hacer clic debe llegar el correo con el PDF
adjunto — o, si `RESEND_API_KEY` no está configurada, debe mostrarse el
error "Falta configurar RESEND_API_KEY" sin romper la pantalla.

- [ ] **Step 3: Agregar la prueba end-to-end del botón deshabilitado**

Esta prueba no depende de que el envío real de Resend funcione (evita
mandar correos de verdad desde una prueba automatizada — ver
`Global Constraints`): solo verifica que la interfaz respeta la regla de
negocio "sin correo no se puede enviar". Agregar al final de
`e2e/pedido-completo.spec.ts`:

```typescript
test('sin correo registrado, "Enviar por correo" queda deshabilitado', async ({ page }) => {
  const nombreCliente = `Cliente Prueba Sin Correo ${Date.now().toString().slice(-6)}`

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
  // El campo de correo se deja vacío a propósito
  await page.getByRole('button', { name: 'Guardar y usar' }).click()
  await expect(page.getByText(nombreCliente)).toBeVisible()

  await page.getByRole('button', { name: /^Vainilla/ }).click()
  await page.getByRole('button', { name: /Generar recibo/ }).click()
  await expect(page).toHaveURL(/\/pedidos\/.+\/documentos/)

  await expect(page.getByRole('button', { name: /Enviar por correo/ })).toBeDisabled()
  await expect(page.getByRole('link', { name: /Descargar PDF/ })).toBeVisible()
})
```

- [ ] **Step 4: Ejecutar y verificar que pasa**

Run: `npm run test:e2e -- pedido-completo`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add "src/app/(app)/pedidos/[id]/documentos/VistaDocumentos.tsx" e2e/pedido-completo.spec.ts
git commit -m "feat: agrega descargar PDF y enviar por correo en la pantalla de documentos"
```

---

## Resumen de lo que queda operable al terminar

Un cliente puede tener correo (opcional, validado). Al confirmar un pedido,
ese correo queda congelado igual que el resto de sus datos. Desde
`/pedidos/[id]/documentos`, con la pestaña "Recibo" activa, se puede
descargar el recibo en PDF o enviarlo por correo con Resend — deshabilitado
cuando el cliente no tiene correo. Mientras la cuenta de Resend no tenga un
dominio propio verificado, el envío solo llega a la casilla dueña de esa
cuenta: es una limitación operativa a resolver con Resend, no de este
código (ver `docs/superpowers/specs/2026-08-29-exportacion-correo-transportadoras-cedula-design.md`, §10).
