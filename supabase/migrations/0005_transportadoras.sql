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

-- Configurar RLS: el equipo es pequeño, todos ven todo (como otras tablas)
alter table transportadoras enable row level security;
create policy "autenticados leen y escriben transportadoras" on transportadoras for all to authenticated using (true) with check (true);
grant select, insert, update, delete on transportadoras to authenticated;

-- service_role acceso total (ya lo tiene por defecto vía GRANT ALL)
grant all on transportadoras to service_role;
