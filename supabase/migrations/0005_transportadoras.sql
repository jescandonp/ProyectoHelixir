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

-- Necesario: el GRANT ALL de 0003_rls.sql solo alcanzó a las tablas que
-- existían cuando corrió esa migración, no a esta, creada después.
grant all on transportadoras to service_role;
