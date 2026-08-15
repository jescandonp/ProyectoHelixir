# Operación: lista de pedidos y clientes — Documento de diseño

**Fecha:** 14 de agosto de 2026
**Estado:** validado con el cliente, pendiente de plan de implementación
**Cubre:** fase 4 del §12 del diseño original, más la pantalla de clientes del §6.3
**Diseño original:** [`2026-08-11-pedidos-recibos-rotulos-design.md`](2026-08-11-pedidos-recibos-rotulos-design.md)
**Plan ya ejecutado:** [`../plans/2026-08-13-pedidos-recibos-rotulos-mvp.md`](../plans/2026-08-13-pedidos-recibos-rotulos-mvp.md)

---

## 1. Qué falta y por qué esto va primero

El MVP ya toma pedidos y produce el recibo y los rótulos. Pero una vez
confirmado, **un pedido desaparece**: no hay pantalla que lo vuelva a mostrar.
Para cobrarlo, marcarlo entregado, reimprimir su recibo o corregir el teléfono
del cliente hay que entrar a la base de datos.

Esto cierra ese hueco. Deja el sistema operable de punta a punta sin tocar SQL.

El balance, los reportes y la exportación a Excel —fases 5 y 6 del §12— van en
un plan aparte. Se separan porque son dos naturalezas distintas: **esto escribe**
(cobra, despacha, corrige), **aquello solo lee**. El §9 del diseño ya exige que
`balance` nunca escriba; mantenerlos en planes separados evita que esa frontera
se borre por comodidad.

## 2. Alcance

### En alcance

- Navegación entre pantallas
- Lista de pedidos con filtros, pestañas y paginación
- Total por cobrar siempre visible
- Acciones por pedido: marcar pagado, enviado, entregado, anular, reimprimir
- Registro del método de pago, opcional, al marcar pagado
- Lista de clientes con buscador propio
- Ficha de cliente: datos editables, direcciones, historial, total comprado
- Revelar la cédula completa, solo aquí

### Fuera de alcance, con la razón

| Descartado | Por qué |
|---|---|
| Editar un pedido ya confirmado | El §10 no lo admite: se anula y se rehace. `esEditable` ya lo impide. Tener una lista desde donde tentarse no cambia la regla. |
| Balance, reportes, Excel | Plan aparte. Solo leen; esto escribe. |
| Borrar clientes | Nada se borra (§10). Si algún día estorban, se desactivan. |
| Reportes por método de pago | El método apenas empieza a registrarse hoy. Sin datos históricos, el reporte mentiría. Va en el plan del balance. |

## 3. Decisiones y su razón

| # | Decisión | Alternativa descartada | Razón |
|---|---|---|---|
| 1 | Dos planes: operar, luego medir | Un plan con las fases 4, 5 y 6 | Entrega valor antes, y cada plan tiene una sola naturaleza. |
| 2 | Marcar pagado en un clic, método opcional | Exigir el método | Cobrar es lo urgente. El detalle contable no puede frenar la acción más repetida del sistema. |
| 3 | Un listado con pestañas | Pantalla aparte de "Por cobrar" | Dos pantallas casi iguales se desincronizan. Una sola, con el número siempre a la vista. |
| 4 | Ficha de cliente editable | Solo lectura | Hoy un dato mal digitado queda mal para siempre, y la segunda dirección no se puede crear aunque el modelo la asuma. |
| 5 | Filtros y sumas en Postgres | Vistas SQL dedicadas; filtrar en JavaScript | Las vistas meten lógica de negocio en migraciones. Filtrar en memoria es insostenible al año, cuando sean miles de pedidos. |
| 6 | El rango de fechas se calcula aparte, en hora de Bogotá | Dejar que Postgres o el servidor resuelvan "hoy" | Vercel corre en UTC: el día cambiaría a las 7 p.m. hora colombiana y el listado del día se partiría en dos. Es el mismo error que ya costó una corrección en el recibo. |

## 4. Arquitectura

### Módulos puros nuevos

| Módulo | Responsabilidad | Depende de |
|---|---|---|
| `lib/periodo.ts` | "Hoy", "este mes" o un rango → dos instantes ISO, en hora de Bogotá | nada |
| `lib/pedidos/acciones.ts` | Qué se puede hacer con un pedido según su estado | `pedidos/estados` |

`periodo.ts` lo reusa tal cual el plan del balance. `acciones.ts` existe para que
la fila del listado no decida nada: pinta lo que el módulo autoriza, y las reglas
quedan probadas sin renderizar un componente.

### Los repositorios se parten por naturaleza

`db/pedidos.ts` ya tiene 240 líneas y crecería al doble. Se divide siguiendo la
frontera que el §9 del diseño original ya trazó:

| Archivo | Responsabilidad |
|---|---|
| `db/pedidos.ts` | **Escribe:** crear, guardar, confirmar, anular, `marcarPagado`, `marcarEnviado`, `marcarEntregado` |
| `db/pedidos-consultas.ts` | **Solo lee:** `listarPedidos`, `resumenPorCobrar`, `historialDelCliente` |
| `db/clientes.ts` | Se le agregan `listarClientes`, `actualizarCliente`, `agregarDireccion`, `actualizarDireccion` |

### Navegación

Va en `app/(app)/layout.tsx`, que hoy es un `div` vacío. Una barra superior con
Nuevo pedido · Pedidos · Clientes · Ajustes, y el nombre del asesor en sesión.

Como cuelga del layout del grupo `(app)`, cubre todas las pantallas de una vez
—incluida `/ajustes`, que hoy solo se alcanza escribiendo la URL.

### Lo congelado no se toca

Editar un cliente cambia su ficha, **nunca los pedidos ya confirmados**: esos
guardan su propia copia en `cliente_nombre`, `dir_linea` y demás columnas. Es la
regla del §5 y el esquema ya la garantiza. Este trabajo solo debe no romperla, y
hay una prueba de integración que la fija.

## 5. Pantallas

### 5.1 `/pedidos` — el listado

Arriba, siempre visible: **el total por cobrar y cuántos pedidos son.**

Debajo, tres pestañas sobre los mismos filtros:

- **Hoy** — lo que se abre por defecto
- **Por cobrar**
- **Todos**

Los filtros finos —rango de fechas, estado, estado de pago, cliente, asesor— se
despliegan aparte, para no estorbar el uso diario.

Cada fila muestra consecutivo, fecha, cliente con su ciudad, kilos, total y los
dos estados. Y ofrece **solo las acciones que `acciones.ts` autoriza** para ese
pedido.

Paginación de 50 en 50. A 600 pedidos al mes, la pestaña "Todos" sin paginar
sería inusable en un año.

**Dos cosas salen gratis del Plan 1:**

- *Reimprimir recibo* y *reimprimir rótulo* no son código nuevo: son un enlace a
  `/pedidos/[id]/documentos`, que ya imprime y ya genera el PNG.
- Al marcar pagado, el recibo reimpreso pasa solo a **PAGADO ✓** con su fecha.
  La plantilla ya tiene esa rama. Un solo diseño, dos estados.

Anular abre un cuadro que exige el motivo: `anularPedido` ya lo exige y el §10 no
admite borrar sin dejar rastro.

### 5.2 `/clientes` — el listado

Buscador por nombre, teléfono o código, con paginación de 50 en 50, igual que
el listado de pedidos.

El buscador que ya existe no sirve aquí: devuelve máximo 8 resultados y exige dos
letras, porque está hecho para el autocompletado del pedido. Este necesita el
suyo.

### 5.3 `/clientes/[id]` — la ficha

- Datos del cliente, editables
- La cédula sale enmascarada, con un botón para revelarla. **Esta es la única
  pantalla del sistema donde se puede ver completa** (§7.4)
- Direcciones: agregar, corregir, marcar como principal
- Historial de pedidos y total comprado, reusando las consultas del listado

## 6. Reglas de negocio

| Regla | Razón |
|---|---|
| **"Por cobrar" es todo lo que no está pagado y no está anulado**, incluida la contraentrega. | El §8 dice "pago pendiente", que es ambiguo. La contraentrega también es plata que deben hasta que el mensajero vuelve. Sin fijarlo, el número significa dos cosas según quién lo lea. |
| **El listado solo muestra pedidos con consecutivo.** | Si confirmar falla a mitad de camino queda una fila en borrador sin número. No debe ensuciar la lista ni contar en los totales. |
| **Marcar pagado es idempotente.** | Dos clics, o dos personas a la vez, no pueden reescribir la fecha original de pago. |
| **Los cambios de estado pasan por `puedeTransicionar`.** | Marcar entregado algo que nunca se envió se rechaza con mensaje claro. |
| **Editar un cliente no altera pedidos confirmados.** | §5. Lo garantiza el esquema; la prueba lo fija. |
| **"Hoy" es hoy en Bogotá**, no en el servidor. | Vercel corre en UTC. |
| **La cédula completa solo se revela en la ficha del cliente.** | §7.4. |

## 7. Manejo de errores

Las acciones de fila son escrituras sueltas. Si una falla por red, **el mensaje
sale en la fila**, el listado no se pierde y se puede reintentar. Es la misma
regla que el §10 fijó para confirmar un pedido.

## 8. Pruebas

**Unitarias (Vitest)** — los dos módulos puros:

- `periodo.ts` con los bordes incómodos: las 7 p.m. de Colombia, que en UTC ya
  son el día siguiente; el primero y el último día del mes
- `acciones.ts`: qué se ofrece en cada estado, y qué no

**De integración** — las tres reglas que solo mienten con datos reales:

- Editar un cliente no reescribe un pedido confirmado
- Marcar pagado dos veces conserva la fecha original
- Los borradores sin consecutivo no aparecen en el listado

**End-to-end (Playwright)** — el camino que mueve la plata:

> tomar un pedido → encontrarlo en la lista → marcarlo pagado → reimprimir y ver
> **PAGADO ✓**

Es el recorrido que hoy se hace a mano, y el que no puede romperse en silencio.

## 9. Orden de construcción

1. **Los módulos puros** — `periodo.ts` y `acciones.ts`, con sus pruebas
2. **La navegación** — sin ella no se llega a nada de lo que sigue
3. **Las consultas** — partir el repositorio y escribir `pedidos-consultas.ts`
4. **El listado de pedidos** — pestañas, filtros, paginación, total por cobrar
5. **Las acciones** — marcar pagado, enviado, entregado, anular
6. **Clientes** — listado, ficha, edición, direcciones, historial
7. **La prueba end-to-end** del camino completo

## 10. Puertas que quedan abiertas

- *Reporte por método de pago:* el campo empieza a llenarse ahora. Cuando haya
  histórico, es una consulta más en el plan del balance.
- *Devoluciones:* hoy un pedido entregado no se anula. Si el negocio empieza a
  recibir devoluciones, es un estado nuevo, no un permiso de anulación.
- *Desactivar clientes:* nada se borra. Si la lista crece demasiado, se agrega
  `activo` igual que en productos.
