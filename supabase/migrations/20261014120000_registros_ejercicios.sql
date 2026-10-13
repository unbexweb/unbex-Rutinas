-- Unbex Rutinas · Fase 6 · Marca de "hecho" por ejercicio
-- El entrenamiento pasó a ser una sola pantalla con todos los ejercicios, en el orden que el alumno quiera.
-- Hace falta guardar cuáles marcó como hechos, también los que no registran carga (movilidad,
-- activación), que no dejan ninguna fila en registros_series.
-- Una fila por (registro de la sesión, ejercicio del plan). Desmarcar = hecho false (el alumno no borra).

create table public.registros_ejercicios (
  id                  uuid primary key default gen_random_uuid(),
  registro_id         uuid not null references public.registros_sesion (id) on delete cascade,
  bloque_ejercicio_id uuid not null references public.bloque_ejercicios (id) on delete cascade,
  hecho               boolean not null default true,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint registros_ejercicios_uq unique (registro_id, bloque_ejercicio_id)
);
create index registros_ejercicios_bloque_ejercicio_id_idx on public.registros_ejercicios (bloque_ejercicio_id);

create trigger set_updated_at before update on public.registros_ejercicios
  for each row execute function public.set_updated_at();

alter table public.registros_ejercicios enable row level security;

-- Lee quien puede leer el registro de la sesión (el alumno dueño y el staff del gym).
create policy registros_ejercicios_select on public.registros_ejercicios
  for select to authenticated
  using (exists (select 1 from public.registros_sesion r where r.id = registros_ejercicios.registro_id));

-- El alumno marca ejercicios de SU registro y que pertenezcan a esa sesión.
create policy registros_ejercicios_insert_alumno on public.registros_ejercicios
  for insert to authenticated
  with check (
    (select public.is_alumno_activo())
    and exists (
      select 1
      from public.registros_sesion r
      join public.asignaciones a        on a.id = r.asignacion_id
      join public.bloques b             on b.sesion_id = r.sesion_id
      join public.bloque_ejercicios be  on be.bloque_id = b.id
      where r.id = registros_ejercicios.registro_id
        and a.alumno_id = (select auth.uid())
        and be.id = registros_ejercicios.bloque_ejercicio_id
    )
  );

create policy registros_ejercicios_update_alumno on public.registros_ejercicios
  for update to authenticated
  using (
    (select public.is_alumno_activo())
    and exists (
      select 1
      from public.registros_sesion r
      join public.asignaciones a on a.id = r.asignacion_id
      where r.id = registros_ejercicios.registro_id and a.alumno_id = (select auth.uid())
    )
  )
  with check (
    (select public.is_alumno_activo())
    and exists (
      select 1
      from public.registros_sesion r
      join public.asignaciones a        on a.id = r.asignacion_id
      join public.bloques b             on b.sesion_id = r.sesion_id
      join public.bloque_ejercicios be  on be.bloque_id = b.id
      where r.id = registros_ejercicios.registro_id
        and a.alumno_id = (select auth.uid())
        and be.id = registros_ejercicios.bloque_ejercicio_id
    )
  );

create policy registros_ejercicios_write_staff on public.registros_ejercicios
  for all to authenticated
  using (
    (select public.is_staff())
    and exists (select 1 from public.registros_sesion r where r.id = registros_ejercicios.registro_id)
  )
  with check (
    (select public.is_staff())
    and exists (select 1 from public.registros_sesion r where r.id = registros_ejercicios.registro_id)
  );

-- Mismos privilegios que el resto de las tablas: anon nada; authenticated sin truncate/references/trigger.
revoke all on public.registros_ejercicios from anon;
revoke truncate, references, trigger on public.registros_ejercicios from authenticated;
