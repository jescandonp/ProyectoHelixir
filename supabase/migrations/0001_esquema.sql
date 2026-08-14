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
