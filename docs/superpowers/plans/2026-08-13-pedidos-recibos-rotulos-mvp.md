# Plan de implementación — Pedidos, recibos y rótulos (MVP)

> **Para agentes ejecutores:** SUB-SKILL REQUERIDA: usar `superpowers:subagent-driven-development` (recomendada) o `superpowers:executing-plans` para implementar tarea por tarea. Los pasos usan casillas (`- [ ]`) para seguimiento.

**Objetivo:** que una persona pueda tomar un pedido en menos de 30 segundos y obtener el recibo de 80 mm y el rótulo de envío, con todo guardado en base de datos.

**Arquitectura:** el pedido es la única fuente de verdad; el recibo y los rótulos son vistas de solo lectura sobre él. Toda la lógica de negocio (cálculos, estados, validación, número a letras) vive en módulos puros de TypeScript sin dependencias de base de datos ni de React, lo que permite probarla sin levantar nada. El acceso a datos se aísla en repositorios. Cada documento imprimible es un componente React del que salen dos cosas —impresión nativa del navegador y PNG— desde el mismo DOM, para que no puedan divergir.

**Stack:** Next.js (App Router) · TypeScript · Tailwind · Supabase (Postgres + Auth) · Vitest · Playwright · html-to-image

**Documento de diseño:** [`docs/superpowers/specs/2026-08-11-pedidos-recibos-rotulos-design.md`](../specs/2026-08-11-pedidos-recibos-rotulos-design.md)

## Alcance de este plan

Cubre las fases 1 a 3 de §12 del diseño:

1. **Base** — proyecto, base de datos, autenticación, catálogo semilla, ajustes
2. **Núcleo** — clientes con direcciones, pantalla de tomar pedido, consecutivos, estados
3. **Salidas** — recibo 80 mm, rótulo local, rótulo nacional, impresión y PNG

Las fases 4 a 6 (lista de pedidos, pendientes de cobro, balance, Excel, seguimiento) van en un segundo plan.

## Restricciones globales

Aplican a **todas** las tareas:

- **Moneda:** pesos colombianos, **enteros sin decimales**. Nunca usar `float` para dinero. Formato de presentación: `$ 240.000` (punto como separador de miles).
- **Unidad:** 1 tarro = 1 kg. La cantidad de un ítem es simultáneamente tarros y kilos.
- **El precio se congela** en el ítem al agregarlo. Cambiar el precio de un producto no puede alterar pedidos existentes.
- **Nada se borra**: los pedidos se anulan (`estado = 'anulado'`) y los productos se desactivan (`activo = false`).
- **El sistema nunca infiere un precio.** Un ítem libre exige descripción y precio escritos por una persona.
- **La cédula nunca se imprime en un rótulo.** En su lugar va el código de cliente (`CL-0042`).
- **Idioma:** identificadores de código en español (el dominio es español), igual que el diseño. Mensajes de interfaz en español.
- **Los totales se persisten** al confirmar; no se recalculan al mostrar.

## Requisito previo (lo hace la persona, no el agente)

Antes de la Tarea 4 debe existir un proyecto en Supabase y estas variables en `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

Crear la cuenta y el proyecto es una acción manual del dueño del negocio. El agente no crea cuentas.

## Estructura de archivos

| Archivo | Responsabilidad |
|---|---|
| `src/lib/tipos.ts` | Tipos compartidos del dominio |
| `src/lib/dinero.ts` | Formateo de pesos colombianos |
| `src/lib/numero-a-letras.ts` | Número → texto en español |
| `src/lib/pedidos/calculos.ts` | Subtotal, kilos, total |
| `src/lib/pedidos/estados.ts` | Transiciones de estado válidas |
| `src/lib/pedidos/validacion.ts` | Reglas para poder confirmar |
| `src/lib/db/cliente-supabase.ts` | Clientes de Supabase (navegador y servidor) |
| `src/lib/db/productos.ts` | Lectura del catálogo |
| `src/lib/db/clientes.ts` | Clientes y direcciones |
| `src/lib/db/pedidos.ts` | Crear, confirmar, leer, anular pedidos |
| `src/lib/db/ajustes.ts` | Ajustes del negocio |
| `supabase/migrations/*.sql` | Esquema, función de consecutivo, RLS, semilla |
| `src/app/(app)/pedidos/nuevo/page.tsx` | Pantalla de tomar pedido |
| `src/components/pedido/BuscadorCliente.tsx` | Buscar y crear cliente |
| `src/components/pedido/GrillaSabores.tsx` | Catálogo y suma de ítems |
| `src/components/pedido/ResumenPedido.tsx` | Ítems, totales, entrega, pago |
| `src/components/documentos/Recibo.tsx` | Plantilla del recibo 80 mm |
| `src/components/documentos/RotuloLocal.tsx` | Plantilla del rótulo local |
| `src/components/documentos/RotuloNacional.tsx` | Plantilla del rótulo nacional |
| `src/lib/documentos/a-png.ts` | DOM → PNG |
| `src/app/(app)/pedidos/[id]/documentos/page.tsx` | Ver, imprimir y descargar los tres documentos |
| `src/app/globals.css` | Estilos de pantalla y reglas `@media print` / `@page` |

---

## FASE 1 — BASE

### Tarea 1: Proyecto, herramientas y arnés de pruebas

**Archivos:**
- Crear: `package.json`, `tsconfig.json`, `next.config.ts`, `tailwind.config.ts`, `postcss.config.mjs`, `vitest.config.ts`, `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css`
- Crear test: `src/lib/arnes.test.ts`

**Interfaces:**
- Consume: nada
- Produce: comandos `npm run dev`, `npm run test`, `npm run build`

- [ ] **Paso 1: Crear el proyecto Next.js**

```bash
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --no-turbopack --yes
```

- [ ] **Paso 2: Instalar Vitest**

```bash
npm install -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom
```

- [ ] **Paso 3: Crear `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'node:path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.test.{ts,tsx}'],
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
})
```

- [ ] **Paso 4: Agregar el script de pruebas a `package.json`**

En la sección `"scripts"`, agregar:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Paso 5: Escribir la prueba que verifica el arnés**

Crear `src/lib/arnes.test.ts`:

```ts
import { describe, it, expect } from 'vitest'

describe('arnés de pruebas', () => {
  it('corre TypeScript y resuelve el alias @', () => {
    expect(1 + 1).toBe(2)
  })
})
```

- [ ] **Paso 6: Correr las pruebas**

Ejecutar: `npm run test`
Esperado: PASS, 1 prueba.

- [ ] **Paso 7: Verificar que compila**

Ejecutar: `npm run build`
Esperado: build exitoso.

- [ ] **Paso 8: Commit**

```bash
git add -A
git commit -m "chore: proyecto Next.js con TypeScript, Tailwind y Vitest"
```

---

### Tarea 2: Tipos del dominio y formateo de dinero

**Archivos:**
- Crear: `src/lib/tipos.ts`, `src/lib/dinero.ts`
- Crear test: `src/lib/dinero.test.ts`

**Interfaces:**
- Consume: nada
- Produce:
  - `type EstadoPedido = 'borrador' | 'confirmado' | 'enviado' | 'entregado' | 'anulado'`
  - `type EstadoPago = 'pendiente' | 'contraentrega' | 'pagado'`
  - `type TipoEntrega = 'local' | 'nacional'`
  - `type TipoCliente = 'detal' | 'mayorista'`
  - `interface Producto`, `interface ItemPedido`, `interface Totales`
  - `formatearPesos(valor: number): string`
  - `formatearPesosSinSimbolo(valor: number): string`

- [ ] **Paso 1: Escribir la prueba de formateo**

Crear `src/lib/dinero.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { formatearPesos, formatearPesosSinSimbolo } from './dinero'

describe('formatearPesos', () => {
  it('usa punto como separador de miles', () => {
    expect(formatearPesos(240000)).toBe('$ 240.000')
  })

  it('no muestra decimales', () => {
    expect(formatearPesos(22000)).toBe('$ 22.000')
  })

  it('maneja el cero', () => {
    expect(formatearPesos(0)).toBe('$ 0')
  })

  it('maneja millones', () => {
    expect(formatearPesos(30640000)).toBe('$ 30.640.000')
  })

  it('maneja valores menores a mil', () => {
    expect(formatearPesos(500)).toBe('$ 500')
  })
})

describe('formatearPesosSinSimbolo', () => {
  it('omite el signo de pesos', () => {
    expect(formatearPesosSinSimbolo(240000)).toBe('240.000')
  })
})
```

- [ ] **Paso 2: Correr la prueba para verificar que falla**

Ejecutar: `npm run test -- dinero`
Esperado: FAIL — no se encuentra el módulo `./dinero`.

- [ ] **Paso 3: Escribir los tipos**

Crear `src/lib/tipos.ts`:

```ts
export type EstadoPedido = 'borrador' | 'confirmado' | 'enviado' | 'entregado' | 'anulado'
export type EstadoPago = 'pendiente' | 'contraentrega' | 'pagado'
export type TipoEntrega = 'local' | 'nacional'
export type TipoCliente = 'detal' | 'mayorista'

export interface Producto {
  id: string
  nombre: string
  emoji: string | null
  precio: number
  activo: boolean
  orden: number
}

export interface ItemPedido {
  productoId: string | null
  descripcion: string
  cantidad: number
  precioUnitario: number
}

export interface Totales {
  subtotal: number
  totalKg: number
  total: number
}

export interface Direccion {
  id: string
  clienteId: string
  etiqueta: string | null
  linea: string
  barrio: string | null
  ciudad: string
  departamento: string | null
  indicaciones: string | null
  esPrincipal: boolean
}

export interface Cliente {
  id: string
  codigo: string
  nombre: string
  telefono: string | null
  cedula: string | null
  tipo: TipoCliente
  notas: string | null
  direcciones?: Direccion[]
}
```

- [ ] **Paso 4: Escribir el formateo**

Crear `src/lib/dinero.ts`:

```ts
export function formatearPesosSinSimbolo(valor: number): string {
  return Math.round(valor).toLocaleString('es-CO', { maximumFractionDigits: 0 })
}

export function formatearPesos(valor: number): string {
  return `$ ${formatearPesosSinSimbolo(valor)}`
}
```

- [ ] **Paso 5: Correr la prueba**

Ejecutar: `npm run test -- dinero`
Esperado: PASS, 6 pruebas.

- [ ] **Paso 6: Commit**

```bash
git add src/lib/tipos.ts src/lib/dinero.ts src/lib/dinero.test.ts
git commit -m "feat: tipos del dominio y formateo de pesos colombianos"
```

---

### Tarea 3: Número a letras

Es el campo más fácil de equivocar a mano y el único que un cliente usa para reclamar. Va primero porque es lógica pura y densa en casos borde.

**Archivos:**
- Crear: `src/lib/numero-a-letras.ts`
- Crear test: `src/lib/numero-a-letras.test.ts`

**Interfaces:**
- Consume: nada
- Produce:
  - `numeroALetras(n: number): string` — minúsculas, sin sufijo. `240000` → `"doscientos cuarenta mil"`
  - `valorEnLetras(n: number): string` — primera letra mayúscula + `" M/cte"`. `240000` → `"Doscientos cuarenta mil M/cte"`

- [ ] **Paso 1: Escribir las pruebas**

Crear `src/lib/numero-a-letras.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { numeroALetras, valorEnLetras } from './numero-a-letras'

describe('numeroALetras — unidades y decenas', () => {
  it('cero', () => expect(numeroALetras(0)).toBe('cero'))
  it('uno', () => expect(numeroALetras(1)).toBe('uno'))
  it('quince', () => expect(numeroALetras(15)).toBe('quince'))
  it('dieciséis lleva tilde', () => expect(numeroALetras(16)).toBe('dieciséis'))
  it('veintiuno va junto', () => expect(numeroALetras(21)).toBe('veintiuno'))
  it('veintidós lleva tilde', () => expect(numeroALetras(22)).toBe('veintidós'))
  it('treinta y uno va separado', () => expect(numeroALetras(31)).toBe('treinta y uno'))
})

describe('numeroALetras — centenas', () => {
  it('cien exacto no es ciento', () => expect(numeroALetras(100)).toBe('cien'))
  it('ciento uno', () => expect(numeroALetras(101)).toBe('ciento uno'))
  it('quinientos es irregular', () => expect(numeroALetras(500)).toBe('quinientos'))
  it('setecientos es irregular', () => expect(numeroALetras(700)).toBe('setecientos'))
  it('novecientos es irregular', () => expect(numeroALetras(900)).toBe('novecientos'))
  it('doscientos treinta y dos', () => expect(numeroALetras(232)).toBe('doscientos treinta y dos'))
})

describe('numeroALetras — miles', () => {
  it('mil sin "uno" delante', () => expect(numeroALetras(1000)).toBe('mil'))
  it('mil uno', () => expect(numeroALetras(1001)).toBe('mil uno'))
  it('dos mil', () => expect(numeroALetras(2000)).toBe('dos mil'))
  it('veintiún mil apocopa con tilde', () => expect(numeroALetras(21000)).toBe('veintiún mil'))
  it('treinta y un mil apocopa sin tilde', () => expect(numeroALetras(31000)).toBe('treinta y un mil'))
  it('veintidós mil', () => expect(numeroALetras(22000)).toBe('veintidós mil'))
  it('doscientos cuarenta mil', () => expect(numeroALetras(240000)).toBe('doscientos cuarenta mil'))
  it('cien mil exacto', () => expect(numeroALetras(100000)).toBe('cien mil'))
  it('total real de un pedido', () =>
    expect(numeroALetras(286000)).toBe('doscientos ochenta y seis mil'))
})

describe('numeroALetras — millones', () => {
  it('un millón, no "uno millón"', () => expect(numeroALetras(1000000)).toBe('un millón'))
  it('dos millones en plural', () => expect(numeroALetras(2000000)).toBe('dos millones'))
  it('veintiún millones apocopa', () => expect(numeroALetras(21000000)).toBe('veintiún millones'))
  it('millones con miles y unidades', () =>
    expect(numeroALetras(30640000)).toBe('treinta millones seiscientos cuarenta mil'))
  it('caso completo', () =>
    expect(numeroALetras(1234567)).toBe(
      'un millón doscientos treinta y cuatro mil quinientos sesenta y siete',
    ))
})

describe('valorEnLetras', () => {
  it('capitaliza y agrega M/cte', () => {
    expect(valorEnLetras(240000)).toBe('Doscientos cuarenta mil M/cte')
  })
  it('funciona con un millón', () => {
    expect(valorEnLetras(1000000)).toBe('Un millón M/cte')
  })
})

describe('numeroALetras — entradas inválidas', () => {
  it('rechaza negativos', () => expect(() => numeroALetras(-1)).toThrow())
  it('rechaza decimales', () => expect(() => numeroALetras(10.5)).toThrow())
})
```

- [ ] **Paso 2: Correr para verificar que falla**

Ejecutar: `npm run test -- numero-a-letras`
Esperado: FAIL — no se encuentra el módulo.

- [ ] **Paso 3: Implementar**

Crear `src/lib/numero-a-letras.ts`:

```ts
const UNIDADES = [
  '', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve',
  'diez', 'once', 'doce', 'trece', 'catorce', 'quince', 'dieciséis', 'diecisiete',
  'dieciocho', 'diecinueve', 'veinte', 'veintiuno', 'veintidós', 'veintitrés',
  'veinticuatro', 'veinticinco', 'veintiséis', 'veintisiete', 'veintiocho', 'veintinueve',
]

const DECENAS = [
  '', '', 'veinte', 'treinta', 'cuarenta', 'cincuenta',
  'sesenta', 'setenta', 'ochenta', 'noventa',
]

const CENTENAS = [
  '', 'ciento', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos',
  'seiscientos', 'setecientos', 'ochocientos', 'novecientos',
]

function menorQueCien(n: number): string {
  if (n < 30) return UNIDADES[n]
  const decena = Math.floor(n / 10)
  const unidad = n % 10
  return unidad === 0 ? DECENAS[decena] : `${DECENAS[decena]} y ${UNIDADES[unidad]}`
}

function menorQueMil(n: number): string {
  if (n === 100) return 'cien'
  const centena = Math.floor(n / 100)
  const resto = n % 100
  if (centena === 0) return menorQueCien(resto)
  if (resto === 0) return CENTENAS[centena]
  return `${CENTENAS[centena]} ${menorQueCien(resto)}`
}

/** "veintiuno" → "veintiún", "treinta y uno" → "treinta y un", "uno" → "un" */
function apocopar(texto: string): string {
  if (texto.endsWith('veintiuno')) return texto.replace(/veintiuno$/, 'veintiún')
  return texto.replace(/uno$/, 'un')
}

export function numeroALetras(n: number): string {
  if (!Number.isInteger(n)) throw new Error(`numeroALetras espera un entero, recibió ${n}`)
  if (n < 0) throw new Error(`numeroALetras no acepta negativos, recibió ${n}`)
  if (n === 0) return 'cero'

  const millones = Math.floor(n / 1_000_000)
  const miles = Math.floor((n % 1_000_000) / 1000)
  const unidades = n % 1000

  const partes: string[] = []

  if (millones === 1) {
    partes.push('un millón')
  } else if (millones > 1) {
    partes.push(`${apocopar(menorQueMil(millones))} millones`)
  }

  if (miles === 1) {
    partes.push('mil')
  } else if (miles > 1) {
    partes.push(`${apocopar(menorQueMil(miles))} mil`)
  }

  if (unidades > 0) partes.push(menorQueMil(unidades))

  return partes.join(' ')
}

export function valorEnLetras(n: number): string {
  const texto = numeroALetras(n)
  return `${texto.charAt(0).toUpperCase()}${texto.slice(1)} M/cte`
}
```

- [ ] **Paso 4: Correr las pruebas**

Ejecutar: `npm run test -- numero-a-letras`
Esperado: PASS, 30 pruebas.

- [ ] **Paso 5: Commit**

```bash
git add src/lib/numero-a-letras.ts src/lib/numero-a-letras.test.ts
git commit -m "feat: conversión de número a letras en español colombiano"
```

---

### Tarea 4: Esquema de base de datos, función de consecutivo y semilla

**Archivos:**
- Crear: `supabase/migrations/0001_esquema.sql`, `supabase/migrations/0002_consecutivo.sql`, `supabase/migrations/0003_rls.sql`, `supabase/migrations/0004_semilla.sql`

**Interfaces:**
- Consume: proyecto Supabase con las variables de entorno del requisito previo
- Produce: tablas `productos`, `clientes`, `direcciones`, `usuarios`, `ajustes`, `pedidos`, `pedido_items`; función SQL `asignar_consecutivo(uuid) returns text`

- [ ] **Paso 1: Instalar la CLI de Supabase y enlazar el proyecto**

```bash
npm install -D supabase
npx supabase init
npx supabase link --project-ref <ref-del-proyecto>
```

- [ ] **Paso 2: Escribir el esquema**

Crear `supabase/migrations/0001_esquema.sql`:

```sql
create table productos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  emoji text,
  precio integer not null check (precio >= 0),
  activo boolean not null default true,
  orden integer not null default 0,
  creado_at timestamptz not null default now()
);

create sequence clientes_codigo_seq start 1;

create table clientes (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique
    default 'CL-' || lpad(nextval('clientes_codigo_seq')::text, 4, '0'),
  nombre text not null,
  telefono text,
  cedula text,
  tipo text not null default 'detal' check (tipo in ('detal', 'mayorista')),
  notas text,
  creado_at timestamptz not null default now()
);

create index clientes_nombre_idx on clientes using gin (to_tsvector('spanish', nombre));
create index clientes_telefono_idx on clientes (telefono);

create table direcciones (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references clientes(id) on delete cascade,
  etiqueta text,
  linea text not null,
  barrio text,
  ciudad text not null,
  departamento text,
  indicaciones text,
  es_principal boolean not null default false
);

create index direcciones_cliente_idx on direcciones (cliente_id);

create table usuarios (
  id uuid primary key references auth.users(id) on delete cascade,
  nombre text not null,
  codigo_asesor text not null unique,
  activo boolean not null default true
);

create table ajustes (
  id boolean primary key default true check (id),
  nombre_negocio text not null default '',
  eslogan text not null default '',
  logo_url text,
  telefonos text not null default '',
  datos_pago text not null default '',
  prefijo_consecutivo text not null default 'PED',
  siguiente_consecutivo integer not null default 1,
  valor_domicilio_default integer not null default 0,
  etiqueta_ancho_mm integer not null default 100,
  etiqueta_alto_mm integer not null default 150,
  pie_recibo text not null default 'Gracias por su compra'
);

create table pedidos (
  id uuid primary key default gen_random_uuid(),
  consecutivo text unique,
  fecha timestamptz not null default now(),

  cliente_id uuid not null references clientes(id),
  direccion_id uuid references direcciones(id),

  -- copia congelada: un cambio futuro en la ficha del cliente
  -- no puede reescribir un pedido ya impreso
  cliente_codigo text,
  cliente_nombre text,
  cliente_telefono text,
  cliente_cedula text,
  dir_linea text,
  dir_barrio text,
  dir_ciudad text,
  dir_departamento text,
  dir_indicaciones text,

  asesor_id uuid references usuarios(id),
  asesor_codigo text,

  tipo_entrega text not null default 'local'
    check (tipo_entrega in ('local', 'nacional')),
  transportadora text,

  estado text not null default 'borrador'
    check (estado in ('borrador', 'confirmado', 'enviado', 'entregado', 'anulado')),
  estado_pago text not null default 'pendiente'
    check (estado_pago in ('pendiente', 'contraentrega', 'pagado')),
  fecha_pago timestamptz,
  metodo_pago text,

  valor_domicilio integer not null default 0 check (valor_domicilio >= 0),
  descuento integer not null default 0 check (descuento >= 0),
  subtotal integer not null default 0,
  total integer not null default 0,
  total_kg integer not null default 0,

  observaciones text,

  anulado_motivo text,
  anulado_por uuid references usuarios(id),
  anulado_at timestamptz,

  creado_at timestamptz not null default now()
);

create index pedidos_fecha_idx on pedidos (fecha desc);
create index pedidos_cliente_idx on pedidos (cliente_id);
create index pedidos_estado_idx on pedidos (estado);

create table pedido_items (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references pedidos(id) on delete cascade,
  producto_id uuid references productos(id),
  descripcion text not null,
  cantidad integer not null check (cantidad > 0),
  precio_unitario integer not null check (precio_unitario >= 0),
  subtotal integer not null,
  orden integer not null default 0
);

create index pedido_items_pedido_idx on pedido_items (pedido_id);
```

- [ ] **Paso 3: Escribir la función de consecutivo**

Crear `supabase/migrations/0002_consecutivo.sql`. El `update ... returning` toma un bloqueo de fila, así que dos confirmaciones simultáneas no pueden obtener el mismo número:

```sql
create or replace function asignar_consecutivo(p_pedido_id uuid)
returns text
language plpgsql
security definer
as $$
declare
  v_prefijo text;
  v_numero integer;
  v_consecutivo text;
  v_existente text;
begin
  select consecutivo into v_existente from pedidos where id = p_pedido_id;
  if v_existente is not null then
    return v_existente;   -- idempotente: confirmar dos veces no quema un número
  end if;

  update ajustes
     set siguiente_consecutivo = siguiente_consecutivo + 1
   where id = true
  returning prefijo_consecutivo, siguiente_consecutivo - 1
       into v_prefijo, v_numero;

  v_consecutivo := v_prefijo || '-' || lpad(v_numero::text, 6, '0');

  update pedidos
     set consecutivo = v_consecutivo
   where id = p_pedido_id;

  return v_consecutivo;
end;
$$;
```

- [ ] **Paso 4: Escribir las políticas de acceso**

Crear `supabase/migrations/0003_rls.sql`. El equipo es pequeño y todos ven todo; lo que importa es que nadie sin sesión toque nada:

```sql
alter table productos      enable row level security;
alter table clientes       enable row level security;
alter table direcciones    enable row level security;
alter table usuarios       enable row level security;
alter table ajustes        enable row level security;
alter table pedidos        enable row level security;
alter table pedido_items   enable row level security;

create policy "autenticados leen y escriben productos"    on productos    for all to authenticated using (true) with check (true);
create policy "autenticados leen y escriben clientes"     on clientes     for all to authenticated using (true) with check (true);
create policy "autenticados leen y escriben direcciones"  on direcciones  for all to authenticated using (true) with check (true);
create policy "autenticados leen usuarios"                on usuarios     for select to authenticated using (true);
create policy "autenticados leen y escriben ajustes"      on ajustes      for all to authenticated using (true) with check (true);
create policy "autenticados leen y escriben pedidos"      on pedidos      for all to authenticated using (true) with check (true);
create policy "autenticados leen y escriben items"        on pedido_items for all to authenticated using (true) with check (true);
```

- [ ] **Paso 5: Escribir la semilla**

Crear `supabase/migrations/0004_semilla.sql` con los 21 productos del diseño:

```sql
insert into ajustes (id) values (true) on conflict do nothing;

insert into productos (nombre, emoji, precio, orden) values
  ('Base neutra',        null, 20000,  1),
  ('Vainilla',          '🌸', 22000, 10),
  ('Fresa',             '🍓', 22000, 11),
  ('Arequipe',          '🍬', 22000, 12),
  ('Chocolate',         '🍫', 22000, 13),
  ('Yogurt tradicional','🥤', 22000, 14),
  ('Frutos Rojos',      '🍎', 22000, 15),
  ('Frutos Morados',    '🍇', 22000, 16),
  ('Ron pasas',         '🍹', 22000, 17),
  ('Coco',              '🥥', 22000, 18),
  ('Mandarina',          null, 22000, 19),
  ('Maracuyá',          '🍊', 25000, 30),
  ('Frutos Amarillos',   null, 25000, 31),
  ('Yogurt Premium',     null, 25000, 32),
  ('Chicle Blue Ice',    null, 25000, 33),
  ('Kiwi',               null, 25000, 34),
  ('Café',               null, 25000, 35),
  ('Milo',               null, 28000, 40),
  ('4 Leches',           null, 28000, 41),
  ('Nucita',             null, 28000, 42),
  ('Postre de Nata',    '🐄', 28000, 43);
```

- [ ] **Paso 6: Aplicar las migraciones**

```bash
npx supabase db push
```

Esperado: las cuatro migraciones aplicadas sin error.

- [ ] **Paso 7: Verificar la semilla**

```bash
npx supabase db execute --sql "select count(*) from productos;"
```

Esperado: `21`.

- [ ] **Paso 8: Commit**

```bash
git add supabase/
git commit -m "feat: esquema de base de datos, consecutivo atómico, RLS y catálogo semilla"
```

---

### Tarea 5: Conexión a Supabase, sesión y pantalla de ingreso

**Archivos:**
- Crear: `src/lib/db/cliente-supabase.ts`, `src/middleware.ts`, `src/app/ingresar/page.tsx`, `src/app/(app)/layout.tsx`
- Modificar: `src/app/page.tsx`

**Interfaces:**
- Consume: variables de entorno del requisito previo
- Produce:
  - `crearClienteNavegador(): SupabaseClient`
  - `crearClienteServidor(): Promise<SupabaseClient>`
  - `obtenerUsuarioActual(): Promise<{ id: string; nombre: string; codigoAsesor: string } | null>`

- [ ] **Paso 1: Instalar las dependencias**

```bash
npm install @supabase/supabase-js @supabase/ssr
```

- [ ] **Paso 2: Escribir los constructores de cliente**

Crear `src/lib/db/cliente-supabase.ts`:

```ts
import { createBrowserClient, createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export function crearClienteNavegador() {
  return createBrowserClient(URL, ANON)
}

export async function crearClienteServidor() {
  const almacen = await cookies()
  return createServerClient(URL, ANON, {
    cookies: {
      getAll: () => almacen.getAll(),
      setAll: (nuevas) => {
        try {
          nuevas.forEach(({ name, value, options }) => almacen.set(name, value, options))
        } catch {
          // Llamado desde un Server Component: el middleware refresca la sesión.
        }
      },
    },
  })
}

export async function obtenerUsuarioActual() {
  const supabase = await crearClienteServidor()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('usuarios')
    .select('id, nombre, codigo_asesor')
    .eq('id', user.id)
    .single()

  if (!data) return null
  return { id: data.id, nombre: data.nombre, codigoAsesor: data.codigo_asesor }
}
```

- [ ] **Paso 3: Escribir el middleware que protege las rutas**

Crear `src/middleware.ts`:

```ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const respuesta = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (nuevas) => {
          nuevas.forEach(({ name, value, options }) =>
            respuesta.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  const { data: { user } } = await supabase.auth.getUser()

  if (!user && !request.nextUrl.pathname.startsWith('/ingresar')) {
    const url = request.nextUrl.clone()
    url.pathname = '/ingresar'
    return NextResponse.redirect(url)
  }

  return respuesta
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg)$).*)'],
}
```

- [ ] **Paso 4: Escribir la pantalla de ingreso**

Crear `src/app/ingresar/page.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { crearClienteNavegador } from '@/lib/db/cliente-supabase'

export default function Ingresar() {
  const router = useRouter()
  const [correo, setCorreo] = useState('')
  const [clave, setClave] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(false)

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    setCargando(true)
    setError(null)
    const supabase = crearClienteNavegador()
    const { error } = await supabase.auth.signInWithPassword({ email: correo, password: clave })
    setCargando(false)
    if (error) {
      setError('Correo o contraseña incorrectos')
      return
    }
    router.push('/pedidos/nuevo')
    router.refresh()
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <form onSubmit={enviar} className="w-full max-w-sm space-y-4 rounded-xl bg-white p-6 shadow">
        <h1 className="text-xl font-bold">Ingresar</h1>
        <input
          type="email" required value={correo} onChange={(e) => setCorreo(e.target.value)}
          placeholder="Correo" className="w-full rounded-lg border px-3 py-2"
        />
        <input
          type="password" required value={clave} onChange={(e) => setClave(e.target.value)}
          placeholder="Contraseña" className="w-full rounded-lg border px-3 py-2"
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit" disabled={cargando}
          className="w-full rounded-lg bg-slate-900 py-2 font-semibold text-white disabled:opacity-50"
        >
          {cargando ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
    </main>
  )
}
```

- [ ] **Paso 5: Crear el layout de la aplicación y redirigir la raíz**

Crear `src/app/(app)/layout.tsx`:

```tsx
export default function LayoutApp({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-slate-100">{children}</div>
}
```

Reemplazar `src/app/page.tsx`:

```tsx
import { redirect } from 'next/navigation'

export default function Raiz() {
  redirect('/pedidos/nuevo')
}
```

- [ ] **Paso 6: Crear un usuario de prueba y verificar el ingreso**

En el panel de Supabase, crear un usuario con correo y contraseña. Luego insertar su fila en `usuarios`:

```bash
npx supabase db execute --sql "insert into usuarios (id, nombre, codigo_asesor) values ('<uuid-del-usuario>', 'Adriana', '002');"
```

Ejecutar `npm run dev`, abrir `http://localhost:3000` y verificar que redirige a `/ingresar` y que al entrar con ese usuario pasa a `/pedidos/nuevo` (que aún dará 404 — se crea en la Tarea 12).

- [ ] **Paso 7: Commit**

```bash
git add -A
git commit -m "feat: conexión a Supabase, protección de rutas y pantalla de ingreso"
```

---

## FASE 2 — NÚCLEO

### Tarea 6: Cálculos del pedido

**Archivos:**
- Crear: `src/lib/pedidos/calculos.ts`
- Crear test: `src/lib/pedidos/calculos.test.ts`

**Interfaces:**
- Consume: `ItemPedido`, `Totales` de `@/lib/tipos`
- Produce:
  - `calcularSubtotalItem(item: ItemPedido): number`
  - `calcularTotales(items: ItemPedido[], valorDomicilio: number, descuento: number): Totales`

- [ ] **Paso 1: Escribir las pruebas**

Crear `src/lib/pedidos/calculos.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { calcularSubtotalItem, calcularTotales } from './calculos'
import type { ItemPedido } from '@/lib/tipos'

function item(cantidad: number, precioUnitario: number): ItemPedido {
  return { productoId: 'x', descripcion: 'Vainilla', cantidad, precioUnitario }
}

describe('calcularSubtotalItem', () => {
  it('multiplica cantidad por precio', () => {
    expect(calcularSubtotalItem(item(4, 22000))).toBe(88000)
  })
})

describe('calcularTotales', () => {
  it('suma el pedido real del diseño', () => {
    const items = [item(4, 22000), item(2, 22000), item(4, 25000)]
    const totales = calcularTotales(items, 8000, 0)
    expect(totales.subtotal).toBe(232000)
    expect(totales.total).toBe(240000)
  })

  it('cuenta los kilos como suma de cantidades, porque 1 tarro = 1 kg', () => {
    const items = [item(4, 22000), item(2, 22000), item(4, 25000)]
    expect(calcularTotales(items, 0, 0).totalKg).toBe(10)
  })

  it('resta el descuento', () => {
    expect(calcularTotales([item(1, 22000)], 5000, 2000).total).toBe(25000)
  })

  it('devuelve ceros con el pedido vacío', () => {
    expect(calcularTotales([], 0, 0)).toEqual({ subtotal: 0, totalKg: 0, total: 0 })
  })

  it('nunca devuelve un total negativo aunque el descuento sea excesivo', () => {
    expect(calcularTotales([item(1, 22000)], 0, 99999).total).toBe(0)
  })

  it('incluye ítems libres, que no tienen producto', () => {
    const libre: ItemPedido = {
      productoId: null, descripcion: 'Sabor experimental', cantidad: 1, precioUnitario: 30000,
    }
    const totales = calcularTotales([item(2, 22000), libre], 0, 0)
    expect(totales.subtotal).toBe(74000)
    expect(totales.totalKg).toBe(3)
  })
})
```

- [ ] **Paso 2: Correr para verificar que falla**

Ejecutar: `npm run test -- calculos`
Esperado: FAIL — no se encuentra el módulo.

- [ ] **Paso 3: Implementar**

Crear `src/lib/pedidos/calculos.ts`:

```ts
import type { ItemPedido, Totales } from '@/lib/tipos'

export function calcularSubtotalItem(item: ItemPedido): number {
  return item.cantidad * item.precioUnitario
}

export function calcularTotales(
  items: ItemPedido[],
  valorDomicilio: number,
  descuento: number,
): Totales {
  const subtotal = items.reduce((suma, item) => suma + calcularSubtotalItem(item), 0)
  const totalKg = items.reduce((suma, item) => suma + item.cantidad, 0)
  const total = Math.max(0, subtotal + valorDomicilio - descuento)
  return { subtotal, totalKg, total }
}
```

- [ ] **Paso 4: Correr las pruebas**

Ejecutar: `npm run test -- calculos`
Esperado: PASS, 7 pruebas.

- [ ] **Paso 5: Commit**

```bash
git add src/lib/pedidos/calculos.ts src/lib/pedidos/calculos.test.ts
git commit -m "feat: cálculo de subtotales, kilos y total del pedido"
```

---

### Tarea 7: Estados del pedido

**Archivos:**
- Crear: `src/lib/pedidos/estados.ts`
- Crear test: `src/lib/pedidos/estados.test.ts`

**Interfaces:**
- Consume: `EstadoPedido` de `@/lib/tipos`
- Produce:
  - `TRANSICIONES: Record<EstadoPedido, EstadoPedido[]>`
  - `puedeTransicionar(desde: EstadoPedido, hacia: EstadoPedido): boolean`
  - `esEditable(estado: EstadoPedido): boolean`

- [ ] **Paso 1: Escribir las pruebas**

Crear `src/lib/pedidos/estados.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { puedeTransicionar, esEditable } from './estados'

describe('puedeTransicionar', () => {
  it('permite el camino normal', () => {
    expect(puedeTransicionar('borrador', 'confirmado')).toBe(true)
    expect(puedeTransicionar('confirmado', 'enviado')).toBe(true)
    expect(puedeTransicionar('enviado', 'entregado')).toBe(true)
  })

  it('permite anular en cualquier punto antes de entregar', () => {
    expect(puedeTransicionar('borrador', 'anulado')).toBe(true)
    expect(puedeTransicionar('confirmado', 'anulado')).toBe(true)
    expect(puedeTransicionar('enviado', 'anulado')).toBe(true)
  })

  it('no permite devolverse', () => {
    expect(puedeTransicionar('confirmado', 'borrador')).toBe(false)
    expect(puedeTransicionar('entregado', 'enviado')).toBe(false)
  })

  it('no permite saltarse pasos', () => {
    expect(puedeTransicionar('borrador', 'entregado')).toBe(false)
  })

  it('un pedido anulado es un callejón sin salida', () => {
    expect(puedeTransicionar('anulado', 'confirmado')).toBe(false)
    expect(puedeTransicionar('anulado', 'borrador')).toBe(false)
  })

  it('un pedido entregado ya no se anula: se maneja como devolución aparte', () => {
    expect(puedeTransicionar('entregado', 'anulado')).toBe(false)
  })
})

describe('esEditable', () => {
  it('solo el borrador se puede editar', () => {
    expect(esEditable('borrador')).toBe(true)
    expect(esEditable('confirmado')).toBe(false)
    expect(esEditable('anulado')).toBe(false)
  })
})
```

- [ ] **Paso 2: Correr para verificar que falla**

Ejecutar: `npm run test -- estados`
Esperado: FAIL.

- [ ] **Paso 3: Implementar**

Crear `src/lib/pedidos/estados.ts`:

```ts
import type { EstadoPedido } from '@/lib/tipos'

export const TRANSICIONES: Record<EstadoPedido, EstadoPedido[]> = {
  borrador:   ['confirmado', 'anulado'],
  confirmado: ['enviado', 'anulado'],
  enviado:    ['entregado', 'anulado'],
  entregado:  [],
  anulado:    [],
}

export function puedeTransicionar(desde: EstadoPedido, hacia: EstadoPedido): boolean {
  return TRANSICIONES[desde].includes(hacia)
}

export function esEditable(estado: EstadoPedido): boolean {
  return estado === 'borrador'
}
```

- [ ] **Paso 4: Correr las pruebas**

Ejecutar: `npm run test -- estados`
Esperado: PASS, 7 pruebas.

- [ ] **Paso 5: Commit**

```bash
git add src/lib/pedidos/estados.ts src/lib/pedidos/estados.test.ts
git commit -m "feat: máquina de estados del pedido"
```

---

### Tarea 8: Validación para confirmar

**Archivos:**
- Crear: `src/lib/pedidos/validacion.ts`
- Crear test: `src/lib/pedidos/validacion.test.ts`

**Interfaces:**
- Consume: `ItemPedido`, `TipoEntrega` de `@/lib/tipos`
- Produce:
  - `interface BorradorPedido { clienteId: string | null; direccionId: string | null; items: ItemPedido[]; tipoEntrega: TipoEntrega; transportadora: string | null }`
  - `validarParaConfirmar(borrador: BorradorPedido): string[]` — devuelve la lista de problemas; vacía significa que se puede confirmar

- [ ] **Paso 1: Escribir las pruebas**

Crear `src/lib/pedidos/validacion.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { validarParaConfirmar, type BorradorPedido } from './validacion'

function borradorValido(): BorradorPedido {
  return {
    clienteId: 'c1',
    direccionId: 'd1',
    items: [{ productoId: 'p1', descripcion: 'Vainilla', cantidad: 4, precioUnitario: 22000 }],
    tipoEntrega: 'local',
    transportadora: null,
  }
}

describe('validarParaConfirmar', () => {
  it('acepta un borrador completo', () => {
    expect(validarParaConfirmar(borradorValido())).toEqual([])
  })

  it('exige cliente', () => {
    const p = validarParaConfirmar({ ...borradorValido(), clienteId: null })
    expect(p).toContain('Falta escoger el cliente')
  })

  it('exige dirección: sin ella el rótulo sale inservible', () => {
    const p = validarParaConfirmar({ ...borradorValido(), direccionId: null })
    expect(p).toContain('Falta escoger la dirección de entrega')
  })

  it('exige al menos un ítem', () => {
    const p = validarParaConfirmar({ ...borradorValido(), items: [] })
    expect(p).toContain('El pedido no tiene productos')
  })

  it('exige transportadora cuando el envío es nacional', () => {
    const p = validarParaConfirmar({
      ...borradorValido(), tipoEntrega: 'nacional', transportadora: null,
    })
    expect(p).toContain('Falta la transportadora del envío nacional')
  })

  it('no exige transportadora en entrega local', () => {
    expect(validarParaConfirmar(borradorValido())).toEqual([])
  })

  it('rechaza un ítem libre sin descripción, porque el sistema no adivina', () => {
    const p = validarParaConfirmar({
      ...borradorValido(),
      items: [{ productoId: null, descripcion: '  ', cantidad: 1, precioUnitario: 30000 }],
    })
    expect(p).toContain('Hay un ítem libre sin descripción')
  })

  it('rechaza un ítem libre en cero, porque el sistema nunca infiere un precio', () => {
    const p = validarParaConfirmar({
      ...borradorValido(),
      items: [{ productoId: null, descripcion: 'Experimental', cantidad: 1, precioUnitario: 0 }],
    })
    expect(p).toContain('Hay un ítem libre sin precio: Experimental')
  })

  it('acumula todos los problemas de una vez', () => {
    const p = validarParaConfirmar({
      clienteId: null, direccionId: null, items: [], tipoEntrega: 'local', transportadora: null,
    })
    expect(p).toHaveLength(3)
  })
})
```

- [ ] **Paso 2: Correr para verificar que falla**

Ejecutar: `npm run test -- validacion`
Esperado: FAIL.

- [ ] **Paso 3: Implementar**

Crear `src/lib/pedidos/validacion.ts`:

```ts
import type { ItemPedido, TipoEntrega } from '@/lib/tipos'

export interface BorradorPedido {
  clienteId: string | null
  direccionId: string | null
  items: ItemPedido[]
  tipoEntrega: TipoEntrega
  transportadora: string | null
}

export function validarParaConfirmar(borrador: BorradorPedido): string[] {
  const problemas: string[] = []

  if (!borrador.clienteId) problemas.push('Falta escoger el cliente')
  if (!borrador.direccionId) problemas.push('Falta escoger la dirección de entrega')
  if (borrador.items.length === 0) problemas.push('El pedido no tiene productos')

  if (borrador.tipoEntrega === 'nacional' && !borrador.transportadora?.trim()) {
    problemas.push('Falta la transportadora del envío nacional')
  }

  for (const item of borrador.items) {
    if (item.productoId !== null) continue
    if (!item.descripcion.trim()) {
      problemas.push('Hay un ítem libre sin descripción')
    } else if (item.precioUnitario <= 0) {
      problemas.push(`Hay un ítem libre sin precio: ${item.descripcion.trim()}`)
    }
  }

  return problemas
}
```

- [ ] **Paso 4: Correr las pruebas**

Ejecutar: `npm run test -- validacion`
Esperado: PASS, 9 pruebas.

- [ ] **Paso 5: Commit**

```bash
git add src/lib/pedidos/validacion.ts src/lib/pedidos/validacion.test.ts
git commit -m "feat: reglas de validación para confirmar un pedido"
```

---

### Tarea 9: Repositorios de catálogo, ajustes y clientes

**Archivos:**
- Crear: `src/lib/db/productos.ts`, `src/lib/db/ajustes.ts`, `src/lib/db/clientes.ts`

**Interfaces:**
- Consume: `crearClienteServidor` de `@/lib/db/cliente-supabase`; tipos de `@/lib/tipos`
- Produce:
  - `listarProductosActivos(): Promise<Producto[]>`
  - `interface Ajustes { nombreNegocio, eslogan, logoUrl, telefonos, datosPago, prefijoConsecutivo, valorDomicilioDefault, etiquetaAnchoMm, etiquetaAltoMm, pieRecibo }`
  - `obtenerAjustes(): Promise<Ajustes>`
  - `buscarClientes(texto: string): Promise<Cliente[]>`
  - `obtenerCliente(id: string): Promise<Cliente | null>`
  - `crearCliente(datos: { nombre, telefono, cedula, tipo }, direccion: { linea, barrio, ciudad, departamento, indicaciones }): Promise<Cliente>`

- [ ] **Paso 1: Escribir el repositorio de productos**

Crear `src/lib/db/productos.ts`:

```ts
import { crearClienteServidor } from './cliente-supabase'
import type { Producto } from '@/lib/tipos'

export async function listarProductosActivos(): Promise<Producto[]> {
  const supabase = await crearClienteServidor()
  const { data, error } = await supabase
    .from('productos')
    .select('id, nombre, emoji, precio, activo, orden')
    .eq('activo', true)
    .order('orden')

  if (error) throw new Error(`No se pudo leer el catálogo: ${error.message}`)
  return data ?? []
}
```

- [ ] **Paso 2: Escribir el repositorio de ajustes**

Crear `src/lib/db/ajustes.ts`:

```ts
import { crearClienteServidor } from './cliente-supabase'

export interface Ajustes {
  nombreNegocio: string
  eslogan: string
  logoUrl: string | null
  telefonos: string
  datosPago: string
  prefijoConsecutivo: string
  valorDomicilioDefault: number
  etiquetaAnchoMm: number
  etiquetaAltoMm: number
  pieRecibo: string
}

export async function obtenerAjustes(): Promise<Ajustes> {
  const supabase = await crearClienteServidor()
  const { data, error } = await supabase.from('ajustes').select('*').eq('id', true).single()
  if (error) throw new Error(`No se pudieron leer los ajustes: ${error.message}`)

  return {
    nombreNegocio: data.nombre_negocio,
    eslogan: data.eslogan,
    logoUrl: data.logo_url,
    telefonos: data.telefonos,
    datosPago: data.datos_pago,
    prefijoConsecutivo: data.prefijo_consecutivo,
    valorDomicilioDefault: data.valor_domicilio_default,
    etiquetaAnchoMm: data.etiqueta_ancho_mm,
    etiquetaAltoMm: data.etiqueta_alto_mm,
    pieRecibo: data.pie_recibo,
  }
}
```

- [ ] **Paso 3: Escribir el repositorio de clientes**

Crear `src/lib/db/clientes.ts`:

```ts
'use server'

import { crearClienteServidor } from './cliente-supabase'
import type { Cliente, Direccion, TipoCliente } from '@/lib/tipos'

const CAMPOS = `
  id, codigo, nombre, telefono, cedula, tipo, notas,
  direcciones ( id, cliente_id, etiqueta, linea, barrio, ciudad,
                departamento, indicaciones, es_principal )
`

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

export async function buscarClientes(texto: string): Promise<Cliente[]> {
  const termino = texto.trim()
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
```

- [ ] **Paso 4: Verificar que compila**

Ejecutar: `npm run build`
Esperado: build exitoso.

- [ ] **Paso 5: Commit**

```bash
git add src/lib/db/
git commit -m "feat: repositorios de catálogo, ajustes y clientes"
```

---

### Tarea 10: Repositorio de pedidos y confirmación

**Archivos:**
- Crear: `src/lib/db/pedidos.ts`
- Crear test: `src/lib/db/pedidos.integracion.test.ts`
- Modificar: `vitest.config.ts` (excluir las pruebas de integración de la corrida normal)

**Interfaces:**
- Consume: `calcularTotales`, `validarParaConfirmar`, `puedeTransicionar`, repositorios de la Tarea 9
- Produce:
  - `interface PedidoCompleto` — pedido con sus ítems y datos congelados
  - `crearBorrador(): Promise<string>` — devuelve el id
  - `guardarBorrador(id: string, borrador: DatosBorrador): Promise<void>`
  - `confirmarPedido(id: string): Promise<{ consecutivo: string }>`
  - `obtenerPedido(id: string): Promise<PedidoCompleto | null>`
  - `anularPedido(id: string, motivo: string): Promise<void>`

- [ ] **Paso 1: Escribir la prueba de integración del consecutivo**

Esta prueba corre contra la base real, porque lo que verifica —la atomicidad— no se puede simular. Crear `src/lib/db/pedidos.integracion.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

async function crearPedidoDePrueba(clienteId: string): Promise<string> {
  const { data, error } = await supabase
    .from('pedidos').insert({ cliente_id: clienteId }).select('id').single()
  if (error) throw error
  return data.id
}

describe('asignar_consecutivo', () => {
  it('no repite números aunque se pidan al mismo tiempo', async () => {
    const { data: cliente } = await supabase
      .from('clientes').insert({ nombre: 'Prueba concurrencia' }).select('id').single()

    const ids = await Promise.all(
      Array.from({ length: 10 }, () => crearPedidoDePrueba(cliente!.id)),
    )

    const resultados = await Promise.all(
      ids.map((id) => supabase.rpc('asignar_consecutivo', { p_pedido_id: id })),
    )

    const consecutivos = resultados.map((r) => r.data as string)
    expect(new Set(consecutivos).size).toBe(10)

    await supabase.from('clientes').delete().eq('id', cliente!.id)
  }, 30000)

  it('es idempotente: pedirlo dos veces devuelve el mismo número', async () => {
    const { data: cliente } = await supabase
      .from('clientes').insert({ nombre: 'Prueba idempotencia' }).select('id').single()
    const id = await crearPedidoDePrueba(cliente!.id)

    const primera = await supabase.rpc('asignar_consecutivo', { p_pedido_id: id })
    const segunda = await supabase.rpc('asignar_consecutivo', { p_pedido_id: id })

    expect(segunda.data).toBe(primera.data)

    await supabase.from('clientes').delete().eq('id', cliente!.id)
  }, 30000)
})
```

- [ ] **Paso 2: Separar las pruebas de integración**

En `vitest.config.ts`, reemplazar la línea `include`:

```ts
    include: ['src/**/*.test.{ts,tsx}'],
    exclude: ['**/node_modules/**', 'src/**/*.integracion.test.ts'],
```

Y agregar a `package.json`:

```json
"test:integracion": "vitest run --config vitest.integracion.config.ts"
```

Crear `vitest.integracion.config.ts`:

```ts
import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['src/**/*.integracion.test.ts'],
    setupFiles: ['dotenv/config'],
  },
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
})
```

```bash
npm install -D dotenv
```

- [ ] **Paso 3: Correr la prueba de integración para verificar que falla**

Ejecutar: `npm run test:integracion`
Esperado: FAIL si la función no existe. Si la Tarea 4 ya se aplicó, esta prueba debe **pasar** — en ese caso confirma que la migración quedó bien.

- [ ] **Paso 4: Escribir el repositorio**

Crear `src/lib/db/pedidos.ts`:

```ts
'use server'

import { crearClienteServidor, obtenerUsuarioActual } from './cliente-supabase'
import { calcularTotales, calcularSubtotalItem } from '@/lib/pedidos/calculos'
import { validarParaConfirmar } from '@/lib/pedidos/validacion'
import { puedeTransicionar } from '@/lib/pedidos/estados'
import type {
  ItemPedido, EstadoPedido, EstadoPago, TipoEntrega,
} from '@/lib/tipos'

export interface DatosBorrador {
  clienteId: string | null
  direccionId: string | null
  items: ItemPedido[]
  tipoEntrega: TipoEntrega
  transportadora: string | null
  estadoPago: EstadoPago
  valorDomicilio: number
  descuento: number
  observaciones: string
}

export interface PedidoCompleto {
  id: string
  consecutivo: string | null
  fecha: string
  estado: EstadoPedido
  estadoPago: EstadoPago
  tipoEntrega: TipoEntrega
  transportadora: string | null
  fechaPago: string | null

  clienteCodigo: string
  clienteNombre: string
  clienteTelefono: string | null
  clienteCedula: string | null

  dirLinea: string | null
  dirBarrio: string | null
  dirCiudad: string | null
  dirDepartamento: string | null
  dirIndicaciones: string | null

  asesorCodigo: string | null
  valorDomicilio: number
  descuento: number
  subtotal: number
  total: number
  totalKg: number
  observaciones: string | null

  items: (ItemPedido & { subtotal: number })[]
}

export async function crearBorrador(): Promise<string> {
  const supabase = await crearClienteServidor()
  const { data, error } = await supabase
    .from('pedidos')
    .insert({ estado: 'borrador', cliente_id: null })
    .select('id')
    .single()
  if (error) throw new Error(`No se pudo crear el borrador: ${error.message}`)
  return data.id
}

export async function guardarBorrador(id: string, borrador: DatosBorrador): Promise<void> {
  const supabase = await crearClienteServidor()
  const totales = calcularTotales(borrador.items, borrador.valorDomicilio, borrador.descuento)

  const { error } = await supabase
    .from('pedidos')
    .update({
      cliente_id: borrador.clienteId,
      direccion_id: borrador.direccionId,
      tipo_entrega: borrador.tipoEntrega,
      transportadora: borrador.transportadora,
      estado_pago: borrador.estadoPago,
      valor_domicilio: borrador.valorDomicilio,
      descuento: borrador.descuento,
      observaciones: borrador.observaciones,
      subtotal: totales.subtotal,
      total: totales.total,
      total_kg: totales.totalKg,
    })
    .eq('id', id)
    .eq('estado', 'borrador')

  if (error) throw new Error(`No se pudo guardar el borrador: ${error.message}`)

  await supabase.from('pedido_items').delete().eq('pedido_id', id)

  if (borrador.items.length > 0) {
    const filas = borrador.items.map((item, indice) => ({
      pedido_id: id,
      producto_id: item.productoId,
      descripcion: item.descripcion,
      cantidad: item.cantidad,
      precio_unitario: item.precioUnitario,
      subtotal: calcularSubtotalItem(item),
      orden: indice,
    }))
    const { error: errorItems } = await supabase.from('pedido_items').insert(filas)
    if (errorItems) throw new Error(`No se pudieron guardar los ítems: ${errorItems.message}`)
  }
}

export async function confirmarPedido(id: string): Promise<{ consecutivo: string }> {
  const supabase = await crearClienteServidor()

  const { data: pedido, error } = await supabase
    .from('pedidos')
    .select('*, pedido_items(*), clientes(codigo, nombre, telefono, cedula), direcciones(*)')
    .eq('id', id)
    .single()

  if (error || !pedido) throw new Error('No se encontró el pedido')

  const items: ItemPedido[] = (pedido.pedido_items ?? []).map(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (i: any) => ({
      productoId: i.producto_id,
      descripcion: i.descripcion,
      cantidad: i.cantidad,
      precioUnitario: i.precio_unitario,
    }),
  )

  const problemas = validarParaConfirmar({
    clienteId: pedido.cliente_id,
    direccionId: pedido.direccion_id,
    items,
    tipoEntrega: pedido.tipo_entrega,
    transportadora: pedido.transportadora,
  })
  if (problemas.length > 0) throw new Error(problemas.join('. '))

  if (!puedeTransicionar(pedido.estado, 'confirmado')) {
    throw new Error(`Un pedido en estado "${pedido.estado}" no se puede confirmar`)
  }

  const usuario = await obtenerUsuarioActual()
  const totales = calcularTotales(items, pedido.valor_domicilio, pedido.descuento)

  // Se congela todo lo que va impreso: si mañana cambia la ficha del cliente,
  // este pedido sigue diciendo lo que decía el día que salió.
  const { error: errorUpdate } = await supabase
    .from('pedidos')
    .update({
      estado: 'confirmado',
      cliente_codigo: pedido.clientes.codigo,
      cliente_nombre: pedido.clientes.nombre,
      cliente_telefono: pedido.clientes.telefono,
      cliente_cedula: pedido.clientes.cedula,
      dir_linea: pedido.direcciones?.linea ?? null,
      dir_barrio: pedido.direcciones?.barrio ?? null,
      dir_ciudad: pedido.direcciones?.ciudad ?? null,
      dir_departamento: pedido.direcciones?.departamento ?? null,
      dir_indicaciones: pedido.direcciones?.indicaciones ?? null,
      asesor_id: usuario?.id ?? null,
      asesor_codigo: usuario?.codigoAsesor ?? null,
      subtotal: totales.subtotal,
      total: totales.total,
      total_kg: totales.totalKg,
      fecha: new Date().toISOString(),
    })
    .eq('id', id)

  if (errorUpdate) throw new Error(`No se pudo confirmar: ${errorUpdate.message}`)

  const { data: consecutivo, error: errorConsecutivo } = await supabase.rpc(
    'asignar_consecutivo', { p_pedido_id: id },
  )
  if (errorConsecutivo) throw new Error(`No se pudo asignar el consecutivo: ${errorConsecutivo.message}`)

  return { consecutivo: consecutivo as string }
}

export async function obtenerPedido(id: string): Promise<PedidoCompleto | null> {
  const supabase = await crearClienteServidor()
  const { data } = await supabase
    .from('pedidos')
    .select('*, pedido_items(*)')
    .eq('id', id)
    .single()

  if (!data) return null

  return {
    id: data.id,
    consecutivo: data.consecutivo,
    fecha: data.fecha,
    estado: data.estado,
    estadoPago: data.estado_pago,
    tipoEntrega: data.tipo_entrega,
    transportadora: data.transportadora,
    fechaPago: data.fecha_pago,
    clienteCodigo: data.cliente_codigo ?? '',
    clienteNombre: data.cliente_nombre ?? '',
    clienteTelefono: data.cliente_telefono,
    clienteCedula: data.cliente_cedula,
    dirLinea: data.dir_linea,
    dirBarrio: data.dir_barrio,
    dirCiudad: data.dir_ciudad,
    dirDepartamento: data.dir_departamento,
    dirIndicaciones: data.dir_indicaciones,
    asesorCodigo: data.asesor_codigo,
    valorDomicilio: data.valor_domicilio,
    descuento: data.descuento,
    subtotal: data.subtotal,
    total: data.total,
    totalKg: data.total_kg,
    observaciones: data.observaciones,
    items: (data.pedido_items ?? [])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .sort((a: any, b: any) => a.orden - b.orden)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((i: any) => ({
        productoId: i.producto_id,
        descripcion: i.descripcion,
        cantidad: i.cantidad,
        precioUnitario: i.precio_unitario,
        subtotal: i.subtotal,
      })),
  }
}

export async function anularPedido(id: string, motivo: string): Promise<void> {
  if (!motivo.trim()) throw new Error('Anular exige un motivo')

  const supabase = await crearClienteServidor()
  const { data: pedido } = await supabase.from('pedidos').select('estado').eq('id', id).single()
  if (!pedido) throw new Error('No se encontró el pedido')

  if (!puedeTransicionar(pedido.estado, 'anulado')) {
    throw new Error(`Un pedido en estado "${pedido.estado}" no se puede anular`)
  }

  const usuario = await obtenerUsuarioActual()
  const { error } = await supabase
    .from('pedidos')
    .update({
      estado: 'anulado',
      anulado_motivo: motivo.trim(),
      anulado_por: usuario?.id ?? null,
      anulado_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) throw new Error(`No se pudo anular: ${error.message}`)
}
```

- [ ] **Paso 5: Correr todas las pruebas**

```bash
npm run test && npm run test:integracion && npm run build
```

Esperado: unitarias PASS, integración PASS (2 pruebas), build exitoso.

- [ ] **Paso 6: Commit**

```bash
git add -A
git commit -m "feat: repositorio de pedidos con confirmación, congelado de datos y anulación"
```

---

### Tarea 11: Buscador de cliente con creación en línea

**Archivos:**
- Crear: `src/components/pedido/BuscadorCliente.tsx`

**Interfaces:**
- Consume: `buscarClientes`, `crearCliente` de `@/lib/db/clientes`; `Cliente`, `Direccion` de `@/lib/tipos`
- Produce: `<BuscadorCliente onSeleccionar={(cliente: Cliente) => void} />`

- [ ] **Paso 1: Escribir el componente**

Crear `src/components/pedido/BuscadorCliente.tsx`:

```tsx
'use client'

import { useEffect, useState } from 'react'
import { buscarClientes, crearCliente } from '@/lib/db/clientes'
import type { Cliente } from '@/lib/tipos'

const FORM_VACIO = {
  nombre: '', telefono: '', cedula: '',
  linea: '', barrio: '', ciudad: '', departamento: '', indicaciones: '',
}

export function BuscadorCliente({ onSeleccionar }: { onSeleccionar: (c: Cliente) => void }) {
  const [texto, setTexto] = useState('')
  const [resultados, setResultados] = useState<Cliente[]>([])
  const [creando, setCreando] = useState(false)
  const [form, setForm] = useState(FORM_VACIO)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (creando) return
    const temporizador = setTimeout(async () => {
      setResultados(texto.trim().length >= 2 ? await buscarClientes(texto) : [])
    }, 200)
    return () => clearTimeout(temporizador)
  }, [texto, creando])

  function abrirCreacion() {
    setForm({ ...FORM_VACIO, nombre: texto.trim() })
    setCreando(true)
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault()
    setGuardando(true)
    setError(null)
    try {
      const cliente = await crearCliente(
        { nombre: form.nombre, telefono: form.telefono, cedula: form.cedula, tipo: 'detal' },
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

  if (creando) {
    return (
      <form onSubmit={guardar} className="space-y-2 rounded-lg border-2 border-emerald-500 bg-emerald-50 p-3">
        <p className="text-xs font-bold tracking-wider text-emerald-700">CLIENTE NUEVO</p>
        <input required autoFocus placeholder="Nombre" value={form.nombre}
          onChange={(e) => setForm({ ...form, nombre: e.target.value })}
          className="w-full rounded border px-2 py-1.5 text-sm" />
        <div className="grid grid-cols-2 gap-2">
          <input placeholder="Teléfono" value={form.telefono}
            onChange={(e) => setForm({ ...form, telefono: e.target.value })}
            className="rounded border px-2 py-1.5 text-sm" />
          <input placeholder="Cédula (opcional)" value={form.cedula}
            onChange={(e) => setForm({ ...form, cedula: e.target.value })}
            className="rounded border px-2 py-1.5 text-sm" />
        </div>
        <input required placeholder="Dirección" value={form.linea}
          onChange={(e) => setForm({ ...form, linea: e.target.value })}
          className="w-full rounded border px-2 py-1.5 text-sm" />
        <div className="grid grid-cols-3 gap-2">
          <input placeholder="Barrio" value={form.barrio}
            onChange={(e) => setForm({ ...form, barrio: e.target.value })}
            className="rounded border px-2 py-1.5 text-sm" />
          <input required placeholder="Ciudad" value={form.ciudad}
            onChange={(e) => setForm({ ...form, ciudad: e.target.value })}
            className="rounded border px-2 py-1.5 text-sm" />
          <input placeholder="Depto." value={form.departamento}
            onChange={(e) => setForm({ ...form, departamento: e.target.value })}
            className="rounded border px-2 py-1.5 text-sm" />
        </div>
        <input placeholder="Indicaciones (portería, timbre…)" value={form.indicaciones}
          onChange={(e) => setForm({ ...form, indicaciones: e.target.value })}
          className="w-full rounded border px-2 py-1.5 text-sm" />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex gap-2">
          <button type="submit" disabled={guardando}
            className="rounded bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50">
            {guardando ? 'Guardando…' : 'Guardar y usar'}
          </button>
          <button type="button" onClick={() => setCreando(false)}
            className="rounded border px-3 py-1.5 text-sm">Cancelar</button>
        </div>
      </form>
    )
  }

  return (
    <div className="relative">
      <input
        autoFocus value={texto} onChange={(e) => setTexto(e.target.value)}
        placeholder="🔍 Buscar cliente por nombre, teléfono o código…"
        className="w-full rounded-lg border-2 border-blue-600 px-3 py-2 text-sm outline-none"
      />
      {texto.trim().length >= 2 && (
        <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border bg-white shadow-lg">
          {resultados.map((cliente) => (
            <button key={cliente.id} type="button"
              onClick={() => { onSeleccionar(cliente); setTexto('') }}
              className="flex w-full items-center justify-between border-b px-3 py-2 text-left hover:bg-blue-50">
              <span>
                <span className="block text-sm font-semibold">{cliente.nombre}</span>
                <span className="block text-xs text-slate-500">
                  {cliente.telefono} · {cliente.direcciones?.[0]?.ciudad}
                </span>
              </span>
              <span className="rounded bg-blue-100 px-1.5 py-0.5 font-mono text-[10px] text-blue-700">
                {cliente.codigo}
              </span>
            </button>
          ))}
          <button type="button" onClick={abrirCreacion}
            className="w-full px-3 py-2 text-left text-sm font-semibold text-emerald-700 hover:bg-emerald-50">
            ＋ Crear cliente nuevo &ldquo;{texto.trim()}&rdquo;
          </button>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Paso 2: Verificar que compila**

Ejecutar: `npm run build`
Esperado: build exitoso.

- [ ] **Paso 3: Commit**

```bash
git add src/components/pedido/BuscadorCliente.tsx
git commit -m "feat: buscador de clientes con creación sin salir del pedido"
```

---

### Tarea 12: Grilla de sabores y resumen del pedido

**Archivos:**
- Crear: `src/components/pedido/GrillaSabores.tsx`, `src/components/pedido/ResumenPedido.tsx`

**Interfaces:**
- Consume: `Producto`, `ItemPedido`, `Totales`, `TipoEntrega`, `EstadoPago`; `formatearPesos`; `calcularTotales`
- Produce:
  - `<GrillaSabores productos={Producto[]} cantidades={Record<string, number>} onSumar={(p: Producto) => void} onRestar={(p: Producto) => void} onItemLibre={(descripcion: string, precio: number) => void} />`
  - `<ResumenPedido items={ItemPedido[]} totales={Totales} ... />`

- [ ] **Paso 1: Escribir la grilla**

Crear `src/components/pedido/GrillaSabores.tsx`:

```tsx
'use client'

import { useState } from 'react'
import type { Producto } from '@/lib/tipos'
import { formatearPesos } from '@/lib/dinero'

interface Props {
  productos: Producto[]
  cantidades: Record<string, number>
  onSumar: (producto: Producto) => void
  onRestar: (producto: Producto) => void
  onItemLibre: (descripcion: string, precio: number) => void
}

export function GrillaSabores({ productos, cantidades, onSumar, onRestar, onItemLibre }: Props) {
  const [filtro, setFiltro] = useState('')
  const [abriendoLibre, setAbriendoLibre] = useState(false)
  const [descripcion, setDescripcion] = useState('')
  const [precio, setPrecio] = useState('')

  const visibles = productos.filter((p) =>
    p.nombre.toLowerCase().includes(filtro.trim().toLowerCase()),
  )

  const porPrecio = visibles.reduce<Record<number, Producto[]>>((grupos, producto) => {
    ;(grupos[producto.precio] ??= []).push(producto)
    return grupos
  }, {})

  function agregarLibre() {
    const valor = Number(precio.replace(/\D/g, ''))
    if (!descripcion.trim() || valor <= 0) return
    onItemLibre(descripcion.trim(), valor)
    setDescripcion(''); setPrecio(''); setAbriendoLibre(false)
  }

  return (
    <div className="rounded-lg border bg-white p-3">
      <input
        value={filtro} onChange={(e) => setFiltro(e.target.value)}
        placeholder="Escribe para filtrar sabores…"
        className="mb-3 w-full rounded border px-2 py-1.5 text-sm"
      />

      {Object.entries(porPrecio)
        .sort(([a], [b]) => Number(a) - Number(b))
        .map(([precioGrupo, delGrupo]) => (
          <div key={precioGrupo} className="mb-3">
            <p className="mb-1.5 text-[11px] font-bold text-slate-400">
              {formatearPesos(Number(precioGrupo))}
            </p>
            <div className="grid grid-cols-4 gap-1.5">
              {delGrupo.map((producto) => {
                const cantidad = cantidades[producto.id] ?? 0
                return (
                  <button
                    key={producto.id} type="button"
                    onClick={() => onSumar(producto)}
                    onContextMenu={(e) => { e.preventDefault(); onRestar(producto) }}
                    className={`relative rounded-md border px-1.5 py-2 text-xs ${
                      cantidad > 0
                        ? 'border-blue-600 bg-blue-600 font-semibold text-white'
                        : 'border-slate-200 text-slate-700 hover:border-blue-400'
                    }`}
                  >
                    {producto.nombre} {producto.emoji}
                    {cantidad > 0 && (
                      <span className="absolute -right-1.5 -top-1.5 min-w-[19px] rounded-full bg-red-600 text-[11px] leading-[19px] text-white">
                        {cantidad}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        ))}

      {abriendoLibre ? (
        <div className="flex gap-2 rounded-md border border-dashed border-amber-500 bg-amber-50 p-2">
          <input autoFocus value={descripcion} onChange={(e) => setDescripcion(e.target.value)}
            placeholder="Qué es" className="flex-1 rounded border px-2 py-1 text-sm" />
          <input value={precio} onChange={(e) => setPrecio(e.target.value)}
            placeholder="Precio" inputMode="numeric" className="w-24 rounded border px-2 py-1 text-sm" />
          <button type="button" onClick={agregarLibre}
            className="rounded bg-amber-600 px-3 text-sm font-semibold text-white">Agregar</button>
        </div>
      ) : (
        <button type="button" onClick={() => setAbriendoLibre(true)}
          className="w-full rounded-md border border-dashed border-amber-500 bg-amber-50 py-2 text-xs font-semibold text-amber-700">
          ＋ Ítem libre
        </button>
      )}

      <p className="mt-2 text-[11px] text-slate-400">
        Clic para sumar · clic derecho para restar
      </p>
    </div>
  )
}
```

- [ ] **Paso 2: Escribir el resumen**

Crear `src/components/pedido/ResumenPedido.tsx`:

```tsx
'use client'

import type { ItemPedido, Totales, TipoEntrega, EstadoPago } from '@/lib/tipos'
import { formatearPesos, formatearPesosSinSimbolo } from '@/lib/dinero'
import { calcularSubtotalItem } from '@/lib/pedidos/calculos'

interface Props {
  items: ItemPedido[]
  totales: Totales
  valorDomicilio: number
  tipoEntrega: TipoEntrega
  transportadora: string
  estadoPago: EstadoPago
  observaciones: string
  problemas: string[]
  confirmando: boolean
  onCambiarDomicilio: (valor: number) => void
  onCambiarEntrega: (tipo: TipoEntrega) => void
  onCambiarTransportadora: (nombre: string) => void
  onCambiarPago: (estado: EstadoPago) => void
  onCambiarObservaciones: (texto: string) => void
  onConfirmar: () => void
}

export function ResumenPedido(p: Props) {
  const bloqueado = p.problemas.length > 0 || p.confirmando

  return (
    <div className="overflow-hidden rounded-lg border bg-white">
      <p className="border-b bg-slate-50 px-3 py-2 text-[10px] font-bold tracking-wider text-slate-500">
        EL PEDIDO
      </p>

      <div className="px-3 py-2 text-sm">
        {p.items.length === 0 && <p className="py-3 text-center text-slate-400">Sin productos</p>}

        {p.items.map((item, i) => (
          <div key={i} className="flex justify-between border-b border-slate-50 py-1">
            <span><strong>{item.cantidad}</strong> × {item.descripcion}</span>
            <span className="tabular-nums">{formatearPesosSinSimbolo(calcularSubtotalItem(item))}</span>
          </div>
        ))}

        <div className="flex justify-between pt-2 text-slate-500">
          <span>Subtotal · {p.totales.totalKg} kg</span>
          <span className="tabular-nums">{formatearPesosSinSimbolo(p.totales.subtotal)}</span>
        </div>
        <div className="flex items-center justify-between text-slate-500">
          <span>Domicilio</span>
          <input
            value={p.valorDomicilio || ''} inputMode="numeric"
            onChange={(e) => p.onCambiarDomicilio(Number(e.target.value.replace(/\D/g, '')) || 0)}
            className="w-24 rounded border px-2 py-0.5 text-right text-sm tabular-nums"
          />
        </div>
        <div className="mt-1 flex justify-between border-t-2 border-slate-900 pt-2 text-lg font-extrabold">
          <span>TOTAL</span>
          <span className="tabular-nums">{formatearPesos(p.totales.total)}</span>
        </div>
      </div>

      <div className="space-y-3 px-3 pb-3">
        <div>
          <p className="mb-1 text-[10px] font-bold tracking-wider text-slate-400">ENTREGA</p>
          <div className="flex gap-1.5">
            {(['local', 'nacional'] as TipoEntrega[]).map((tipo) => (
              <button key={tipo} type="button" onClick={() => p.onCambiarEntrega(tipo)}
                className={`flex-1 rounded-md py-1.5 text-xs ${
                  p.tipoEntrega === tipo
                    ? 'border-2 border-slate-900 bg-slate-900 font-semibold text-white'
                    : 'border border-slate-200 text-slate-700'
                }`}>
                {tipo === 'local' ? '🛵 Local' : '📦 Nacional'}
              </button>
            ))}
          </div>
          {p.tipoEntrega === 'nacional' && (
            <input value={p.transportadora} onChange={(e) => p.onCambiarTransportadora(e.target.value)}
              placeholder="Transportadora" className="mt-1.5 w-full rounded border px-2 py-1 text-sm" />
          )}
        </div>

        <div>
          <p className="mb-1 text-[10px] font-bold tracking-wider text-slate-400">PAGO</p>
          <div className="flex gap-1.5">
            {(['pendiente', 'contraentrega', 'pagado'] as EstadoPago[]).map((estado) => (
              <button key={estado} type="button" onClick={() => p.onCambiarPago(estado)}
                className={`flex-1 rounded-md py-1.5 text-[11px] ${
                  p.estadoPago === estado
                    ? 'border-2 border-amber-600 bg-amber-50 font-semibold text-amber-700'
                    : 'border border-slate-200 text-slate-700'
                }`}>
                {estado === 'contraentrega' ? 'Contraent.' : estado === 'pagado' ? 'Pagado' : 'Pendiente'}
              </button>
            ))}
          </div>
        </div>

        <textarea
          value={p.observaciones} onChange={(e) => p.onCambiarObservaciones(e.target.value)}
          placeholder="Observaciones…" rows={2}
          className="w-full rounded border px-2 py-1 text-sm"
        />

        {p.problemas.length > 0 && (
          <ul className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
            {p.problemas.map((problema) => <li key={problema}>· {problema}</li>)}
          </ul>
        )}

        <button
          type="button" onClick={p.onConfirmar} disabled={bloqueado}
          className="w-full rounded-lg bg-emerald-600 py-2.5 font-bold text-white disabled:bg-slate-300"
        >
          {p.confirmando ? 'Generando…' : 'Generar recibo + rótulo'}
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Paso 3: Verificar que compila**

Ejecutar: `npm run build`
Esperado: build exitoso.

- [ ] **Paso 4: Commit**

```bash
git add src/components/pedido/
git commit -m "feat: grilla de sabores con ítem libre y resumen del pedido"
```

---

### Tarea 13: Pantalla de tomar pedido

**Archivos:**
- Crear: `src/app/(app)/pedidos/nuevo/page.tsx`, `src/app/(app)/pedidos/nuevo/FormularioPedido.tsx`

**Interfaces:**
- Consume: todo lo anterior
- Produce: la ruta `/pedidos/nuevo`, que al confirmar navega a `/pedidos/<id>/documentos`

- [ ] **Paso 1: Escribir la página servidor**

Crear `src/app/(app)/pedidos/nuevo/page.tsx`:

```tsx
import { listarProductosActivos } from '@/lib/db/productos'
import { obtenerAjustes } from '@/lib/db/ajustes'
import { FormularioPedido } from './FormularioPedido'

export default async function NuevoPedido() {
  const [productos, ajustes] = await Promise.all([listarProductosActivos(), obtenerAjustes()])
  return <FormularioPedido productos={productos} valorDomicilioDefault={ajustes.valorDomicilioDefault} />
}
```

- [ ] **Paso 2: Escribir el formulario**

Crear `src/app/(app)/pedidos/nuevo/FormularioPedido.tsx`:

```tsx
'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { BuscadorCliente } from '@/components/pedido/BuscadorCliente'
import { GrillaSabores } from '@/components/pedido/GrillaSabores'
import { ResumenPedido } from '@/components/pedido/ResumenPedido'
import { calcularTotales } from '@/lib/pedidos/calculos'
import { validarParaConfirmar } from '@/lib/pedidos/validacion'
import { crearBorrador, guardarBorrador, confirmarPedido } from '@/lib/db/pedidos'
import type {
  Cliente, Direccion, ItemPedido, Producto, TipoEntrega, EstadoPago,
} from '@/lib/tipos'

interface Props { productos: Producto[]; valorDomicilioDefault: number }

export function FormularioPedido({ productos, valorDomicilioDefault }: Props) {
  const router = useRouter()

  const [cliente, setCliente] = useState<Cliente | null>(null)
  const [direccion, setDireccion] = useState<Direccion | null>(null)
  const [items, setItems] = useState<ItemPedido[]>([])
  const [tipoEntrega, setTipoEntrega] = useState<TipoEntrega>('local')
  const [transportadora, setTransportadora] = useState('')
  const [estadoPago, setEstadoPago] = useState<EstadoPago>('pendiente')
  const [valorDomicilio, setValorDomicilio] = useState(valorDomicilioDefault)
  const [observaciones, setObservaciones] = useState('')
  const [confirmando, setConfirmando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const totales = useMemo(
    () => calcularTotales(items, valorDomicilio, 0),
    [items, valorDomicilio],
  )

  const cantidades = useMemo(
    () => items.reduce<Record<string, number>>((mapa, item) => {
      if (item.productoId) mapa[item.productoId] = item.cantidad
      return mapa
    }, {}),
    [items],
  )

  const problemas = validarParaConfirmar({
    clienteId: cliente?.id ?? null,
    direccionId: direccion?.id ?? null,
    items, tipoEntrega,
    transportadora: transportadora || null,
  })

  function escogerCliente(nuevo: Cliente) {
    setCliente(nuevo)
    setDireccion(nuevo.direcciones?.find((d) => d.esPrincipal) ?? nuevo.direcciones?.[0] ?? null)
  }

  function sumar(producto: Producto) {
    setItems((previos) => {
      const existente = previos.find((i) => i.productoId === producto.id)
      if (existente) {
        return previos.map((i) =>
          i.productoId === producto.id ? { ...i, cantidad: i.cantidad + 1 } : i,
        )
      }
      return [...previos, {
        productoId: producto.id,
        descripcion: producto.nombre,
        cantidad: 1,
        precioUnitario: producto.precio,   // precio congelado
      }]
    })
  }

  function restar(producto: Producto) {
    setItems((previos) =>
      previos
        .map((i) => (i.productoId === producto.id ? { ...i, cantidad: i.cantidad - 1 } : i))
        .filter((i) => i.cantidad > 0),
    )
  }

  function agregarLibre(descripcion: string, precio: number) {
    setItems((previos) => [...previos, {
      productoId: null, descripcion, cantidad: 1, precioUnitario: precio,
    }])
  }

  async function confirmar() {
    setConfirmando(true)
    setError(null)
    try {
      const id = await crearBorrador()
      await guardarBorrador(id, {
        clienteId: cliente!.id,
        direccionId: direccion!.id,
        items, tipoEntrega,
        transportadora: transportadora || null,
        estadoPago, valorDomicilio, descuento: 0, observaciones,
      })
      await confirmarPedido(id)
      router.push(`/pedidos/${id}/documentos`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo confirmar el pedido')
      setConfirmando(false)
    }
  }

  return (
    <div className="mx-auto max-w-6xl p-4">
      <h1 className="mb-3 text-lg font-bold">Nuevo pedido</h1>

      <div className="flex items-start gap-4">
        <div className="flex-[1.55]">
          <p className="mb-1 text-[10px] font-bold tracking-wider text-slate-500">1 · CLIENTE</p>
          {cliente ? (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-2.5 text-sm">
              <div className="flex items-start justify-between">
                <div>
                  <strong>{cliente.nombre}</strong>{' '}
                  <span className="rounded-full bg-emerald-100 px-1.5 text-[10px] text-emerald-700">
                    {cliente.codigo}
                  </span>
                  <div className="text-slate-600">
                    {direccion?.linea} · {direccion?.barrio} · {direccion?.ciudad}
                  </div>
                  <div className="text-slate-600">{cliente.telefono}</div>
                </div>
                <button type="button" onClick={() => { setCliente(null); setDireccion(null) }}
                  className="text-xs text-blue-600">cambiar</button>
              </div>
              {(cliente.direcciones?.length ?? 0) > 1 && (
                <select
                  value={direccion?.id}
                  onChange={(e) =>
                    setDireccion(cliente.direcciones!.find((d) => d.id === e.target.value)!)
                  }
                  className="mt-2 w-full rounded border px-2 py-1 text-xs"
                >
                  {cliente.direcciones!.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.etiqueta ?? d.linea} — {d.ciudad}
                    </option>
                  ))}
                </select>
              )}
            </div>
          ) : (
            <BuscadorCliente onSeleccionar={escogerCliente} />
          )}

          <p className="mb-1 mt-4 text-[10px] font-bold tracking-wider text-slate-500">2 · SABORES</p>
          <GrillaSabores
            productos={productos} cantidades={cantidades}
            onSumar={sumar} onRestar={restar} onItemLibre={agregarLibre}
          />
        </div>

        <div className="flex-1">
          <ResumenPedido
            items={items} totales={totales} valorDomicilio={valorDomicilio}
            tipoEntrega={tipoEntrega} transportadora={transportadora}
            estadoPago={estadoPago} observaciones={observaciones}
            problemas={problemas} confirmando={confirmando}
            onCambiarDomicilio={setValorDomicilio}
            onCambiarEntrega={setTipoEntrega}
            onCambiarTransportadora={setTransportadora}
            onCambiarPago={setEstadoPago}
            onCambiarObservaciones={setObservaciones}
            onConfirmar={confirmar}
          />
          {error && <p className="mt-2 rounded bg-red-50 p-2 text-sm text-red-700">{error}</p>}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Paso 3: Probar a mano**

Ejecutar `npm run dev`, entrar a `/pedidos/nuevo` y verificar: buscar un cliente inexistente muestra "Crear cliente nuevo"; crearlo lo selecciona; sumar sabores actualiza total y kilos; el botón está bloqueado mientras haya problemas.

- [ ] **Paso 4: Commit**

```bash
git add src/app/\(app\)/pedidos/
git commit -m "feat: pantalla de tomar pedido en una sola vista"
```

---

## FASE 3 — SALIDAS

### Tarea 14: Estilos de impresión

**Archivos:**
- Modificar: `src/app/globals.css`

**Interfaces:**
- Produce: clases `.hoja-recibo`, `.hoja-rotulo`, `.solo-pantalla`

**Nota:** `@page` **no se puede anidar dentro de un selector** — no es CSS válido. El tamaño de página se cambia inyectando la regla desde JavaScript justo antes de imprimir (Tarea 17).

- [ ] **Paso 1: Agregar los estilos**

Añadir al final de `src/app/globals.css`:

```css
/* --- Documentos imprimibles ---------------------------------------------
   El mismo DOM se usa para la imagen de WhatsApp y para el papel.
   El tamaño de página lo inyecta VistaDocumentos antes de imprimir.    */

.hoja-recibo {
  width: 80mm;
  background: #fff;
  color: #000;
  font-family: 'Arial Narrow', 'Roboto Condensed', system-ui, sans-serif;
  padding: 4mm 3mm;
}

.hoja-rotulo {
  width: 100mm;
  height: 150mm;
  background: #fff;
  color: #000;
  font-family: system-ui, -apple-system, sans-serif;
  padding: 5mm;
  display: flex;
  flex-direction: column;
}

@media print {
  .solo-pantalla { display: none !important; }

  body { background: #fff; margin: 0; }

  .hoja-recibo, .hoja-rotulo {
    box-shadow: none;
    margin: 0;
    page-break-after: always;
  }

  /* La térmica quema puntos negros: nada de grises ni fondos claros. */
  * {
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
}

@page { margin: 0; }
```

Sobre el bloque `*` con `print-color-adjust: exact`: sin él, el navegador "ahorra tinta" y convierte las barras negras del recibo en gris claro, que en una térmica sale como una mancha ilegible.

- [ ] **Paso 2: Commit**

```bash
git add src/app/globals.css
git commit -m "feat: estilos de impresión para recibo de 80 mm y rótulos"
```

---

### Tarea 15: Plantilla del recibo

**Archivos:**
- Crear: `src/components/documentos/Recibo.tsx`
- Crear test: `src/components/documentos/Recibo.test.tsx`

**Interfaces:**
- Consume: `PedidoCompleto` de `@/lib/db/pedidos`; `Ajustes` de `@/lib/db/ajustes`; `formatearPesos`, `formatearPesosSinSimbolo`; `valorEnLetras`
- Produce: `<Recibo pedido={PedidoCompleto} ajustes={Ajustes} />`

- [ ] **Paso 1: Escribir la prueba**

Crear `src/components/documentos/Recibo.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Recibo } from './Recibo'
import type { PedidoCompleto } from '@/lib/db/pedidos'
import type { Ajustes } from '@/lib/db/ajustes'

const ajustes: Ajustes = {
  nombreNegocio: 'MI NEGOCIO', eslogan: 'Helado Artesanal', logoUrl: null,
  telefonos: '305 724 10 22 - 313 880 88 62', datosPago: 'Nequi 305 724 10 22',
  prefijoConsecutivo: 'PED', valorDomicilioDefault: 8000,
  etiquetaAnchoMm: 100, etiquetaAltoMm: 150, pieRecibo: 'Gracias por su compra',
}

const pedido: PedidoCompleto = {
  id: 'p1', consecutivo: 'PED-000148', fecha: '2026-08-11T21:17:00.000Z',
  estado: 'confirmado', estadoPago: 'pendiente', tipoEntrega: 'local',
  transportadora: null, fechaPago: null,
  clienteCodigo: 'CL-0042', clienteNombre: 'Juanito González',
  clienteTelefono: '312 456 7890', clienteCedula: '1017456789',
  dirLinea: 'Cra 45 # 23-18', dirBarrio: 'La Floresta', dirCiudad: 'Medellín',
  dirDepartamento: 'Antioquia', dirIndicaciones: 'Portería, timbre 302',
  asesorCodigo: '002', valorDomicilio: 8000, descuento: 0,
  subtotal: 232000, total: 240000, totalKg: 10, observaciones: 'Pago contraentrega',
  items: [
    { productoId: 'a', descripcion: 'Vainilla', cantidad: 4, precioUnitario: 22000, subtotal: 88000 },
    { productoId: 'b', descripcion: 'Frutos Rojos', cantidad: 2, precioUnitario: 22000, subtotal: 44000 },
    { productoId: 'c', descripcion: 'Maracuyá', cantidad: 4, precioUnitario: 25000, subtotal: 100000 },
  ],
}

describe('Recibo', () => {
  it('muestra el consecutivo', () => {
    render(<Recibo pedido={pedido} ajustes={ajustes} />)
    expect(screen.getByText(/PED-000148/)).toBeDefined()
  })

  it('muestra el total y el total en letras', () => {
    render(<Recibo pedido={pedido} ajustes={ajustes} />)
    expect(screen.getByText('$ 240.000')).toBeDefined()
    expect(screen.getByText('Doscientos cuarenta mil M/cte')).toBeDefined()
  })

  it('resume los kilos arriba del detalle', () => {
    render(<Recibo pedido={pedido} ajustes={ajustes} />)
    expect(screen.getByText(/10 Kg/)).toBeDefined()
  })

  it('enmascara la cédula dejando solo los primeros cuatro dígitos', () => {
    render(<Recibo pedido={pedido} ajustes={ajustes} />)
    expect(screen.getByText('1017xxxxxx')).toBeDefined()
    expect(screen.queryByText('1017456789')).toBeNull()
  })

  it('muestra PENDIENTE DE PAGO con los datos de pago cuando no está pagado', () => {
    render(<Recibo pedido={pedido} ajustes={ajustes} />)
    expect(screen.getByText('PENDIENTE DE PAGO')).toBeDefined()
    expect(screen.getByText(/Nequi 305 724 10 22/)).toBeDefined()
  })

  it('muestra PAGADO cuando el pedido ya se pagó', () => {
    render(
      <Recibo
        pedido={{ ...pedido, estadoPago: 'pagado', fechaPago: '2026-08-11T22:00:00.000Z' }}
        ajustes={ajustes}
      />,
    )
    expect(screen.getByText(/PAGADO/)).toBeDefined()
    expect(screen.queryByText('PENDIENTE DE PAGO')).toBeNull()
  })

  it('muestra el precio unitario solo cuando la cantidad es mayor a 1', () => {
    render(
      <Recibo
        pedido={{
          ...pedido,
          items: [
            { productoId: 'a', descripcion: 'Vainilla', cantidad: 4, precioUnitario: 22000, subtotal: 88000 },
            { productoId: 'b', descripcion: 'Coco', cantidad: 1, precioUnitario: 22000, subtotal: 22000 },
          ],
        }}
        ajustes={ajustes}
      />,
    )
    expect(screen.getByText('4 kg × $ 22.000')).toBeDefined()
    expect(screen.queryByText('1 kg × $ 22.000')).toBeNull()
  })
})
```

- [ ] **Paso 2: Correr para verificar que falla**

Ejecutar: `npm run test -- Recibo`
Esperado: FAIL — no se encuentra el módulo.

- [ ] **Paso 3: Implementar**

Crear `src/components/documentos/Recibo.tsx`:

```tsx
import type { PedidoCompleto } from '@/lib/db/pedidos'
import type { Ajustes } from '@/lib/db/ajustes'
import { formatearPesos, formatearPesosSinSimbolo } from '@/lib/dinero'
import { valorEnLetras } from '@/lib/numero-a-letras'

/** La cédula se muestra parcial: es el recibo del propio cliente,
 *  pero el papel puede quedar a la vista de terceros. */
function enmascararCedula(cedula: string | null): string {
  if (!cedula) return '—'
  const limpia = cedula.replace(/\D/g, '')
  if (limpia.length <= 4) return limpia
  return `${limpia.slice(0, 4)}${'x'.repeat(limpia.length - 4)}`
}

function formatearFecha(iso: string): string {
  return new Date(iso).toLocaleString('es-CO', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: 'numeric', minute: '2-digit', hour12: true,
  })
}

export function Recibo({ pedido, ajustes }: { pedido: PedidoCompleto; ajustes: Ajustes }) {
  const pagado = pedido.estadoPago === 'pagado'

  return (
    <div className="hoja-recibo text-[14px] leading-[1.34]">
      <div className="text-center">
        {ajustes.logoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={ajustes.logoUrl} alt="" className="mx-auto mb-1 h-14 object-contain" />
        )}
        <div className="text-[22px] font-black leading-tight">{ajustes.nombreNegocio}</div>
        <div className="mx-auto my-1 w-[72%] border-t-[3px] border-black" />
        <div className="text-[15px] font-extrabold">{ajustes.eslogan}</div>
        <div className="text-[12.5px]">PEDIDOS : {ajustes.telefonos}</div>
      </div>

      <div className="my-2 text-center text-[18px] font-black tracking-wider">
        ORDEN No. {pedido.consecutivo}
      </div>

      <div className="grid grid-cols-[74px_1fr] gap-y-0.5 text-[13.5px] leading-tight">
        <div className="font-extrabold">Cliente:</div><div>{pedido.clienteNombre}</div>
        <div className="font-extrabold">Fecha:</div><div>{formatearFecha(pedido.fecha)}</div>
        <div className="font-extrabold">Cédula:</div><div>{enmascararCedula(pedido.clienteCedula)}</div>
        <div className="font-extrabold">Teléfono:</div><div>{pedido.clienteTelefono ?? '—'}</div>
        <div className="font-extrabold">Asesor:</div><div>{pedido.asesorCodigo ?? '—'}</div>
        <div className="font-extrabold">Envío:</div>
        <div>
          {pedido.tipoEntrega === 'local'
            ? 'Local · domicilio propio'
            : `Nacional · ${pedido.transportadora ?? ''}`}
        </div>
        <div className="font-extrabold">Dirección:</div>
        <div>
          {pedido.dirLinea}
          <br />
          {[pedido.dirBarrio, pedido.dirCiudad].filter(Boolean).join(' · ')}
        </div>
      </div>

      <div className="my-2 bg-black py-0.5 text-center text-[14.5px] font-extrabold text-white">
        Detalle del Pedido
      </div>

      <div className="mb-1.5 text-[13.5px]">
        {pedido.totalKg} Kg · Helado Artesanal en tarro
      </div>

      <div className="text-[14.5px] leading-[1.5]">
        {pedido.items.map((item, i) => (
          <div key={i}>
            <div className="flex items-baseline">
              <span>{item.cantidad} {item.descripcion}</span>
              <span className="mx-1 mb-1 flex-1 border-b-2 border-dotted border-black" />
              <span className="tabular-nums">{formatearPesos(item.subtotal)}</span>
            </div>
            {item.cantidad > 1 && (
              <div className="-mt-1 pl-3 text-[11px]">
                {item.cantidad} kg × {formatearPesos(item.precioUnitario)}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="my-2 border-t-2 border-dashed border-black" />

      <div className="text-right text-[14.5px] leading-[1.5]">
        <div>
          <strong>Subtotal:</strong>{' '}
          <span className="inline-block w-20 text-right tabular-nums">
            {formatearPesos(pedido.subtotal)}
          </span>
        </div>
        <div>
          <strong>Valor Domicilio:</strong>{' '}
          <span className="inline-block w-20 text-right tabular-nums">
            {formatearPesos(pedido.valorDomicilio)}
          </span>
        </div>
      </div>

      <div className="my-2 flex justify-between bg-black px-2 py-1 text-[17px] font-black text-white">
        <span>TOTAL:</span>
        <span className="tabular-nums">{formatearPesos(pedido.total)}</span>
      </div>

      <div className="text-[13.5px] leading-tight">
        <div><strong>Valor Total en Letras:</strong></div>
        <div>{valorEnLetras(pedido.total)}</div>
        {pedido.observaciones && (
          <>
            <div className="mt-1"><strong>Observaciones:</strong></div>
            <div>{pedido.observaciones}</div>
          </>
        )}
      </div>

      <div className="mt-2 border-2 border-black px-2 py-1 text-center text-[13px] leading-tight">
        {pagado ? (
          <>
            <strong className="text-[13.5px] tracking-wide">PAGADO ✓</strong>
            {pedido.fechaPago && <div>{formatearFecha(pedido.fechaPago)}</div>}
          </>
        ) : (
          <>
            <strong className="text-[13.5px] tracking-wide">PENDIENTE DE PAGO</strong>
            <div>{ajustes.datosPago}</div>
          </>
        )}
      </div>

      <div className="my-2 border-t-2 border-dashed border-black" />
      <div className="text-center text-[12px] leading-tight">
        <strong>❄ CONSERVAR EN FRÍO</strong>
        <br />
        {ajustes.pieRecibo}
      </div>
    </div>
  )
}
```

- [ ] **Paso 4: Configurar los matchers de Testing Library**

Crear `vitest.setup.ts`:

```ts
import '@testing-library/jest-dom/vitest'
```

Y en `vitest.config.ts`, dentro de `test`, agregar:

```ts
    setupFiles: ['./vitest.setup.ts'],
```

- [ ] **Paso 5: Correr las pruebas**

Ejecutar: `npm run test -- Recibo`
Esperado: PASS, 7 pruebas.

- [ ] **Paso 6: Commit**

```bash
git add src/components/documentos/Recibo.tsx src/components/documentos/Recibo.test.tsx vitest.setup.ts vitest.config.ts
git commit -m "feat: plantilla del recibo de 80 mm con total en letras y estado de pago"
```

---

### Tarea 16: Plantillas de los dos rótulos

**Archivos:**
- Crear: `src/components/documentos/RotuloLocal.tsx`, `src/components/documentos/RotuloNacional.tsx`
- Crear test: `src/components/documentos/Rotulos.test.tsx`

**Interfaces:**
- Consume: `PedidoCompleto`, `Ajustes`, `formatearPesos`
- Produce: `<RotuloLocal pedido ajustes />`, `<RotuloNacional pedido ajustes />`

- [ ] **Paso 1: Escribir las pruebas**

Crear `src/components/documentos/Rotulos.test.tsx`. La regla más importante del diseño —la cédula no viaja al rótulo— se prueba explícitamente:

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { RotuloLocal } from './RotuloLocal'
import { RotuloNacional } from './RotuloNacional'
import type { PedidoCompleto } from '@/lib/db/pedidos'
import type { Ajustes } from '@/lib/db/ajustes'

const ajustes: Ajustes = {
  nombreNegocio: 'MI NEGOCIO', eslogan: 'Helado Artesanal', logoUrl: null,
  telefonos: '305 724 10 22', datosPago: 'Nequi 305 724 10 22',
  prefijoConsecutivo: 'PED', valorDomicilioDefault: 8000,
  etiquetaAnchoMm: 100, etiquetaAltoMm: 150, pieRecibo: 'Gracias',
}

const base: PedidoCompleto = {
  id: 'p1', consecutivo: 'PED-000148', fecha: '2026-08-11T21:17:00.000Z',
  estado: 'confirmado', estadoPago: 'contraentrega', tipoEntrega: 'local',
  transportadora: null, fechaPago: null,
  clienteCodigo: 'CL-0042', clienteNombre: 'Juanito González',
  clienteTelefono: '312 456 7890', clienteCedula: '1017456789',
  dirLinea: 'Cra 45 # 23-18', dirBarrio: 'La Floresta', dirCiudad: 'Medellín',
  dirDepartamento: 'Antioquia', dirIndicaciones: 'Portería, timbre 302',
  asesorCodigo: '002', valorDomicilio: 8000, descuento: 0,
  subtotal: 232000, total: 240000, totalKg: 10, observaciones: null, items: [],
}

describe('RotuloLocal', () => {
  it('nunca imprime la cédula: imprime el código de cliente', () => {
    render(<RotuloLocal pedido={base} ajustes={ajustes} />)
    expect(screen.queryByText(/1017456789/)).toBeNull()
    expect(screen.getByText('CL-0042')).toBeDefined()
  })

  // El `uppercase` es de CSS y no cambia el texto del DOM: se afirma el texto real.
  it('destaca el barrio, que es por donde navega el mensajero', () => {
    render(<RotuloLocal pedido={base} ajustes={ajustes} />)
    expect(screen.getByText('La Floresta')).toBeDefined()
  })

  it('muestra el valor a cobrar cuando es contraentrega', () => {
    render(<RotuloLocal pedido={base} ajustes={ajustes} />)
    expect(screen.getByText('COBRAR CONTRAENTREGA')).toBeDefined()
    expect(screen.getByText('$ 240.000')).toBeDefined()
  })

  it('no muestra valor a cobrar si el pedido ya está pagado', () => {
    render(<RotuloLocal pedido={{ ...base, estadoPago: 'pagado' }} ajustes={ajustes} />)
    expect(screen.queryByText('COBRAR CONTRAENTREGA')).toBeNull()
  })

  it('lleva las indicaciones de entrega', () => {
    render(<RotuloLocal pedido={base} ajustes={ajustes} />)
    expect(screen.getByText(/Portería, timbre 302/)).toBeDefined()
  })

  it('lleva el aviso de congelado', () => {
    render(<RotuloLocal pedido={base} ajustes={ajustes} />)
    expect(screen.getByText(/CONGELADO/)).toBeDefined()
  })
})

describe('RotuloNacional', () => {
  const nacional: PedidoCompleto = {
    ...base, tipoEntrega: 'nacional', transportadora: 'ForEnvíos',
    dirCiudad: 'Barranquilla', dirDepartamento: 'Atlántico',
  }

  it('nunca imprime la cédula', () => {
    render(<RotuloNacional pedido={nacional} ajustes={ajustes} />)
    expect(screen.queryByText(/1017456789/)).toBeNull()
    expect(screen.getByText('CL-0042')).toBeDefined()
  })

  it('destaca la ciudad, que es por donde clasifica la transportadora', () => {
    render(<RotuloNacional pedido={nacional} ajustes={ajustes} />)
    expect(screen.getByText('Barranquilla')).toBeDefined()
  })

  it('NUNCA muestra el valor: la plata la maneja la transportadora', () => {
    render(<RotuloNacional pedido={nacional} ajustes={ajustes} />)
    expect(screen.queryByText('$ 240.000')).toBeNull()
    expect(screen.queryByText(/COBRAR/)).toBeNull()
  })

  it('lleva remitente, obligatorio para devoluciones', () => {
    render(<RotuloNacional pedido={nacional} ajustes={ajustes} />)
    expect(screen.getByText(/REMITE/)).toBeDefined()
    // Aparece dos veces: en el encabezado y en el remitente.
    expect(screen.getAllByText(/MI NEGOCIO/)).toHaveLength(2)
  })

  it('lleva el aviso de cadena de frío en grande', () => {
    render(<RotuloNacional pedido={nacional} ajustes={ajustes} />)
    expect(screen.getByText(/PRODUCTO CONGELADO/)).toBeDefined()
    expect(screen.getByText(/CADENA DE FRÍO/)).toBeDefined()
  })
})
```

- [ ] **Paso 2: Correr para verificar que falla**

Ejecutar: `npm run test -- Rotulos`
Esperado: FAIL — no se encuentran los módulos.

- [ ] **Paso 3: Implementar el rótulo local**

Crear `src/components/documentos/RotuloLocal.tsx`:

```tsx
import type { PedidoCompleto } from '@/lib/db/pedidos'
import type { Ajustes } from '@/lib/db/ajustes'
import { formatearPesos } from '@/lib/dinero'

export function RotuloLocal({ pedido, ajustes }: { pedido: PedidoCompleto; ajustes: Ajustes }) {
  const cobrar = pedido.estadoPago === 'contraentrega'

  return (
    <div
      className="hoja-rotulo"
      style={{ width: `${ajustes.etiquetaAnchoMm}mm`, height: `${ajustes.etiquetaAltoMm}mm` }}
    >
      <div className="flex items-center justify-between border-b-2 border-black pb-1 text-[10px] tracking-wide">
        <span className="font-extrabold">{ajustes.nombreNegocio}</span>
        <span className="font-mono">{pedido.consecutivo}</span>
      </div>

      <div className="mt-3 text-[9px] font-bold tracking-[0.13em]">ENTREGAR A</div>
      <div className="mt-0.5 text-[20px] font-extrabold uppercase leading-tight">
        {pedido.clienteNombre}
      </div>

      <div className="mt-2 text-[14px] font-semibold leading-snug">{pedido.dirLinea}</div>
      {pedido.dirBarrio && (
        <div className="mt-1 text-[15px] font-extrabold uppercase">{pedido.dirBarrio}</div>
      )}
      <div className="text-[12px]">{pedido.dirCiudad}</div>

      <div className="mt-2.5 text-[17px] font-extrabold">📞 {pedido.clienteTelefono}</div>

      {pedido.dirIndicaciones && (
        <div className="mt-2 text-[10.5px] italic leading-snug">
          &ldquo;{pedido.dirIndicaciones}&rdquo;
        </div>
      )}

      <div className="flex-1" />

      {cobrar && (
        <div className="mt-2 border-[3px] border-black p-2 text-center">
          <div className="text-[10px] font-extrabold tracking-[0.1em]">COBRAR CONTRAENTREGA</div>
          <div className="mt-0.5 text-[27px] font-extrabold leading-tight">
            {formatearPesos(pedido.total)}
          </div>
        </div>
      )}

      <div className="mt-2 flex items-center justify-between border-t border-black pt-1.5">
        <span className="font-mono text-[11px] font-bold">{pedido.clienteCodigo}</span>
        <span className="border-[1.5px] border-black px-1.5 py-0.5 text-[10px] font-extrabold">
          ❄ CONGELADO
        </span>
      </div>
    </div>
  )
}
```

- [ ] **Paso 4: Implementar el rótulo nacional**

Crear `src/components/documentos/RotuloNacional.tsx`:

```tsx
import type { PedidoCompleto } from '@/lib/db/pedidos'
import type { Ajustes } from '@/lib/db/ajustes'

export function RotuloNacional({ pedido, ajustes }: { pedido: PedidoCompleto; ajustes: Ajustes }) {
  return (
    <div
      className="hoja-rotulo"
      style={{ width: `${ajustes.etiquetaAnchoMm}mm`, height: `${ajustes.etiquetaAltoMm}mm` }}
    >
      <div className="flex items-center justify-between border-b-2 border-black pb-1 text-[10px] tracking-wide">
        <span className="font-extrabold">{ajustes.nombreNegocio}</span>
        <span className="font-mono">{pedido.consecutivo}</span>
      </div>

      <div className="mt-3 text-[9px] font-bold tracking-[0.13em]">DESTINATARIO</div>
      <div className="mt-0.5 text-[19px] font-extrabold uppercase leading-tight">
        {pedido.clienteNombre}
      </div>

      <div className="mt-2 text-[13.5px] font-semibold leading-snug">
        {pedido.dirLinea}
        {pedido.dirBarrio && <><br />{pedido.dirBarrio}</>}
      </div>

      <div className="mt-2 bg-black px-2 py-1.5 text-white">
        <div className="text-[8.5px] tracking-[0.12em] opacity-85">CIUDAD DESTINO</div>
        <div className="text-[21px] font-extrabold uppercase leading-tight">{pedido.dirCiudad}</div>
        {pedido.dirDepartamento && <div className="text-[11px]">{pedido.dirDepartamento}</div>}
      </div>

      <div className="mt-2.5 text-[16px] font-extrabold">📞 {pedido.clienteTelefono}</div>

      <div className="flex-1" />

      <div className="mt-2 border-[3px] border-black p-1.5 text-center">
        <div className="text-[13px] font-extrabold tracking-wide">❄ PRODUCTO CONGELADO</div>
        <div className="mt-0.5 text-[10px] leading-tight">
          MANTENER EN CADENA DE FRÍO
          <br />
          ENTREGA PRIORITARIA · NO DEMORAR
        </div>
      </div>

      <div className="mt-2 flex items-end justify-between border-t border-black pt-1.5">
        <div className="text-[8.5px] leading-snug">
          <strong>REMITE</strong>
          <br />
          {ajustes.nombreNegocio}
          <br />
          {ajustes.telefonos}
        </div>
        <div className="text-right">
          <div className="font-mono text-[12px] font-extrabold">{pedido.clienteCodigo}</div>
          <div className="text-[8px]">cliente</div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Paso 5: Correr las pruebas**

Ejecutar: `npm run test -- Rotulos`
Esperado: PASS, 11 pruebas.

- [ ] **Paso 6: Commit**

```bash
git add src/components/documentos/
git commit -m "feat: rótulos local y nacional, sin cédula y con aviso de cadena de frío"
```

---

### Tarea 17: Pantalla de documentos con impresión y PNG

**Archivos:**
- Crear: `src/lib/documentos/a-png.ts`, `src/app/(app)/pedidos/[id]/documentos/page.tsx`, `src/app/(app)/pedidos/[id]/documentos/VistaDocumentos.tsx`

**Interfaces:**
- Consume: `obtenerPedido`, `obtenerAjustes`, `Recibo`, `RotuloLocal`, `RotuloNacional`
- Produce:
  - `descargarComoPng(elemento: HTMLElement, nombreArchivo: string): Promise<void>`
  - la ruta `/pedidos/<id>/documentos`

- [ ] **Paso 1: Instalar la librería de imagen**

```bash
npm install html-to-image
```

- [ ] **Paso 2: Escribir el conversor a PNG**

Crear `src/lib/documentos/a-png.ts`:

```ts
import { toPng } from 'html-to-image'

/** Convierte el mismo DOM que se imprime en una imagen para WhatsApp.
 *  Se usa 3× de resolución para que se vea nítida en un celular. */
export async function descargarComoPng(elemento: HTMLElement, nombreArchivo: string) {
  const dataUrl = await toPng(elemento, {
    pixelRatio: 3,
    backgroundColor: '#ffffff',
    cacheBust: true,
  })

  const enlace = document.createElement('a')
  enlace.download = `${nombreArchivo}.png`
  enlace.href = dataUrl
  enlace.click()
}
```

- [ ] **Paso 3: Escribir la página servidor**

Crear `src/app/(app)/pedidos/[id]/documentos/page.tsx`:

```tsx
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
```

- [ ] **Paso 4: Escribir la vista cliente**

Crear `src/app/(app)/pedidos/[id]/documentos/VistaDocumentos.tsx`:

```tsx
'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import { Recibo } from '@/components/documentos/Recibo'
import { RotuloLocal } from '@/components/documentos/RotuloLocal'
import { RotuloNacional } from '@/components/documentos/RotuloNacional'
import { descargarComoPng } from '@/lib/documentos/a-png'
import type { PedidoCompleto } from '@/lib/db/pedidos'
import type { Ajustes } from '@/lib/db/ajustes'

type Pestana = 'recibo' | 'rotulo'

export function VistaDocumentos({
  pedido, ajustes,
}: { pedido: PedidoCompleto; ajustes: Ajustes }) {
  const [pestana, setPestana] = useState<Pestana>('recibo')
  const referencia = useRef<HTMLDivElement>(null)
  const [generando, setGenerando] = useState(false)

  /** `@page` no acepta selectores, así que la regla de tamaño se inyecta
   *  y se reemplaza justo antes de abrir el diálogo de impresión. */
  function imprimir() {
    const tamano = pestana === 'recibo'
      ? '80mm auto'
      : `${ajustes.etiquetaAnchoMm}mm ${ajustes.etiquetaAltoMm}mm`

    let estilo = document.getElementById('regla-pagina') as HTMLStyleElement | null
    if (!estilo) {
      estilo = document.createElement('style')
      estilo.id = 'regla-pagina'
      document.head.appendChild(estilo)
    }
    estilo.textContent = `@page { size: ${tamano}; margin: 0 }`

    window.print()
  }

  async function descargar() {
    if (!referencia.current) return
    setGenerando(true)
    try {
      await descargarComoPng(
        referencia.current,
        `${pedido.consecutivo}-${pestana}`,
      )
    } finally {
      setGenerando(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl p-4">
      <div className="solo-pantalla mb-4 flex flex-wrap items-center gap-2">
        <Link href="/pedidos/nuevo" className="rounded-lg border bg-white px-3 py-2 text-sm">
          ← Nuevo pedido
        </Link>

        <div className="flex overflow-hidden rounded-lg border bg-white">
          <button
            onClick={() => setPestana('recibo')}
            className={`px-4 py-2 text-sm ${pestana === 'recibo' ? 'bg-slate-900 font-semibold text-white' : ''}`}
          >
            Recibo
          </button>
          <button
            onClick={() => setPestana('rotulo')}
            className={`px-4 py-2 text-sm ${pestana === 'rotulo' ? 'bg-slate-900 font-semibold text-white' : ''}`}
          >
            Rótulo {pedido.tipoEntrega === 'local' ? 'local' : 'nacional'}
          </button>
        </div>

        <button onClick={imprimir}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
          🖨 Imprimir
        </button>
        <button onClick={descargar} disabled={generando}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
          {generando ? 'Generando…' : '⬇ Imagen para WhatsApp'}
        </button>
      </div>

      <div className="flex justify-center">
        <div ref={referencia} className="shadow-lg">
          {pestana === 'recibo' ? (
            <Recibo pedido={pedido} ajustes={ajustes} />
          ) : pedido.tipoEntrega === 'local' ? (
            <RotuloLocal pedido={pedido} ajustes={ajustes} />
          ) : (
            <RotuloNacional pedido={pedido} ajustes={ajustes} />
          )}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Paso 5: Correr todas las pruebas y compilar**

```bash
npm run test && npm run build
```

Esperado: todas PASS, build exitoso.

- [ ] **Paso 6: Commit**

```bash
git add -A
git commit -m "feat: pantalla de documentos con impresión nativa y descarga en PNG"
```

---

### Tarea 18: Prueba de extremo a extremo del flujo completo

**Archivos:**
- Crear: `playwright.config.ts`, `e2e/pedido-completo.spec.ts`
- Modificar: `package.json`

**Interfaces:**
- Consume: la aplicación completa
- Produce: comando `npm run test:e2e`

- [ ] **Paso 1: Instalar Playwright**

```bash
npm install -D @playwright/test
npx playwright install chromium
```

- [ ] **Paso 2: Escribir la configuración**

Crear `playwright.config.ts`:

```ts
import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  timeout: 60000,
  use: { baseURL: 'http://localhost:3000' },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000/ingresar',
    reuseExistingServer: true,
    timeout: 120000,
  },
})
```

Agregar a `package.json`:

```json
"test:e2e": "playwright test"
```

- [ ] **Paso 3: Escribir la prueba**

Crear `e2e/pedido-completo.spec.ts`. Requiere las variables `E2E_CORREO` y `E2E_CLAVE` de un usuario de prueba:

```ts
import { test, expect } from '@playwright/test'

const SUFIJO = Date.now().toString().slice(-6)
const NOMBRE_CLIENTE = `Cliente Prueba ${SUFIJO}`

test('toma un pedido de punta a punta y genera recibo y rótulo', async ({ page }) => {
  await page.goto('/ingresar')
  await page.getByPlaceholder('Correo').fill(process.env.E2E_CORREO!)
  await page.getByPlaceholder('Contraseña').fill(process.env.E2E_CLAVE!)
  await page.getByRole('button', { name: 'Entrar' }).click()

  await expect(page).toHaveURL(/\/pedidos\/nuevo/)

  // Cliente nuevo, sin salir de la pantalla
  await page.getByPlaceholder(/Buscar cliente/).fill(NOMBRE_CLIENTE)
  await page.getByText(/Crear cliente nuevo/).click()
  await page.getByPlaceholder('Teléfono').fill('3124567890')
  await page.getByPlaceholder('Dirección').fill('Cra 45 # 23-18')
  await page.getByPlaceholder('Barrio').fill('La Floresta')
  await page.getByPlaceholder('Ciudad').fill('Medellín')
  await page.getByRole('button', { name: 'Guardar y usar' }).click()

  await expect(page.getByText(NOMBRE_CLIENTE)).toBeVisible()

  // Cuatro vainillas y cuatro maracuyás
  for (let i = 0; i < 4; i++) await page.getByRole('button', { name: /^Vainilla/ }).click()
  for (let i = 0; i < 4; i++) await page.getByRole('button', { name: /^Maracuyá/ }).click()

  // 4×22.000 + 4×25.000 = 188.000; kilos = 8
  await expect(page.getByText('Subtotal · 8 kg')).toBeVisible()

  await page.getByRole('button', { name: /Generar recibo/ }).click()

  await expect(page).toHaveURL(/\/pedidos\/.+\/documentos/)

  // El recibo salió con consecutivo, total en letras y aviso de frío
  await expect(page.getByText(/ORDEN No\./)).toBeVisible()
  await expect(page.getByText(/M\/cte/)).toBeVisible()
  await expect(page.getByText(/CONSERVAR EN FRÍO/)).toBeVisible()

  // El rótulo lleva el código de cliente, no la cédula
  await page.getByRole('button', { name: /Rótulo/ }).click()
  await expect(page.getByText(/^CL-\d{4}$/)).toBeVisible()
  await expect(page.getByText(/CONGELADO/)).toBeVisible()
})
```

- [ ] **Paso 4: Correr la prueba**

Ejecutar: `E2E_CORREO=... E2E_CLAVE=... npm run test:e2e`
Esperado: 1 prueba PASS.

- [ ] **Paso 5: Commit**

```bash
git add playwright.config.ts e2e/ package.json
git commit -m "test: prueba end-to-end del flujo completo de pedido a documentos"
```

---

### Tarea 19: Pantalla de ajustes del negocio

Cierra el plan: sin ella los datos de §13 del diseño no se pueden cargar y el recibo sale con placeholders.

**Archivos:**
- Crear: `src/app/(app)/ajustes/page.tsx`, `src/app/(app)/ajustes/FormularioAjustes.tsx`
- Modificar: `src/lib/db/ajustes.ts` (agregar `guardarAjustes`)

**Interfaces:**
- Consume: `Ajustes`, `obtenerAjustes`
- Produce: `guardarAjustes(ajustes: Ajustes): Promise<void>`; la ruta `/ajustes`

- [ ] **Paso 1: Agregar la escritura al repositorio**

Añadir al final de `src/lib/db/ajustes.ts`:

```ts
export async function guardarAjustes(ajustes: Ajustes): Promise<void> {
  const supabase = await crearClienteServidor()
  const { error } = await supabase
    .from('ajustes')
    .update({
      nombre_negocio: ajustes.nombreNegocio,
      eslogan: ajustes.eslogan,
      logo_url: ajustes.logoUrl,
      telefonos: ajustes.telefonos,
      datos_pago: ajustes.datosPago,
      prefijo_consecutivo: ajustes.prefijoConsecutivo,
      valor_domicilio_default: ajustes.valorDomicilioDefault,
      etiqueta_ancho_mm: ajustes.etiquetaAnchoMm,
      etiqueta_alto_mm: ajustes.etiquetaAltoMm,
      pie_recibo: ajustes.pieRecibo,
    })
    .eq('id', true)

  if (error) throw new Error(`No se pudieron guardar los ajustes: ${error.message}`)
}
```

Agregar `'use server'` como primera línea del archivo.

- [ ] **Paso 2: Escribir la página**

Crear `src/app/(app)/ajustes/page.tsx`:

```tsx
import { obtenerAjustes } from '@/lib/db/ajustes'
import { FormularioAjustes } from './FormularioAjustes'

export default async function PaginaAjustes() {
  const ajustes = await obtenerAjustes()
  return <FormularioAjustes iniciales={ajustes} />
}
```

- [ ] **Paso 3: Escribir el formulario**

Crear `src/app/(app)/ajustes/FormularioAjustes.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { guardarAjustes, type Ajustes } from '@/lib/db/ajustes'

const CAMPOS: { clave: keyof Ajustes; etiqueta: string; ayuda?: string }[] = [
  { clave: 'nombreNegocio', etiqueta: 'Nombre del negocio' },
  { clave: 'eslogan', etiqueta: 'Eslogan', ayuda: 'Ej.: Helado Artesanal' },
  { clave: 'logoUrl', etiqueta: 'URL del logo', ayuda: 'Opcional' },
  { clave: 'telefonos', etiqueta: 'Teléfonos de pedidos', ayuda: 'Salen en el recibo' },
  { clave: 'datosPago', etiqueta: 'Datos de pago', ayuda: 'Nequi, cuenta bancaria' },
  { clave: 'prefijoConsecutivo', etiqueta: 'Prefijo del consecutivo', ayuda: 'Ej.: PED → PED-000148' },
  { clave: 'pieRecibo', etiqueta: 'Texto al pie del recibo' },
]

const NUMERICOS: { clave: keyof Ajustes; etiqueta: string }[] = [
  { clave: 'valorDomicilioDefault', etiqueta: 'Valor del domicilio por defecto' },
  { clave: 'etiquetaAnchoMm', etiqueta: 'Ancho de la etiqueta (mm)' },
  { clave: 'etiquetaAltoMm', etiqueta: 'Alto de la etiqueta (mm)' },
]

export function FormularioAjustes({ iniciales }: { iniciales: Ajustes }) {
  const [ajustes, setAjustes] = useState(iniciales)
  const [guardando, setGuardando] = useState(false)
  const [mensaje, setMensaje] = useState<string | null>(null)

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    setGuardando(true)
    setMensaje(null)
    try {
      await guardarAjustes(ajustes)
      setMensaje('Guardado')
    } catch (err) {
      setMensaje(err instanceof Error ? err.message : 'No se pudo guardar')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <form onSubmit={enviar} className="mx-auto max-w-lg space-y-3 p-4">
      <h1 className="text-lg font-bold">Ajustes del negocio</h1>

      {CAMPOS.map(({ clave, etiqueta, ayuda }) => (
        <label key={clave} className="block">
          <span className="text-sm font-semibold">{etiqueta}</span>
          {ayuda && <span className="ml-2 text-xs text-slate-500">{ayuda}</span>}
          <input
            value={(ajustes[clave] as string) ?? ''}
            onChange={(e) => setAjustes({ ...ajustes, [clave]: e.target.value })}
            className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
          />
        </label>
      ))}

      {NUMERICOS.map(({ clave, etiqueta }) => (
        <label key={clave} className="block">
          <span className="text-sm font-semibold">{etiqueta}</span>
          <input
            inputMode="numeric" value={ajustes[clave] as number}
            onChange={(e) =>
              setAjustes({ ...ajustes, [clave]: Number(e.target.value.replace(/\D/g, '')) || 0 })
            }
            className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
          />
        </label>
      ))}

      {mensaje && <p className="text-sm text-emerald-700">{mensaje}</p>}

      <button type="submit" disabled={guardando}
        className="rounded-lg bg-slate-900 px-4 py-2 font-semibold text-white disabled:opacity-50">
        {guardando ? 'Guardando…' : 'Guardar'}
      </button>
    </form>
  )
}
```

- [ ] **Paso 4: Verificación final completa**

```bash
npm run test && npm run build
```

Esperado: todas las pruebas PASS, build exitoso.

- [ ] **Paso 5: Commit**

```bash
git add -A
git commit -m "feat: pantalla de ajustes del negocio"
```

---

### Tarea 20: Autoguardado del borrador

Requisito de §6.1: *"si se va la luz o se cierra el navegador a mitad de pedido, al volver está ahí"*.

**Archivos:**
- Crear: `src/lib/pedidos/borrador-local.ts`
- Crear test: `src/lib/pedidos/borrador-local.test.ts`
- Modificar: `src/app/(app)/pedidos/nuevo/FormularioPedido.tsx`

**Interfaces:**
- Consume: `Cliente`, `Direccion`, `ItemPedido`, `TipoEntrega`, `EstadoPago`
- Produce:
  - `interface BorradorGuardado { cliente, direccion, items, tipoEntrega, transportadora, estadoPago, valorDomicilio, observaciones, guardadoEn }`
  - `guardarBorradorLocal(borrador: BorradorGuardado, almacen?: Storage): void`
  - `leerBorradorLocal(almacen?: Storage): BorradorGuardado | null`
  - `limpiarBorradorLocal(almacen?: Storage): void`

- [ ] **Paso 1: Escribir las pruebas**

Crear `src/lib/pedidos/borrador-local.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import {
  guardarBorradorLocal, leerBorradorLocal, limpiarBorradorLocal,
  type BorradorGuardado,
} from './borrador-local'

function almacenFalso(): Storage {
  const datos = new Map<string, string>()
  return {
    getItem: (k) => datos.get(k) ?? null,
    setItem: (k, v) => void datos.set(k, v),
    removeItem: (k) => void datos.delete(k),
    clear: () => datos.clear(),
    key: () => null,
    get length() { return datos.size },
  } as Storage
}

function ejemplo(): BorradorGuardado {
  return {
    cliente: { id: 'c1', codigo: 'CL-0042', nombre: 'Juanito', telefono: null,
               cedula: null, tipo: 'detal', notas: null, direcciones: [] },
    direccion: null,
    items: [{ productoId: 'p1', descripcion: 'Vainilla', cantidad: 4, precioUnitario: 22000 }],
    tipoEntrega: 'local',
    transportadora: '',
    estadoPago: 'pendiente',
    valorDomicilio: 8000,
    observaciones: 'Timbre 302',
    guardadoEn: new Date().toISOString(),
  }
}

describe('borrador local', () => {
  let almacen: Storage
  beforeEach(() => { almacen = almacenFalso() })

  it('devuelve null cuando no hay nada guardado', () => {
    expect(leerBorradorLocal(almacen)).toBeNull()
  })

  it('guarda y recupera el borrador completo', () => {
    guardarBorradorLocal(ejemplo(), almacen)
    const leido = leerBorradorLocal(almacen)
    expect(leido?.items).toHaveLength(1)
    expect(leido?.items[0].cantidad).toBe(4)
    expect(leido?.observaciones).toBe('Timbre 302')
    expect(leido?.cliente?.nombre).toBe('Juanito')
  })

  it('limpiar deja el almacén vacío', () => {
    guardarBorradorLocal(ejemplo(), almacen)
    limpiarBorradorLocal(almacen)
    expect(leerBorradorLocal(almacen)).toBeNull()
  })

  it('no explota si el contenido guardado está corrupto', () => {
    almacen.setItem('pedido-borrador', '{esto no es json')
    expect(leerBorradorLocal(almacen)).toBeNull()
  })

  it('descarta un borrador de más de 24 horas', () => {
    const viejo = { ...ejemplo(), guardadoEn: new Date(Date.now() - 25 * 3600_000).toISOString() }
    guardarBorradorLocal(viejo, almacen)
    expect(leerBorradorLocal(almacen)).toBeNull()
  })
})
```

- [ ] **Paso 2: Correr para verificar que falla**

Ejecutar: `npm run test -- borrador-local`
Esperado: FAIL — no se encuentra el módulo.

- [ ] **Paso 3: Implementar**

Crear `src/lib/pedidos/borrador-local.ts`:

```ts
import type {
  Cliente, Direccion, ItemPedido, TipoEntrega, EstadoPago,
} from '@/lib/tipos'

const LLAVE = 'pedido-borrador'
const VIGENCIA_MS = 24 * 60 * 60 * 1000

export interface BorradorGuardado {
  cliente: Cliente | null
  direccion: Direccion | null
  items: ItemPedido[]
  tipoEntrega: TipoEntrega
  transportadora: string
  estadoPago: EstadoPago
  valorDomicilio: number
  observaciones: string
  guardadoEn: string
}

function almacenPorDefecto(): Storage | null {
  return typeof window === 'undefined' ? null : window.localStorage
}

export function guardarBorradorLocal(borrador: BorradorGuardado, almacen = almacenPorDefecto()) {
  almacen?.setItem(LLAVE, JSON.stringify(borrador))
}

export function leerBorradorLocal(almacen = almacenPorDefecto()): BorradorGuardado | null {
  const crudo = almacen?.getItem(LLAVE)
  if (!crudo) return null

  try {
    const borrador = JSON.parse(crudo) as BorradorGuardado
    const edad = Date.now() - new Date(borrador.guardadoEn).getTime()
    if (!Number.isFinite(edad) || edad > VIGENCIA_MS) return null
    return borrador
  } catch {
    return null   // contenido corrupto: se ignora, no se rompe la pantalla
  }
}

export function limpiarBorradorLocal(almacen = almacenPorDefecto()) {
  almacen?.removeItem(LLAVE)
}
```

- [ ] **Paso 4: Correr las pruebas**

Ejecutar: `npm run test -- borrador-local`
Esperado: PASS, 5 pruebas.

- [ ] **Paso 5: Conectarlo al formulario**

En `src/app/(app)/pedidos/nuevo/FormularioPedido.tsx`, agregar al bloque de importaciones:

```tsx
import { useEffect } from 'react'
import {
  guardarBorradorLocal, leerBorradorLocal, limpiarBorradorLocal,
} from '@/lib/pedidos/borrador-local'
```

Agregar estos dos efectos justo después de la declaración de `problemas`:

```tsx
  // Restaurar al entrar
  useEffect(() => {
    const guardado = leerBorradorLocal()
    if (!guardado) return
    setCliente(guardado.cliente)
    setDireccion(guardado.direccion)
    setItems(guardado.items)
    setTipoEntrega(guardado.tipoEntrega)
    setTransportadora(guardado.transportadora)
    setEstadoPago(guardado.estadoPago)
    setValorDomicilio(guardado.valorDomicilio)
    setObservaciones(guardado.observaciones)
  }, [])

  // Guardar en cada cambio, sin ir a la red
  useEffect(() => {
    if (!cliente && items.length === 0) return
    guardarBorradorLocal({
      cliente, direccion, items, tipoEntrega, transportadora,
      estadoPago, valorDomicilio, observaciones,
      guardadoEn: new Date().toISOString(),
    })
  }, [cliente, direccion, items, tipoEntrega, transportadora,
      estadoPago, valorDomicilio, observaciones])
```

Y en `confirmar()`, justo antes de `router.push`, agregar:

```tsx
      limpiarBorradorLocal()
```

- [ ] **Paso 6: Probar a mano**

Tomar medio pedido, recargar la página con F5 y verificar que vuelve tal cual. Confirmar el pedido y verificar que al volver a `/pedidos/nuevo` la pantalla está limpia.

- [ ] **Paso 7: Commit**

```bash
git add src/lib/pedidos/borrador-local.ts src/lib/pedidos/borrador-local.test.ts "src/app/(app)/pedidos/nuevo/FormularioPedido.tsx"
git commit -m "feat: autoguardado del borrador para que un corte no cueste un pedido"
```

---

### Tarea 21: Aviso de posible duplicado

Requisito de §10: **avisar, no bloquear**. A veces son dos pedidos reales del mismo cliente el mismo día.

**Archivos:**
- Crear: `src/lib/pedidos/duplicados.ts`
- Crear test: `src/lib/pedidos/duplicados.test.ts`
- Modificar: `src/lib/db/pedidos.ts`, `src/app/(app)/pedidos/nuevo/FormularioPedido.tsx`

**Interfaces:**
- Consume: `ItemPedido`
- Produce:
  - `interface PedidoReciente { consecutivo: string; total: number }`
  - `buscarDuplicado(recientes: PedidoReciente[], total: number): PedidoReciente | null`
  - `listarPedidosDeHoyDelCliente(clienteId: string): Promise<PedidoReciente[]>` (en `db/pedidos.ts`)

- [ ] **Paso 1: Escribir las pruebas**

Crear `src/lib/pedidos/duplicados.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { buscarDuplicado } from './duplicados'

const recientes = [
  { consecutivo: 'PED-000148', total: 240000 },
  { consecutivo: 'PED-000151', total: 88000 },
]

describe('buscarDuplicado', () => {
  it('encuentra un pedido del mismo día por el mismo total', () => {
    expect(buscarDuplicado(recientes, 240000)?.consecutivo).toBe('PED-000148')
  })

  it('devuelve null cuando el total no coincide con ninguno', () => {
    expect(buscarDuplicado(recientes, 190000)).toBeNull()
  })

  it('devuelve null cuando el cliente no tiene pedidos hoy', () => {
    expect(buscarDuplicado([], 240000)).toBeNull()
  })

  it('ignora el total en cero: un pedido vacío no es duplicado de nada', () => {
    expect(buscarDuplicado([{ consecutivo: 'PED-000160', total: 0 }], 0)).toBeNull()
  })
})
```

- [ ] **Paso 2: Correr para verificar que falla**

Ejecutar: `npm run test -- duplicados`
Esperado: FAIL.

- [ ] **Paso 3: Implementar la función pura**

Crear `src/lib/pedidos/duplicados.ts`:

```ts
export interface PedidoReciente {
  consecutivo: string
  total: number
}

/** Solo avisa. La decisión de seguir es siempre de la persona. */
export function buscarDuplicado(
  recientes: PedidoReciente[],
  total: number,
): PedidoReciente | null {
  if (total <= 0) return null
  return recientes.find((p) => p.total === total) ?? null
}
```

- [ ] **Paso 4: Correr las pruebas**

Ejecutar: `npm run test -- duplicados`
Esperado: PASS, 4 pruebas.

- [ ] **Paso 5: Agregar la consulta al repositorio**

Añadir al final de `src/lib/db/pedidos.ts`:

```ts
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

- [ ] **Paso 6: Mostrar el aviso en el formulario**

En `FormularioPedido.tsx`, agregar a las importaciones:

```tsx
import { buscarDuplicado, type PedidoReciente } from '@/lib/pedidos/duplicados'
import { listarPedidosDeHoyDelCliente } from '@/lib/db/pedidos'
```

Agregar el estado y el efecto:

```tsx
  const [recientes, setRecientes] = useState<PedidoReciente[]>([])

  useEffect(() => {
    if (!cliente) { setRecientes([]); return }
    listarPedidosDeHoyDelCliente(cliente.id).then(setRecientes)
  }, [cliente])

  const duplicado = buscarDuplicado(recientes, totales.total)
```

Y en el JSX, justo antes del `<ResumenPedido ...>`, insertar:

```tsx
          {duplicado && (
            <div className="mb-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Ojo: este cliente ya tiene hoy el pedido <strong>{duplicado.consecutivo}</strong> por
              el mismo valor. Si son dos pedidos distintos, sigue sin problema.
            </div>
          )}
```

- [ ] **Paso 7: Verificación final**

```bash
npm run test && npm run build
```

Esperado: todas PASS, build exitoso.

- [ ] **Paso 8: Commit**

```bash
git add -A
git commit -m "feat: aviso de posible pedido duplicado, sin bloquear"
```

---

## Verificación de cobertura del diseño

| Sección del diseño | Tarea |
|---|---|
| §5 Modelo de datos | 4 |
| §6.1 Pantalla de tomar pedido | 11, 12, 13 |
| §6.5 Ajustes | 19 |
| §7 Una plantilla, dos salidas | 15, 16, 17 |
| §7.1 Recibo 80 mm | 14, 15 |
| §7.2 Rótulo local | 16 |
| §7.3 Rótulo nacional | 16 |
| §7.4 Privacidad de la cédula | 15 (enmascarada), 16 (nunca en rótulo) |
| §9 Arquitectura y módulos | 2, 3, 6, 7, 8, 9, 10 |
| §10 Precio congelado | 10 (congelado al confirmar), 13 (copiado al agregar) |
| §10 Consecutivo atómico | 4, 10 |
| §10 Nada se borra | 10 (`anularPedido`) |
| §10 Nunca inferir precio | 8 |
| §10 No confirmar incompleto | 8, 10 |
| §10 Aviso de duplicado, sin bloquear | 21 |
| §10 El borrador sobrevive a fallos | 20 |
| §11 Pruebas | 3, 6, 7, 8, 10, 15, 16, 18, 20, 21 |
| §13 Datos pendientes | 19 |

**Fuera de este plan, van en el Plan 2:** §6.2 lista de pedidos · §6.3 pantalla de clientes · §6.4 y §8 balance, reportes y exportación a Excel · reimpresión y marcado de pagado desde la lista · clientes inactivos · ventas por asesor.
