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
