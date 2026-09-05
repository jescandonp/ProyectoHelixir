# Exportación, recibo por correo, transportadoras y cédula — Documento de diseño

**Fecha:** 29 de agosto de 2026
**Estado:** validado con el cliente, pendiente de plan de implementación
**Cubre:** cuatro mejoras independientes sobre `/pedidos`, la ficha de cliente y el recibo
**Construye sobre:** [`2026-08-11-pedidos-recibos-rotulos-design.md`](2026-08-11-pedidos-recibos-rotulos-design.md) y [`2026-08-14-operacion-pedidos-clientes-design.md`](2026-08-14-operacion-pedidos-clientes-design.md)

---

## 1. Qué se pide y por qué son cuatro proyectos, no uno

Esta iteración junta cuatro pedidos del negocio:

1. Exportar el resultado de `/pedidos` a Excel y PDF.
2. Generar el recibo de venta en PDF y poder enviarlo por correo al cliente.
3. Cambiar el campo libre de transportadora por una lista predeterminada.
4. Mostrar la cédula completa (no enmascarada) en el recibo.

Son cuatro subsistemas casi sin relación entre sí — tocan el listado de
pedidos, el envío de correo saliente, el catálogo de transportadoras y la
plantilla del recibo. Se documentan juntos porque comparten una sola pieza de
infraestructura nueva (generación de PDF, ver §4.1), pero cada uno se
construye, se prueba y se puede entregar por separado. El plan de
implementación los ordena así (§9).

## 2. Alcance

### En alcance

- Botones "Excel" y "PDF" en `/pedidos` que exportan el resultado ya filtrado
  (no solo la página de 50 visibles).
- Un módulo de generación de PDF reutilizable, sin depender de un navegador
  headless.
- Campo `correo` en clientes (opcional, validado por formato).
- Botón "Enviar por correo" en la pantalla de documentos del pedido, que
  adjunta el recibo en PDF.
- Botón "Descargar PDF" en la misma pantalla (subproducto directo de generar
  el PDF para el correo).
- Tabla `transportadoras` sembrada con las que el negocio usa hoy, y un
  desplegable en el formulario de pedido con opción "Otra" para casos no
  contemplados.
- Quitar el enmascaramiento de la cédula en el recibo (impreso, imagen y PDF).

### Fuera de alcance, con la razón

| Descartado | Por qué |
|---|---|
| Pantalla en Ajustes para administrar transportadoras | Se decidió sembrar por SQL, igual que el catálogo de productos hoy. Si el negocio empieza a cambiar la lista seguido, se agrega después — no hay nada en este diseño que lo impida. |
| Verificar un dominio propio en Resend | Es un trámite del negocio (DNS), no código. Mientras tanto el envío queda funcional pero limitado a la casilla de prueba (§6). |
| Envío automático de correo al confirmar el pedido | Se eligió un botón manual: el asesor decide cuándo enviarlo, y puede reenviarlo más de una vez (p. ej. al marcar pagado). |
| Reporte o filtro por transportadora | No se pidió; el campo sigue siendo solo un dato del pedido, no una dimensión de reportes. |
| Exigir correo obligatorio al crear cliente | Se eligió opcional: muchos clientes se toman por teléfono/WhatsApp sin correo, y exigirlo bloquearía la toma de pedido. |

## 3. Decisiones y su razón

| # | Decisión | Alternativa descartada | Razón |
|---|---|---|---|
| 1 | PDF con `@react-pdf/renderer` (JS puro, sin navegador) | Puppeteer/Chromium headless reusando el HTML del recibo tal cual se imprime | Un binario de Chromium agrega ~150 MB+ al despliegue y complejidad de cold start solo para reusar maquetación. `@react-pdf/renderer` corre en cualquier función de Node sin binario externo. El costo es maquetar el recibo una segunda vez (en componentes `View`/`Text`), pero toda la lógica de formato (`formatearPesos`, `valorEnLetras`, `formatearFechaCo`) se reutiliza tal cual — no hay lógica de negocio duplicada, solo presentación. |
| 2 | Excel con `exceljs` | `xlsx` (SheetJS) | `xlsx` tiene vulnerabilidades históricas de prototype pollution sin parchear en versiones libres; `exceljs` es una alternativa mantenida sin ese historial. |
| 3 | La exportación es una ruta HTTP (`GET /api/pedidos/exportar`), no una acción de servidor | Server action que devuelve un blob al cliente | Una ruta HTTP se comporta como un enlace de descarga normal del navegador — sin JavaScript de por medio para manejar el archivo — y conserva los filtros de la URL tal cual. |
| 4 | El correo se envía con la librería `resend` llamando directo a la API, usando `RESEND_API_KEY` de las variables de entorno | Integración de Resend vía el marketplace de Vercel | El negocio ya creó la cuenta y la API key en Resend directamente. No hay necesidad de reinstalarla por otra vía: el código solo necesita la key en una variable de entorno, sea cual sea su origen. |
| 5 | El remitente es configurable (`RESEND_FROM_EMAIL`), con `onboarding@resend.dev` como valor por defecto | Dejarlo escrito en el código | Cuando se verifique un dominio propio, cambiar el remitente es solo una variable de entorno, no un despliegue de código nuevo. |
| 6 | Botón manual "Enviar por correo", no automático al confirmar | Envío automático | Cobrar y despachar son las acciones urgentes del sistema (ver diseño de operación); el correo es informativo y el asesor decide cuándo (o si) reenviarlo. |
| 7 | El correo del pedido se congela en `pedidos.cliente_correo`, igual que nombre/teléfono/cédula | Leer siempre `clientes.correo` al momento de enviar | Mismo principio ya fijado en el diseño de operación (§5 de ese documento): editar la ficha de un cliente no puede alterar a dónde llegó (o llegaría) un recibo ya emitido. |
| 8 | La transportadora sigue siendo una columna `text` en `pedidos`, ahora alimentada por un `<select>` con opción "Otra" | Cambiar la columna a una referencia (`transportadora_id`) | El valor que importa para el rótulo y el recibo es el nombre visible, no una relación normalizada; ligarlo a un id obliga a resolver qué pasa si esa transportadora se desactiva después de que el pedido ya se imprimió. Un `text` copiado en el momento evita ese problema, igual que ya se hace con los demás datos del cliente. |
| 9 | Se muestra la cédula completa en el recibo (impreso, PNG y PDF) | Mantener la máscara, o mostrarla completa solo en el PDF/correo | El negocio revisó el riesgo documentado en el diseño original (§7.4: el papel puede quedar a la vista de mensajero, portero o vecino) y decidió aceptarlo para todas las presentaciones del recibo. Queda registrado aquí como una decisión consciente que reemplaza esa regla anterior, no como un descuido. |

## 4. Arquitectura

### 4.1 Módulo común: generación de PDF

Nuevo módulo `lib/documentos/pdf.tsx` con dos componentes `@react-pdf/renderer`:

| Componente | Para qué | Datos que recibe |
|---|---|---|
| `ReciboPdf` | El recibo individual, para descargar o adjuntar al correo | `PedidoCompleto`, `Ajustes` — los mismos tipos que ya usa `Recibo.tsx` |
| `ListadoPedidosPdf` | El reporte tabular de `/pedidos` | `FilaPedido[]`, los filtros activos (para el encabezado del reporte) |

Ninguno de los dos vuelve a calcular nada: reciben los mismos datos que sus
equivalentes en pantalla y solo cambian cómo se dibujan.

### 4.2 Exportar el listado

| Pieza | Responsabilidad |
|---|---|
| `lib/db/pedidos-consultas.ts` → `listarPedidosParaExportar(filtros)` | Misma consulta que `listarPedidos`, sin `.range()`: trae todas las filas que cumplen el filtro, no una página |
| `lib/documentos/a-excel.ts` → `generarExcelPedidos(filas)` | Arma el workbook con `exceljs`: encabezados, formato de moneda en Total, ancho de columnas |
| `app/api/pedidos/exportar/route.ts` | `GET` que lee los mismos parámetros de filtro que `/pedidos`, llama a `listarPedidosParaExportar`, y según `?formato=excel\|pdf` devuelve el archivo con el `Content-Type` correcto |

Los dos botones en `/pedidos` son enlaces (`<a href="/api/pedidos/exportar?...">`)
que arman la URL con los mismos `searchParams` que ya trae la pantalla —
mismo patrón que `enlacePagina` en `page.tsx`.

### 4.3 Transportadoras

| Pieza | Responsabilidad |
|---|---|
| Migración `0005_transportadoras.sql` | Tabla `transportadoras (id, nombre, activa, orden)` + semilla con Interrapidísimo, Servientrega, TCC, Coordinadora |
| `lib/db/transportadoras.ts` → `listarTransportadorasActivas()` | Solo lectura, mismo patrón que `listarProductosActivos()` |
| `pedidos/nuevo/page.tsx` | Se agrega `listarTransportadorasActivas()` al `Promise.all` que ya trae productos y ajustes, y se pasa como prop nueva a `FormularioPedido` |
| `ResumenPedido.tsx` | El `<input>` de transportadora se reemplaza por un `<select>` con las transportadoras activas + opción `"__otra__"` que revela un `<input>` de texto libre debajo. El estado que sube al padre (`onCambiarTransportadora`) sigue siendo un `string`, así que `FormularioPedido.tsx`, `validacion.ts`, `borrador-local.ts` y el esquema de `pedidos` no cambian. |

### 4.4 Correo y recibo en PDF

| Pieza | Responsabilidad |
|---|---|
| Migración `0006_correo_cliente.sql` | Columna `correo text` en `clientes`; columna `cliente_correo text` en `pedidos` (copia congelada) |
| `lib/clientes/validacion.ts` (nuevo, módulo puro) | `correoValido(texto)`: formato básico de correo. Se usa igual en la creación rápida y en la ficha editable |
| `lib/db/clientes.ts` | `crearCliente` y `actualizarCliente` reciben y guardan `correo` |
| `lib/db/pedidos.ts` | Al confirmar, copia `cliente.correo` a `pedidos.cliente_correo`, igual que ya hace con teléfono y cédula |
| `components/pedido/BuscadorCliente.tsx` | Se agrega el campo "Correo (opcional)" al formulario rápido de cliente nuevo |
| `app/(app)/clientes/[id]/FichaCliente.tsx` | Se agrega el campo correo, editable, con el mismo validador |
| `lib/correo/resend.ts` (nuevo) | Cliente delgado sobre el SDK `resend`, leyendo `RESEND_API_KEY` y `RESEND_FROM_EMAIL` (por defecto `onboarding@resend.dev`) de variables de entorno |
| `lib/db/pedidos.ts` → `enviarReciboPorCorreo(pedidoId)` (server action) | Carga el pedido completo y los ajustes, genera el PDF con `ReciboPdf`, arma el correo y lo envía con `lib/correo/resend.ts`. Devuelve éxito o un mensaje de error, nunca lanza hacia la pantalla sin control |
| `VistaDocumentos.tsx` | Botón "Enviar por correo" (deshabilitado si `pedido.clienteCorreo` es nulo, con el motivo visible) y botón "Descargar PDF" junto a los que ya existen |

## 5. Pantallas

### 5.1 `/pedidos` — dos botones nuevos

Junto al total "Por cobrar", dos botones: **Excel** y **PDF**. Descargan el
resultado tal como está filtrado en ese momento (pestaña, rango de fechas,
estado, estado de pago) — no solo las filas visibles de la página actual.

### 5.2 `/pedidos/[id]/documentos` — dos botones nuevos

Junto a "Imprimir" e "Imagen para WhatsApp":

- **Descargar PDF** — siempre disponible.
- **Enviar por correo** — deshabilitado, con el motivo a la vista, si el
  pedido no tiene `clienteCorreo`. Si el envío falla (red, Resend caído), el
  mensaje de error aparece en la misma pantalla y se puede reintentar sin
  perder nada, igual que las acciones de fila del listado de pedidos.

### 5.3 Formulario de pedido nuevo — transportadora

El campo de texto libre se reemplaza por un desplegable con las
transportadoras activas y una opción "Otra", que revela un campo de texto
para el caso puntual no contemplado en la lista.

### 5.4 Creación rápida de cliente y ficha de cliente — correo

Un campo más, "Correo (opcional)", junto a teléfono y cédula. Si se escribe
algo que no tiene forma de correo, se rechaza con un mensaje claro, igual que
ya pasa con los demás campos.

## 6. Reglas de negocio

| Regla | Razón |
|---|---|
| **El correo del cliente es opcional.** | La toma de pedido por teléfono/WhatsApp no siempre incluye ese dato; exigirlo bloquearía la operación diaria. |
| **Si hay correo, debe tener formato válido.** | Evita guardar basura que después falla en silencio al intentar enviar. |
| **El correo de un pedido confirmado no cambia si el cliente edita su ficha después.** | Mismo principio ya fijado para nombre, teléfono y cédula: lo que se imprimió (o se envió) no se reescribe solo. |
| **La exportación siempre refleja el filtro activo, sin paginar.** | Si el negocio filtra "este mes" y exporta, espera *todo* ese mes, no los primeros 50. |
| **Mientras no haya un dominio propio verificado en Resend, el correo solo llega a la casilla dueña de la cuenta de Resend, nunca a un cliente real.** | Es una restricción de Resend sobre el dominio de pruebas `resend.dev`, no del código. El botón queda activo y funcional para probar el flujo completo, pero no debe usarse como canal real con clientes hasta verificar el dominio. |
| **La cédula se muestra completa en las tres presentaciones del recibo (impreso, PNG, PDF).** | Decisión consciente del negocio (§3, decisión 9), documentada como reemplazo explícito de la regla de enmascaramiento del diseño original. |
| **"Otra" transportadora guarda el texto libre tal cual lo escribió el asesor.** | No se valida contra ninguna lista: es la válvula de escape para lo no contemplado, y forzar un formato ahí le quitaría el propósito. |

## 7. Manejo de errores

- **Exportar:** si `listarPedidosParaExportar` falla, la ruta HTTP devuelve un
  error legible en vez de un archivo corrupto; el navegador lo muestra como
  una descarga fallida, no como un Excel o PDF vacío que parezca válido.
- **Enviar por correo:** un fallo de red hacia Resend, o una respuesta de
  error de la API, se captura en `enviarReciboPorCorreo` y se devuelve como
  mensaje a la pantalla. No se marca nada como "enviado" en la interfaz salvo
  que Resend confirme la aceptación del envío.
- **Correo con formato inválido:** se rechaza en el formulario, antes de
  llegar a la base de datos.

## 8. Pruebas

**Unitarias (Vitest):**

- `lib/clientes/validacion.ts` — casos válidos e inválidos de formato de
  correo (vacío se acepta como "sin correo"; con texto, exige forma de
  correo).
- `lib/documentos/a-excel.ts` — el workbook generado tiene las columnas y
  filas esperadas (se inspecciona con la API de `exceljs`, sin escribir a
  disco).
- `ReciboPdf` / `ListadoPedidosPdf` — smoke test: renderizan sin lanzar con
  datos de ejemplo (`renderToBuffer` de `@react-pdf/renderer`).
- `Recibo.test.tsx` — se actualiza para esperar la cédula completa en vez de
  enmascarada.

**De integración:**

- `listarPedidosParaExportar` trae todas las filas del filtro, no las
  primeras 50 (con más de una página de datos sembrados).
- `crearCliente`/`actualizarCliente` guardan y devuelven `correo`.
- Confirmar un pedido copia `cliente.correo` a `pedidos.cliente_correo`, y
  editar el cliente después no lo altera (mismo estilo de prueba que ya
  existe para nombre/teléfono/cédula en `clientes.integracion.test.ts`).
- `listarTransportadorasActivas()` devuelve solo las `activa = true`, en el
  orden sembrado.
- `enviarReciboPorCorreo` con el cliente Resend simulado (mock del SDK, sin
  llamada real): construye el correo con el destinatario, asunto y adjunto
  correctos, y propaga un error legible si el mock responde con fallo.

**End-to-end (Playwright):**

- Tomar un pedido nacional, elegir transportadora de la lista y con "Otra",
  confirmar, y verificar que el recibo y el rótulo muestran el valor
  correcto.
- Exportar el listado filtrado a Excel y a PDF y verificar que la descarga
  se dispara con el `Content-Type` esperado.
- Con un cliente sin correo, verificar que "Enviar por correo" aparece
  deshabilitado; con un cliente con correo, que el botón dispara la acción
  (usando el mock de Resend, no un envío real).

## 9. Orden de construcción

1. **Transportadoras** — autónomo, sin dependencias nuevas. Migración,
   consulta, `<select>` en el formulario.
2. **Exportar listado (Excel y PDF)** — introduce `exceljs` y
   `@react-pdf/renderer`. Autónomo salvo por esas dos dependencias nuevas.
3. **Cédula completa en el recibo** — cambio pequeño y totalmente
   independiente de los demás pasos: solo quita `enmascararCedula` de
   `Recibo.tsx`, que ya existe hoy. `ReciboPdf` todavía no existe en este
   punto (se crea en el paso 4) y nace ya sin máscara, así que no necesita
   este mismo ajuste después.
4. **Recibo en PDF y envío por correo** — el más grande: reutiliza
   `@react-pdf/renderer` del paso 2, agrega el SDK `resend`, la migración de
   correo, los formularios de cliente y el botón de envío.

## 10. Puertas que quedan abiertas

- **Verificar un dominio propio en Resend:** mientras no se haga, el correo
  no llega a clientes reales. Es un trámite del negocio (DNS), no una tarea
  de este plan.
- **Historial de envíos de correo:** hoy no se guarda si un recibo se envió
  ni cuándo. Si el negocio necesita saber "¿ya le mandé el recibo a este
  cliente?", es una columna o tabla nueva para otro plan.
- **Administrar transportadoras desde Ajustes:** hoy se administran por SQL,
  igual que productos. Si la lista cambia seguido, se agrega una pantalla
  después.
- **Reporte por transportadora o por método de pago:** ninguno de los dos se
  pidió aquí; el balance y los reportes siguen siendo un plan aparte, como ya
  lo fijó el diseño de operación.
