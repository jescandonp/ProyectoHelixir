# Cédula completa en el recibo — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** El recibo muestra la cédula completa del cliente, en vez de enmascarada.

**Architecture:** Cambio de una sola función en `Recibo.tsx`: se quita `enmascararCedula` y se imprime `pedido.clienteCedula` tal cual. No toca el rótulo (nunca mostró la cédula, por diseño — ver §7.4 del diseño original), ni la ficha de cliente (`FichaCliente.tsx` tiene su propio enmascaramiento con botón "revelar", que es un control de acceso a la pantalla, no de impresión, y sigue fuera de alcance de este cambio).

**Tech Stack:** React, Vitest + Testing Library.

## Global Constraints

- Esta es una reversión consciente de una decisión de privacidad documentada en el diseño original (§7.4: la máscara existía porque el papel del recibo puede quedar a la vista de mensajero, portero o vecino). El negocio revisó ese riesgo y decidió aceptarlo. No se reintroduce ningún enmascaramiento parcial ni condicional — la cédula completa se ve siempre que el recibo se imprime, se descarga como imagen, o (en el plan de correo) se genera en PDF.

---

### Task 1: Quitar el enmascaramiento en `Recibo.tsx`

**Files:**
- Modify: `src/components/documentos/Recibo.tsx`
- Modify: `src/components/documentos/Recibo.test.tsx`

**Interfaces:**
- No cambia ninguna firma pública: `Recibo({ pedido, ajustes })` sigue
  recibiendo los mismos tipos (`PedidoCompleto`, `Ajustes`).

- [ ] **Step 1: Actualizar la prueba existente para esperar la cédula completa**

En `src/components/documentos/Recibo.test.tsx`, reemplazar la prueba que hoy
verifica el enmascaramiento:

```typescript
// Reemplazar esta prueba (la que hoy dice "enmascara la cédula..."):
  it('muestra la cédula completa del cliente', () => {
    render(<Recibo pedido={pedido} ajustes={ajustes} />)
    expect(screen.getByText('1017456789')).toBeDefined()
    expect(screen.queryByText('1017xxxxxx')).toBeNull()
  })
```

Las demás pruebas del archivo no cambian: no dependen de la cédula.

- [ ] **Step 2: Ejecutar y verificar que la prueba nueva falla**

Run: `npm test -- Recibo`
Expected: FAIL en la prueba de la cédula — el componente todavía enmascara,
así que el texto `'1017456789'` completo no aparece (`getByText` no lo
encuentra) y `'1017xxxxxx'` sí, lo que hace fallar el `queryByText(...).toBeNull()`
inverso.

- [ ] **Step 3: Quitar el enmascaramiento del componente**

En `src/components/documentos/Recibo.tsx`:

```typescript
// Borrar por completo esta función (líneas 7-14 del archivo actual):
// /** La cédula se muestra parcial: es el recibo del propio cliente,
//  *  pero el papel puede quedar a la vista de terceros. */
// function enmascararCedula(cedula: string | null): string { ... }
```

```tsx
// Cambiar esta línea (línea 39 del archivo actual):
        <div className="font-extrabold">Cédula:</div><div>{enmascararCedula(pedido.clienteCedula)}</div>
// por:
        <div className="font-extrabold">Cédula:</div><div>{pedido.clienteCedula ?? '—'}</div>
```

- [ ] **Step 4: Ejecutar y verificar que todas las pruebas pasan**

Run: `npm test -- Recibo`
Expected: PASS, las 7 pruebas del archivo (las 6 que ya existían más la
nueva).

- [ ] **Step 5: Verificar a mano que el resto del recibo no cambió**

Con el stack local levantado y `npm run dev` corriendo, tomar un pedido de
prueba y abrir su recibo en `/pedidos/[id]/documentos`. Confirmar que la
cédula sale completa y que el resto del recibo (rótulo, total, PAGADO/PENDIENTE)
se ve igual que antes.

- [ ] **Step 6: Commit**

```bash
git add src/components/documentos/Recibo.tsx src/components/documentos/Recibo.test.tsx
git commit -m "feat: muestra la cédula completa en el recibo, sin enmascarar"
```

---

## Resumen de lo que queda operable al terminar

El recibo (impreso y en la imagen para WhatsApp) muestra la cédula completa
del cliente. La ficha de cliente sigue enmascarándola con su propio botón de
"revelar" — eso no cambió, es una pantalla distinta con un propósito
distinto (control de quién ve el dato en la aplicación, no qué sale impreso
en un papel que puede pasar por varias manos).
