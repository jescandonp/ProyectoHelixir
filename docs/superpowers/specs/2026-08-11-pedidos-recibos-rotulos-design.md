# Sistema de pedidos, recibos y rótulos — Documento de diseño

**Fecha:** 11 de agosto de 2026
**Estado:** validado con el cliente, pendiente de plan de implementación
**Para:** negocio de helado artesanal en tarro (John Leudo / Adriana)

---

## 1. El problema

Los pedidos llegan por WhatsApp en lenguaje suelto ("3 de vainilla, 2 de kiwi, 1 de maracuyá"). Hoy cada pedido se retranscribe **tres veces**: al recibo, al rótulo de envío y al cuaderno de cuentas. Cada retranscripción es una oportunidad de equivocarse, y ninguna de las tres alimenta a las otras.

John lo pidió como tres necesidades separadas:

1. Llenar un recibo digital prediseñado, imprimible en 80 mm.
2. Extraer de ese mismo recibo los datos para el rótulo de envío adhesivo.
3. Que los pedidos sirvan para contabilidad, balances periódicos y base de datos.

## 2. El principio rector: un pedido, tres salidas

El recibo, el rótulo y la fila contable **no son tres cosas**: son tres representaciones del mismo objeto. Si se modelan como tres documentos separados, hay que mantenerlos sincronizados a mano y se vuelven a desincronizar. Si se modela **el pedido** como fuente única de verdad, el punto 3 sale gratis en vez de ser un tercer trabajo.

```
                    ┌──────────────┐
                    │    PEDIDO    │   ← única fuente de verdad
                    └──────┬───────┘
          ┌────────────────┼────────────────┐
          ▼                ▼                ▼
   Recibo 80 mm      Rótulo de envío     Balance
   (PNG + impreso)   (local o nacional)  (consultas + Excel)
```

## 3. Contexto de operación

| Dato | Valor |
|---|---|
| Volumen | ~20 pedidos/día (~600/mes) |
| Dispositivo | Computador, en casa/local |
| Personas | Adriana y John, más asesores de venta |
| Impresoras | Térmica 80 mm + etiquetadora de adhesivos |
| Facturación | Comprobante informal — **no** hay obligación DIAN |
| Clientes | Se repiten con frecuencia; hay tiendas/revendedores |
| Entregas | Domicilio local (contraentrega) y envío nacional por transportadora |
| Producto | Tarro de helado artesanal, **tamaño único: 1 tarro = 1 kg** |

**Consecuencia del tamaño único:** el reporte de kilos es contar tarros. No hay que guardar pesos en el catálogo ni hacer conversiones.

## 4. Alcance

### En alcance

- Captura de pedidos con directorio de clientes y autocompletado
- Catálogo de 21 productos con precios
- Generación de recibo 80 mm: PNG para WhatsApp + impresión térmica
- Generación de rótulo local y rótulo nacional
- Estados de pedido y de pago
- Balance de ventas con exportación a Excel
- Usuarios con código de asesor
- Pantalla de ajustes del negocio

### Fuera de alcance, con la razón

| Descartado | Por qué |
|---|---|
| Facturación electrónica DIAN | El negocio no está obligado. Requeriría proveedor autorizado, resolución de numeración, CUFE y XML UBL — otro proyecto. |
| Entrada de pedidos por audio | El propio transcriptor de WhatsApp convirtió "vainillas" en "bellillas" y "bañillas", y "maracuyás" en "maracuyales". Un parser sobre esa transcripción habría metido tres sabores inexistentes a un pedido. |
| Parser de texto del chat | John describió digitación con autocompletado, no pegado de texto. Se descarta como vía principal; ver §12. |
| Precios mayorista/detal separados | Hoy los revendedores pagan igual que todos. Se marca el tipo de cliente solo para reportes. El precio de cada ítem es editable a mano si algún día toca negociar. |
| Costos y utilidad | El sistema mide **ventas**, no ganancia: no sabe qué cuesta la leche, la fruta ni el gas. Registrarlo es trabajo diario adicional. Ver §12 para cómo se agregaría después. |
| Control de inventario / producción | No se pidió. |
| App móvil nativa | La web responsiva basta; el trabajo real ocurre en el PC. |

## 5. Modelo de datos

### Producto
| Campo | Notas |
|---|---|
| `id`, `nombre`, `emoji` | |
| `precio` | Precio vigente. Se copia al ítem, no se referencia. |
| `activo` | Los productos se desactivan, nunca se borran. |
| `orden` | Para agrupar por escalón de precio en la pantalla. |

Catálogo semilla (21 productos, 1 kg cada uno):

- **$20.000** — Base neutra
- **$22.000** — Vainilla 🌸, Fresa 🍓, Arequipe 🍬, Chocolate 🍫, Yogurt tradicional 🥤, Frutos Rojos 🍎, Frutos Morados 🍇, Ron pasas 🍹, Coco 🥥, Mandarina
- **$25.000** — Maracuyá 🍊, Frutos Amarillos, Yogurt Premium, Chicle Blue Ice, Kiwi, Café
- **$28.000** — Milo, 4 Leches, Nucita, Postre de Nata 🐄

### Cliente
| Campo | Notas |
|---|---|
| `codigo` | `CL-0042`. Generado por el sistema. **Es lo que se imprime en el rótulo en lugar de la cédula.** |
| `nombre`, `telefono` | |
| `cedula` | Opcional. Aparece enmascarada por defecto (`1.017.xxx.xxx`). |
| `tipo` | `detal` \| `mayorista` — solo clasifica para reportes. |
| `notas` | |

### Dirección
Un cliente tiene varias (casa, oficina, la tienda). Campos: `linea`, `barrio`, `ciudad`, `departamento`, `indicaciones`, `es_principal`.

Mandar el pedido a la dirección vieja es un error clásico; por eso la dirección se escoge en cada pedido y no se hereda en silencio.

### Pedido
| Campo | Notas |
|---|---|
| `consecutivo` | `PED-000148`. Prefijo configurable. Asignado al **confirmar**, no al crear el borrador. |
| `fecha`, `cliente_id`, `direccion_id` | La dirección se copia también como texto plano al pedido, para que un cambio futuro en la ficha del cliente no reescriba pedidos viejos. |
| `asesor_id` | El usuario que lo tomó. No se digita: sale de la sesión. |
| `tipo_entrega` | `local` \| `nacional` |
| `transportadora` | Solo si es nacional. Ej. ForEnvíos. |
| `estado` | `borrador` → `confirmado` → `enviado` → `entregado`, o `anulado` |
| `estado_pago` | `pendiente` \| `contraentrega` \| `pagado` |
| `fecha_pago`, `metodo_pago` | |
| `valor_domicilio`, `descuento` | |
| `subtotal`, `total`, `total_kg` | Calculados y **persistidos** al confirmar. |
| `observaciones` | Texto libre. Sale impreso en el recibo. |
| `anulado_motivo`, `anulado_por`, `anulado_at` | |

### ÍtemPedido
| Campo | Notas |
|---|---|
| `producto_id` | **Nulo** si es ítem libre. |
| `descripcion` | Para ítems libres: `"el que dijo para experimentar"`. |
| `cantidad` | En tarros = en kg. |
| `precio_unitario` | **Congelado.** Copiado del producto al momento de agregarlo. |
| `subtotal` | `cantidad × precio_unitario` |

### Usuario
`nombre`, `email`, `codigo_asesor` (ej. `002`), `activo`.

### Ajustes del negocio
Una sola fila: nombre, eslogan, logo, teléfonos de pedidos, datos de pago, prefijo del consecutivo, valor por defecto del domicilio, tamaño de etiqueta, texto del pie de recibo.

## 6. Pantallas

### 6.1 Tomar pedido — la pantalla crítica

A 20 pedidos diarios, cada 30 segundos de fricción son 10 minutos al día. **Meta: un pedido en menos de 30 segundos.**

Diseño de una sola pantalla, sin asistente por pasos. Tres zonas:

1. **Cliente** — buscador que filtra por nombre o teléfono mientras se escribe. El desplegable muestra coincidencias con su código y ciudad, y la **última opción siempre crea un cliente nuevo** con el texto ya escrito. Al seleccionar, se cargan sus direcciones.
2. **Sabores** — grilla de los 21 productos agrupados por escalón de precio, igual que la lista de WhatsApp que el negocio ya envía. Un clic suma uno. Escribir filtra. Un botón aparte agrega un **ítem libre**.
3. **El pedido** — ítems, subtotal con kilos, domicilio, total, tipo de entrega, estado de pago, y el botón de generar.

**Decisiones y su razón:**

| Decisión | Razón |
|---|---|
| Una pantalla, no asistente de pasos | Un asistente de 4 pasos son ~80 clics extra al día. Y devolverse a corregir es incómodo. |
| El cliente nuevo se crea sin salir | "Primero vaya a la sección de clientes" rompe el flujo 30 veces al día. |
| Teclado por encima de mouse | Quien digita en tanda es más rápido sin soltar el teclado. |
| Guardado automático de borrador | Si se va la luz o se cierra el navegador, el pedido a medias sigue ahí. |
| Los kilos se suman en vivo | El dato que John quiere en el balance se ve mientras se toma el pedido. |

### 6.2 Lista de pedidos
Filtros por fecha, estado, estado de pago, cliente y asesor. Desde cada fila: ver, reimprimir recibo, reimprimir rótulo, marcar pagado, marcar entregado, anular. Vista destacada de **pendientes de cobro**.

### 6.3 Clientes
Listado con buscador. Ficha con datos, direcciones, historial de pedidos y total comprado. Aquí — y solo aquí — se puede revelar la cédula completa.

### 6.4 Balance
Ver §8.

### 6.5 Ajustes
Datos del negocio, catálogo de productos y precios, usuarios y códigos de asesor, transportadoras.

## 7. Las tres salidas

Las tres se generan desde **una sola plantilla por documento**, que produce dos cosas a la vez: la impresión nativa del navegador y el PNG. Esto garantiza que la imagen que recibe el cliente y el papel que sale de la impresora **nunca puedan divergir**.

### 7.1 Recibo — 80 mm

**Qué es:** un **cobro**, no un comprobante. John: *"recibito para pasarle al cliente para que me pague"*. Sale **antes** del pago. Por eso, debajo del total, lleva un recuadro de estado que dice **"PENDIENTE DE PAGO"** con los datos de Nequi/banco. Cuando el pedido se marca pagado, ese mismo recuadro se reimprime diciendo **"PAGADO ✓"** con la fecha. Un solo diseño, dos estados.

**Formato:** tomado de la referencia real que aportó el cliente (recibo de Hel-ixir Soft, usado como **referencia de estilo, no de contenido**): tipografía condensada, barras negras invertidas para "Detalle del Pedido" y "TOTAL", puntos de relleno entre concepto y valor.

**Estructura, de arriba abajo:**

1. Logo, nombre del negocio, eslogan, teléfonos de pedidos
2. `ORDEN No. PED-000148` centrado y grande
3. Encabezado con **etiquetas alineadas en columna fija**: Cliente / Fecha / Cédula / Teléfono / Asesor / Envío / Dirección. Fecha y Cédula van en filas separadas, por pedido explícito del cliente.
4. Barra negra `Detalle del Pedido`
5. Línea de resumen: `10 Kg · Helado Artesanal en tarro`
6. Ítems con puntos de relleno. Cuando la cantidad es mayor a 1, una línea pequeña debajo muestra `4 kg × $22.000`.
7. Subtotal y Valor Domicilio, alineados a la derecha
8. Barra negra `TOTAL: $ 240.000`
9. **Valor Total en Letras** — generado por el sistema
10. **Observaciones** — texto libre
11. Recuadro de estado de pago
12. `❄ CONSERVAR EN FRÍO` y agradecimiento

**Blanco y negro, un solo diseño para los dos usos.** La térmica de 80 mm no imprime color ni grises: quema puntos negros. Un diseño a color se pierde o sale como mancha al imprimir, y obliga a mantener dos plantillas que con el tiempo se despegan. Un recibo bien alineado en blanco y negro se ve profesional.

### 7.2 Rótulo — entrega local

Lo lee **el mensajero**, que navega por barrio.

- Nombre del destinatario en grande
- Dirección, y **barrio destacado**
- Ciudad en pequeño
- Teléfono grande — llama desde la puerta
- Indicaciones ("Portería, timbre 302")
- **Recuadro grueso: `COBRAR CONTRAENTREGA $240.000`**
- Al pie: código de cliente `CL-0042` y `❄ CONGELADO`

### 7.3 Rótulo — envío nacional

Lo lee **la transportadora**, que clasifica por ciudad.

- Nombre del destinatario en grande
- Dirección y barrio
- **Ciudad en negro invertido**, con departamento
- Teléfono grande
- **Sin valor a cobrar** — la plata la maneja la transportadora, no va escrita en la caja
- **Recuadro grande: `❄ PRODUCTO CONGELADO · MANTENER EN CADENA DE FRÍO · ENTREGA PRIORITARIA`**
- Remitente (obligatorio para devoluciones) y código de cliente

**Son dos diseños, no uno con campos que aparecen y desaparecen**, porque los leen dos personas distintas buscando cosas distintas.

### 7.4 Privacidad de la cédula

Regla, propuesta por el cliente y adoptada tal cual:

> **La cédula nunca se imprime en un rótulo. En su lugar va el código de cliente.**

Razón: el rótulo va pegado a una caja que ven el mensajero, el portero, el vecino y quien pase. En el recibo — que es del propio cliente — sí aparece, y enmascarada por defecto. Si la transportadora exige la cédula, se consulta en el sistema y se digita en *su* portal.

Beneficio adicional: si vuelve una caja rechazada sin más datos que el rótulo, el código identifica al cliente de inmediato.

## 8. Balance

Responde exactamente lo que el cliente enumeró:

| Lo pedido | Dónde está |
|---|---|
| "cuántas bañillas se vendieron, cuántos frutos rojos" | Unidades por sabor, con barra comparativa y valor |
| "cuántos compraron" | Clientes distintos en el periodo, y cuántos nuevos |
| "el total de compras en kilos" | Total de kg |
| "el total de compras en valor" | Total vendido |
| "el cliente que más compró, el que menos" | Dos listas: mayores y menores |
| "no sé si sea un excel o qué archivito" | Botón de exportar a `.xlsx` |
| "para irle haciendo el seguimiento" | Comparación contra el periodo anterior |

Filtros: hoy, este mes, o rango de fechas.

**Agregados, con su razón:**

- **Por cobrar** — total y número de pedidos con pago pendiente. El negocio vende mucho a contraentrega; sin este número, la plata que deben es invisible hasta que alguien se acuerda. Es el dato que más rápido se convierte en pérdida.
- **Clientes inactivos** — quiénes no compran hace más de 30 días. Esa lista es un mensaje de WhatsApp, y recuperar un cliente viejo cuesta menos que conseguir uno nuevo.
- **Ticket promedio y kilos por pedido** — distinguen crecer por más clientes de crecer por más compra de cada uno. Son decisiones distintas.
- **Ventas por asesor** — consecuencia de haber incluido el campo de asesor.

**Advertencia registrada:** todo esto son **ventas, no utilidad**. El sistema no conoce los costos. La palabra "balance" promete más de lo que esto entrega, y el cliente lo aceptó de forma consciente eligiendo no registrar costos por ahora.

## 9. Arquitectura técnica

| Capa | Elección | Por qué |
|---|---|---|
| Framework | Next.js (App Router) + TypeScript | Una sola base para pantallas y API. |
| Estilos | Tailwind | |
| Base de datos | Supabase (Postgres) | Respaldo automático. La contabilidad no puede vivir en un solo disco duro. |
| Autenticación | Supabase Auth, correo + contraseña | Pocos usuarios, sin complejidad. |
| Hosting | Vercel | Nivel gratuito suficiente a este volumen. |
| Exportación | SheetJS (`.xlsx`) | |
| Número a letras | Módulo propio, con pruebas | El formato colombiano ("M/cte") es específico; una dependencia genérica no acierta. |

### Generación de documentos

Cada documento (recibo, rótulo local, rótulo nacional) es **un componente React con estilos de impresión**, del que salen dos cosas:

1. **Impresión nativa** — vía CSS `@page`: `80mm auto` para el recibo, el tamaño del rollo para los rótulos. El navegador imprime texto real: nítido en térmica, mejor que una imagen.
2. **PNG** — el mismo DOM convertido a imagen en el cliente (`html-to-image`), a 2× de resolución para que se vea nítido en el celular.

**Por qué el mismo DOM para ambos:** cualquier otro camino (plantilla de impresión por un lado, generador de imagen por otro) crea dos fuentes que se desincronizan. Aquí es físicamente imposible.

### Módulos y sus fronteras

Cada uno debe poder entenderse y probarse solo:

| Módulo | Responsabilidad | Depende de |
|---|---|---|
| `catalogo` | Productos y precios vigentes | BD |
| `clientes` | Clientes, direcciones, códigos | BD |
| `pedidos` | Crear, calcular, cambiar de estado, anular | catálogo, clientes |
| `consecutivos` | Asignar el número, sin repetir ni saltar | BD |
| `documentos` | Las tres plantillas y su render | pedidos (solo lectura) |
| `balance` | Consultas agregadas y exportación | BD (solo lectura) |
| `numero-a-letras` | Número → texto en español colombiano | nada |

`documentos` y `balance` **solo leen**. Nunca escriben. Así un cambio en cómo se ve un recibo no puede corromper un pedido.

## 10. Reglas de negocio y manejo de errores

| Regla | Razón |
|---|---|
| **El precio se congela en el ítem.** | Si no, subir el precio de la vainilla reescribe los balances del mes pasado. |
| **El consecutivo se asigna al confirmar, en una transacción atómica.** | Los borradores no queman números. Dos personas confirmando a la vez no pueden obtener el mismo. |
| **Nada se borra: se anula**, con motivo, autor y fecha. | Borrar deja huecos en los consecutivos y ningún balance vuelve a cuadrar. |
| **El sistema nunca infiere un precio.** | Un ítem libre exige descripción y precio escritos por una persona. "El que dijiste para experimentar" no se adivina. |
| **No se puede confirmar sin cliente, dirección e ítems.** | Un pedido confirmado incompleto genera un rótulo inservible. |
| **Aviso —no bloqueo— de posible duplicado** si el mismo cliente tiene un pedido idéntico el mismo día. | A veces son dos pedidos reales. Avisar, no decidir por el usuario. |
| **El borrador sobrevive a fallos.** | Se guarda en el navegador y se sincroniza. Un corte de luz no cuesta un pedido. |
| **La cédula no viaja a ningún rótulo.** | §7.4 |
| **Los totales se persisten al confirmar**, no se recalculan al mostrar. | Un pedido impreso y un pedido en pantalla deben decir lo mismo para siempre. |

Errores de red al confirmar: mensaje claro, reintento, y el pedido nunca se pierde de la pantalla.

## 11. Pruebas

**Unitarias (Vitest)** — la lógica que, si falla, cuesta plata:
- Cálculo de subtotal, domicilio, descuento y total
- Suma de kilos
- Congelado de precios: cambiar el precio de un producto no altera pedidos existentes
- Número a letras, incluyendo los casos incómodos (uno, veintiuno, cien, ciento uno, mil, un millón, cifras con centenas de mil)
- Asignación de consecutivo sin repetición bajo concurrencia
- Transiciones de estado válidas e inválidas

**De integración** — reglas contra base de datos real: anulación, pedido incompleto, detección de duplicado.

**End-to-end (Playwright)** — el flujo crítico completo: buscar cliente → seleccionar → agregar ítems → confirmar → ver recibo → ver rótulo. Y el flujo de cliente nuevo sin salir de la pantalla.

**De regresión visual** — instantánea de las tres plantillas, para que un cambio de estilos no rompa en silencio un recibo que ya se imprime bien.

## 12. Orden de construcción

Todo está en alcance; el orden busca que haya algo **utilizable lo antes posible**.

1. **Base** — proyecto, base de datos, autenticación, catálogo semilla, ajustes del negocio.
2. **El núcleo** — clientes con direcciones, pantalla de tomar pedido, consecutivos, estados.
3. **Las salidas** — recibo 80 mm, los dos rótulos, impresión y PNG. *Al terminar esto el sistema ya reemplaza el trabajo manual de hoy.*
4. **Operación** — lista de pedidos, pendientes de cobro, reimpresión, anulación.
5. **Balance** — reportes, comparación de periodos, exportación a Excel.
6. **Seguimiento** — clientes inactivos, ventas por asesor.

**Puertas que quedan abiertas, sin construirse ahora:**
- *Margen por sabor:* agregar `costo_por_kg` al producto y una columna al balance. No requiere rehacer nada.
- *Parser de pedidos:* el módulo `pedidos` ya tiene una entrada definida; un traductor de texto se enchufa ahí sin tocar el resto.
- *QR en el rótulo:* escanear y abrir el pedido completo. Se propuso y **no se implementa ahora**; el rótulo ya lleva el consecutivo impreso, que cumple la misma función buscándolo a mano.

## 13. Datos pendientes de confirmar

No bloquean el plan de implementación — se cargan en la pantalla de ajustes — pero se necesitan antes de imprimir el primer recibo real:

1. Nombre del negocio y eslogan
2. Archivo del logo
3. Los dos teléfonos de pedidos
4. Nequi / cuenta bancaria para el recuadro de pago
5. Prefijo del consecutivo (en las maquetas se usó `PED-`) y número desde el cual arrancar
6. Tamaño real del rollo de la etiquetadora (se asumió **10 × 15 cm**)
7. Lista de transportadoras con las que trabajan
8. Nombres y códigos de los asesores
9. Valor por defecto del domicilio local

## 14. Decisiones registradas

| # | Decisión | Alternativa descartada | Razón |
|---|---|---|---|
| 1 | Aplicación web en la nube | App local en el PC; comprar un POS existente | La contabilidad no puede vivir en un solo disco. Un POS de mostrador no resuelve el rótulo ni los pedidos por chat, que es el trabajo más fastidioso. |
| 2 | El pedido es la fuente de verdad | Tres documentos independientes | Evita retranscribir y desincronizar. |
| 3 | Una sola pantalla para tomar el pedido | Asistente por pasos | Velocidad a 20 pedidos/día. |
| 4 | Recibo en blanco y negro, un solo diseño | Uno a color para WhatsApp y otro para imprimir | La térmica no imprime color. Dos diseños se despegan con el tiempo. |
| 5 | Dos rótulos distintos | Uno solo con campos condicionales | Mensajero y transportadora leen cosas distintas. |
| 6 | Código de cliente en el rótulo, nunca la cédula | Cédula impresa | Propuesta del cliente. El rótulo lo ve cualquiera. |
| 7 | Aviso de cadena de frío en los rótulos | Nada | Es helado. Una caja mal manipulada es un pedido perdido. Propuesto por el equipo de diseño, no estaba en el pedido original. |
| 8 | Sin entrada por audio | Transcripción automática | El transcriptor de WhatsApp produjo "bellillas" y "maracuyales" sobre el propio audio del cliente. |
| 9 | Solo ventas, sin costos | Registro de costos y utilidad | Trabajo diario adicional. Decisión consciente del cliente; la puerta queda abierta. |
| 10 | Sin precios mayoristas | Lista de precios por tipo de cliente | Hoy todos pagan igual. YAGNI. |
| 11 | Campo de asesor incluido | Omitirlo | Pedido explícito del cliente; implica usuarios con nombre propio y reporte por asesor. |
