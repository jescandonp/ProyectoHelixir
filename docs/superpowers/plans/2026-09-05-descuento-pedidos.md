# Descuento fijo en pedidos Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir un descuento manual fijo en pesos al crear un pedido, aplicado antes del domicilio y trazable en todos los comprobantes.

**Architecture:** Se reutiliza `pedidos.descuento`, ya existente, como única fuente persistida. La regla económica y su validación viven en `lib/pedidos/calculos.ts`; el formulario conserva el valor durante la creación y los artefactos consumen el pedido confirmado sin recalcular importes.

**Tech Stack:** Next.js 16, React 19, TypeScript, Supabase, Vitest, Testing Library y `@react-pdf/renderer` ya instalados.

---

## Mapa de archivos

| Archivo | Responsabilidad tras el cambio |
|---|---|
| `src/lib/pedidos/calculos.ts` | Calcular total con descuento antes de domicilio y validar su rango. |
| `src/lib/pedidos/calculos.test.ts` | Cubrir fórmula y fronteras de validación. |
| `src/lib/pedidos/borrador-local.ts` | Guardar/restaurar el descuento y normalizar borradores previos a `$0`. |
| `src/lib/pedidos/borrador-local.test.ts` | Verificar persistencia y compatibilidad del borrador. |
| `src/app/(app)/pedidos/nuevo/FormularioPedido.tsx` | Mantener el estado del descuento y enviar el valor confirmado. |
| `src/components/pedido/ResumenPedido.tsx` | Capturar y mostrar el descuento junto al subtotal y domicilio. |
| `src/components/pedido/ResumenPedido.test.tsx` | Verificar interacción, límite visible y desglose condicional. |
| `src/lib/db/pedidos.ts` | Validar en servidor antes de escribir un borrador y recalcular el total autorizado. |
| `src/components/documentos/Recibo.tsx` | Mostrar `Descuento` solo para valores positivos. |
| `src/lib/documentos/pdf/ReciboPdf.tsx` | Mantener el mismo desglose en PDF. |
| `src/lib/correo/recibo.ts` | Incluir el desglose monetario en el texto plano del correo. |
| Pruebas de recibo, PDF y correo existentes | Cubrir descuentos positivos y el caso `$0` sin línea adicional. |

### Task 1: Centralizar fórmula y validación económica

**Files:**
- Modify: `src/lib/pedidos/calculos.ts`
- Modify: `src/lib/pedidos/calculos.test.ts`

- [x] **Step 1: Escribir pruebas que fallen para la nueva fórmula y frontera**

  Añadir al `describe('calcularTotales')` estos casos:

  ```ts
  it('resta el descuento de productos antes de sumar domicilio', () => {
    const total = calcularTotales([item(1, 22000)], 5000, 2000)
    expect(total).toMatchObject({ subtotal: 22000, total: 25000 })
  })

  it('conserva el domicilio aunque una entrada inválida exceda el subtotal', () => {
    expect(calcularTotales([item(1, 22000)], 5000, 25000).total).toBe(5000)
  })

  it.each([-1, 22000.5, 22001])('rechaza descuento inválido %s', (descuento) => {
    expect(validarDescuento(descuento, 22000)).toMatch(/descuento/i)
  })
  ```

- [x] **Step 2: Ejecutar la prueba enfocada y comprobar el fallo**

  Run:

  ```powershell
  & 'C:\Program Files\nodejs\node.exe' '.\node_modules\vitest\vitest.mjs' run src/lib/pedidos/calculos.test.ts --maxWorkers=1
  ```

  Expected: el caso con descuento excesivo falla porque la fórmula actual también
  descuenta el domicilio, y `validarDescuento` aún no existe.

- [x] **Step 3: Implementar la mínima regla reutilizable**

  En `calculos.ts`, exportar una validación pura y ajustar el total:

  ```ts
  export function validarDescuento(descuento: number, subtotal: number): string | null {
    if (!Number.isInteger(descuento) || descuento < 0) {
      return 'El descuento debe ser un valor entero mayor o igual a $0'
    }
    if (descuento > subtotal) {
      return 'El descuento no puede superar el subtotal de productos'
    }
    return null
  }

  const subtotalNeto = Math.max(0, subtotal - descuento)
  const total = subtotalNeto + valorDomicilio
  ```

  Conservar `subtotal` y `totalKg` como hoy. No añadir `subtotalNeto` al tipo
  persistido: es derivable y no debe duplicarse.

- [x] **Step 4: Ejecutar la prueba enfocada y confirmar que pasa**

  Run el mismo comando del paso 2.

  Expected: todas las pruebas de `calculos.test.ts` PASS.

- [x] **Step 5: Commit del corte económico**

  ```powershell
  git add src/lib/pedidos/calculos.ts src/lib/pedidos/calculos.test.ts
  git commit -m "feat: valida descuentos antes del domicilio"
  ```

### Task 2: Mantener descuento en borrador y exponerlo en el resumen

**Files:**
- Modify: `src/lib/pedidos/borrador-local.ts`
- Modify: `src/lib/pedidos/borrador-local.test.ts`
- Modify: `src/app/(app)/pedidos/nuevo/FormularioPedido.tsx`
- Modify: `src/components/pedido/ResumenPedido.tsx`
- Modify: `src/components/pedido/ResumenPedido.test.tsx`

- [x] **Step 1: Escribir pruebas de borrador e interfaz**

  Agregar `descuento: 4000` al fixture `ejemplo()` y comprobarlo al leer.
  Añadir además un caso de JSON anterior sin el campo:

  ```ts
  it('normaliza a cero un borrador creado antes del descuento', () => {
    almacen.setItem('pedido-borrador', JSON.stringify({ ...ejemplo(), descuento: undefined }))
    expect(leerBorradorLocal(almacen)?.descuento).toBe(0)
  })
  ```

  En `ResumenPedido.test.tsx`, extender `propsBase` con `descuento: 0` y
  `onCambiarDescuento: vi.fn()`. Probar que el input `aria-label="Descuento"`
  comunica `4000` y que la línea `Descuento` aparece con un total positivo.

- [x] **Step 2: Ejecutar las dos pruebas antes de implementar**

  Run:

  ```powershell
  & 'C:\Program Files\nodejs\node.exe' '.\node_modules\vitest\vitest.mjs' run src/lib/pedidos/borrador-local.test.ts src/components/pedido/ResumenPedido.test.tsx --maxWorkers=1
  ```

  Expected: FAIL por la propiedad y callback inexistentes.

- [x] **Step 3: Implementar estado, normalización y UI controlada**

  - Declarar `descuento: number` en `BorradorGuardado`; en `leerBorradorLocal`
    retornar `{ ...borrador, descuento: borrador.descuento ?? 0 }`.
  - En `FormularioPedido.tsx`, usar `const [descuento, setDescuento] = useState(0)`;
    pasarlo a `calcularTotales`, restaurarlo, guardarlo y enviarlo a
    `guardarBorrador`.
  - Pasar `descuento` y `onCambiarDescuento` a `ResumenPedido`.
  - En `ResumenPedido.tsx`, insertar después de subtotal un input numérico
    controlado que limpia caracteres no numéricos y limita su callback al
    subtotal actual:

    ```tsx
    <label htmlFor="descuento">Descuento</label>
    <input
      id="descuento"
      aria-label="Descuento"
      value={p.descuento || ''}
      inputMode="numeric"
      onChange={(e) => {
        const valor = Number(e.target.value.replace(/\D/g, '')) || 0
        p.onCambiarDescuento(Math.min(valor, p.totales.subtotal))
      }}
    />
    {p.descuento > 0 && <span>Descuento · -{formatearPesosSinSimbolo(p.descuento)}</span>}
    ```

  El componente padre debe recortar el valor si el subtotal baja al retirar
  productos, antes de guardar o confirmar el borrador.

- [x] **Step 4: Ejecutar pruebas de interfaz y borrador**

  Run el comando del paso 2.

  Expected: PASS, incluido el borrador antiguo convertido a `$0`.

- [x] **Step 5: Commit del flujo de creación**

  ```powershell
  git add src/lib/pedidos/borrador-local.ts src/lib/pedidos/borrador-local.test.ts src/app/(app)/pedidos/nuevo/FormularioPedido.tsx src/components/pedido/ResumenPedido.tsx src/components/pedido/ResumenPedido.test.tsx
  git commit -m "feat: captura descuentos al crear pedidos"
  ```

### Task 3: Revalidar y persistir en el límite servidor

**Files:**
- Modify: `src/lib/db/pedidos.ts`
- Modify: `src/lib/pedidos/calculos.test.ts`

- [x] **Step 1: Añadir caso para demostrar que el validador es consumible por servidor**

  Añadir una prueba de `validarDescuento(4000, 22000)` que espere `null` y
  una de `validarDescuento(22001, 22000)` que espere exactamente
  `El descuento no puede superar el subtotal de productos`.

- [x] **Step 2: Ejecutar la prueba enfocada**

  Run el comando de Task 1, Step 2.

  Expected: PASS para el contrato del validador antes de conectarlo a la base.

- [x] **Step 3: Aplicar la guarda antes de cualquier update**

  En `guardarBorrador`, inmediatamente después de calcular `totales`, agregar:

  ```ts
  const errorDescuento = validarDescuento(borrador.descuento, totales.subtotal)
  if (errorDescuento) throw new Error(errorDescuento)
  ```

  Importar `validarDescuento` desde `@/lib/pedidos/calculos`. Mantener la
  guarda `.eq('estado', 'borrador')`; no añadir rutas ni mutaciones para
  pedidos confirmados.

- [x] **Step 4: Ejecutar tipo y las pruebas económicas**

  Run:

  ```powershell
  & 'C:\Program Files\nodejs\node.exe' '.\node_modules\typescript\bin\tsc' --noEmit
  & 'C:\Program Files\nodejs\node.exe' '.\node_modules\vitest\vitest.mjs' run src/lib/pedidos/calculos.test.ts --maxWorkers=1
  ```

  Expected: ambos comandos terminan con exit code 0.

- [x] **Step 5: Commit de la guarda de persistencia**

  ```powershell
  git add src/lib/db/pedidos.ts src/lib/pedidos/calculos.test.ts
  git commit -m "fix: protege descuentos inválidos al guardar pedidos"
  ```

### Task 4: Trazar el descuento en recibo, PDF y correo

**Files:**
- Modify: `src/components/documentos/Recibo.tsx`
- Modify: `src/components/documentos/Recibo.test.tsx`
- Modify: `src/lib/documentos/pdf/ReciboPdf.tsx`
- Modify: `src/lib/documentos/pdf/ReciboPdf.test.tsx`
- Modify: `src/lib/correo/recibo.ts`
- Modify: `src/lib/correo/recibo.test.ts`

- [x] **Step 1: Escribir pruebas de presentación condicional**

  Usar el fixture de cada archivo con `descuento: 4000` y `total: 236000`.
  En HTML y correo esperar `Descuento` y `$ 4.000`; con el fixture original
  de descuento cero, esperar que `queryByText(/Descuento/)` sea nulo. Para el
  PDF conservar el smoke test de buffer y añadir una ejecución con el fixture
  descontado.

- [x] **Step 2: Ejecutar las pruebas de artefactos y comprobar el fallo**

  Run:

  ```powershell
  & 'C:\Program Files\nodejs\node.exe' '.\node_modules\vitest\vitest.mjs' run src/components/documentos/Recibo.test.tsx src/lib/documentos/pdf/ReciboPdf.test.tsx src/lib/correo/recibo.test.ts --maxWorkers=1
  ```

  Expected: los casos positivos fallan porque todavía no se pinta ni se
  incluye el descuento.

- [x] **Step 3: Mostrar el mismo desglose en los tres consumidores**

  Entre `Subtotal` y `Valor Domicilio`, usar la condición común:

  ```tsx
  {pedido.descuento > 0 && (
    <div>
      <strong>Descuento:</strong>{' '}
      <span>-{formatearPesos(pedido.descuento)}</span>
    </div>
  )}
  ```

  Adaptar la estructura a `<View><Text>` en `ReciboPdf.tsx`. En
  `construirCorreoRecibo`, formar `textoPlano` con subtotal, una línea de
  descuento solo si aplica, domicilio y total, usando `formatearPesos`; no
  cambiar destinatario, asunto ni adjunto.

- [x] **Step 4: Ejecutar las pruebas de artefactos**

  Run el comando del paso 2.

  Expected: PASS con y sin descuento, y PDF no vacío.

- [x] **Step 5: Commit de trazabilidad documental**

  ```powershell
  git add src/components/documentos/Recibo.tsx src/components/documentos/Recibo.test.tsx src/lib/documentos/pdf/ReciboPdf.tsx src/lib/documentos/pdf/ReciboPdf.test.tsx src/lib/correo/recibo.ts src/lib/correo/recibo.test.ts
  git commit -m "feat: muestra descuentos en recibos y correo"
  ```

### Task 5: Verificación integral y cierre de la iteración

**Files:**
- Modify: `docs/superpowers/plans/2026-09-05-descuento-pedidos.md` (marcar tareas verificadas y registrar comandos reales)

- [x] **Step 1: Ejecutar la suite unitaria, lint y tipado**

  ```powershell
  & 'C:\Program Files\nodejs\node.exe' '.\node_modules\vitest\vitest.mjs' run --maxWorkers=1
  & 'C:\Program Files\nodejs\node.exe' '.\node_modules\eslint\bin\eslint.js' .
  & 'C:\Program Files\nodejs\node.exe' '.\node_modules\typescript\bin\tsc' --noEmit
  ```

  Expected: los tres comandos terminan correctamente. Si Vitest vuelve a
  bloquearse en el host, registrar el bloqueo y no marcar su resultado como
  aprobado.

- [x] **Step 2: Ejecutar build con conectividad disponible**

  ```powershell
  & 'C:\Program Files\nodejs\node.exe' '.\node_modules\next\dist\bin\next' build
  ```

  Expected: build exitoso y sin error de rutas o tipos. Si Google Fonts exige
  red en el sandbox, ejecutar el mismo comando fuera del aislamiento y anotar
  esa condición.

- [x] **Step 3: Verificación manual controlada**

  Con Supabase local activo, crear un pedido con productos por `$44.000`,
  descuento `$4.000` y domicilio `$5.000`. Confirmar total `$45.000`,
  descargar PDF y comprobar la línea de descuento. Enviar una sola vez al
  correo propietario de la cuenta de pruebas de Resend y verificar que el
  texto plano y el PDF muestran el mismo desglose. Repetir la creación con
  descuento `$0` y confirmar que no aparece la línea adicional.

- [x] **Step 4: Revisar el diff y cerrar**

  ```powershell
  git diff HEAD~4..HEAD --check
  git status --short
  ```

  Expected: sin espacios inválidos ni archivos de secretos. Marcar en este
  plan los resultados reales; no modificar pedidos históricos para simular
  la verificación.

- [ ] **Step 5: Commit del registro de verificación**

  ```powershell
  git add docs/superpowers/plans/2026-09-05-descuento-pedidos.md
  git commit -m "docs: registra verificación de descuentos"
  ```

### Evidencia de verificación — 2026-09-05

- Pruebas focales: 42 pruebas en 6 archivos, usando `--pool=vmThreads --maxWorkers=1`.
- Suite unitaria: 163 pruebas en 22 archivos, usando
  `vitest run --pool=vmThreads --maxWorkers=1 --reporter=dot`.
- Lint y `tsc --noEmit`: sin diagnósticos.
- Build de producción: `next build` completó fuera del aislamiento; generó
  `.next/BUILD_ID` `Txre8jENp2ogf-LYK15Jx`.
- Revisión: `git diff HEAD~4..HEAD --check` sin espacios inválidos y árbol
  limpio antes de registrar este avance.
- Prueba manual positiva: `PED-000004` creado con dos Vainillas, subtotal
  `$44.000`, descuento `$4.000`, domicilio `$5.000` y total `$45.000`.
  El recibo HTML mostró la línea de descuento entre subtotal y domicilio; el
  PDF se descargó y la app confirmó el envío único del correo. El usuario
  verificó que la prueba fue correcta.
- Prueba manual con cero: `PED-000005` creado con descuento `$0`, subtotal
  `$22.000`, domicilio `$8.000` y total `$30.000`. Su recibo persistido no
  mostró la línea `Descuento`.

## Revisión del plan

- Cobertura: Tasks 1–3 cubren fórmula, rango, borrador, UI y persistencia;
  Task 4 cubre HTML, PDF y texto de correo; Task 5 cubre las verificaciones
  automáticas y manuales aprobadas.
- Sin migraciones: el plan no altera el esquema porque `pedidos.descuento`
  ya existe y tiene la restricción necesaria.
- Compatibilidad: Task 2 normaliza los borradores antiguos y Tasks 3–5 no
  recalculan pedidos confirmados.
- No se introducen porcentajes, promociones, dependencias ni edición de
  descuentos posteriores a la creación.
