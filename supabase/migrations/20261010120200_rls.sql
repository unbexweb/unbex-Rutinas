-- Unbex Rutinas · Fase 1 · Row Level Security
-- Resumen legible en docs/RLS.md
--
-- Criterios:
--  * Todo filtrado por gym_id vía helpers (current_gym_id(), alumno_en_mi_gym(), plan_en_mi_gym()).
--  * "staff" = admin o profe activo (is_staff()). El admin hereda todo lo del profe.
--  * Alumno: solo ve planes si está activo (is_alumno_activo()).
--  * Las tablas hijas (bloques, bloque_ejercicios, registros_series...) heredan la visibilidad
--    de su padre con EXISTS: lo que no podés ver arriba, tampoco lo ves abajo.
--  * Los permisos de acceso a tablas del rol anon se revocan: sin sesión no hay nada.

-- ---------------------------------------------------------------------------
-- Habilitar RLS en TODAS las tablas
-- ---------------------------------------------------------------------------
alter table public.gyms              enable row level security;
alter table public.profiles          enable row level security;
alter table public.fichas_salud      enable row level security;
alter table public.ejercicios        enable row level security;
alter table public.planes            enable row level security;
alter table public.sesiones          enable row level security;
alter table public.bloques           enable row level security;
alter table public.bloque_ejercicios enable row level security;
alter table public.asignaciones      enable row level security;
alter table public.registros_sesion  enable row level security;
alter table public.registros_series  enable row level security;
alter table public.solicitudes_ciclo enable row level security;

-- ---------------------------------------------------------------------------
-- gyms: cada usuario ve solo su gimnasio (sin escritura desde el cliente)
-- ---------------------------------------------------------------------------
create policy gyms_select on public.gyms
  for select to authenticated
  using (id = (select public.current_gym_id()));

-- ---------------------------------------------------------------------------
-- profiles
--  * Se crean solo por el trigger de auth.users (no hay INSERT desde el cliente).
--  * No hay DELETE: la baja es estado = 'inactivo'.
--  * El profe gestiona alumnos; solo el admin toca profes/admins.
--  * El cambio de rol lo bloquea además el trigger profiles_guard (solo admin).
-- ---------------------------------------------------------------------------
create policy profiles_select on public.profiles
  for select to authenticated
  using (
    id = (select auth.uid())
    or ((select public.is_staff()) and gym_id = (select public.current_gym_id()))
  );

create policy profiles_update_staff on public.profiles
  for update to authenticated
  using (
    (select public.is_staff())
    and gym_id = (select public.current_gym_id())
    and ((select public.current_rol()) = 'admin' or rol = 'alumno')
  )
  with check (
    (select public.is_staff())
    and gym_id = (select public.current_gym_id())
    and ((select public.current_rol()) = 'admin' or rol = 'alumno')
  );

-- ---------------------------------------------------------------------------
-- fichas_salud: el alumno la lee y edita; el staff solo la lee
-- ---------------------------------------------------------------------------
create policy fichas_select on public.fichas_salud
  for select to authenticated
  using (
    alumno_id = (select auth.uid())
    or ((select public.is_staff()) and public.alumno_en_mi_gym(alumno_id))
  );

create policy fichas_insert_alumno on public.fichas_salud
  for insert to authenticated
  with check (
    alumno_id = (select auth.uid())
    and (select public.current_rol()) = 'alumno'
  );

create policy fichas_update_alumno on public.fichas_salud
  for update to authenticated
  using (alumno_id = (select auth.uid()))
  with check (alumno_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- ejercicios
-- ---------------------------------------------------------------------------
create policy ejercicios_select_staff on public.ejercicios
  for select to authenticated
  using ((select public.is_staff()) and gym_id = (select public.current_gym_id()));

create policy ejercicios_select_alumno on public.ejercicios
  for select to authenticated
  using (
    gym_id = (select public.current_gym_id())
    and public.alumno_ve_ejercicio(id)
  );

create policy ejercicios_insert_staff on public.ejercicios
  for insert to authenticated
  with check ((select public.is_staff()) and gym_id = (select public.current_gym_id()));

create policy ejercicios_update_staff on public.ejercicios
  for update to authenticated
  using ((select public.is_staff()) and gym_id = (select public.current_gym_id()))
  with check ((select public.is_staff()) and gym_id = (select public.current_gym_id()));

create policy ejercicios_delete_staff on public.ejercicios
  for delete to authenticated
  using ((select public.is_staff()) and gym_id = (select public.current_gym_id()));

-- ---------------------------------------------------------------------------
-- planes
-- ---------------------------------------------------------------------------
create policy planes_select_staff on public.planes
  for select to authenticated
  using ((select public.is_staff()) and gym_id = (select public.current_gym_id()));

create policy planes_select_alumno on public.planes
  for select to authenticated
  using (public.alumno_tiene_plan(id));

create policy planes_insert_staff on public.planes
  for insert to authenticated
  with check (
    (select public.is_staff())
    and gym_id = (select public.current_gym_id())
    and (alumno_id is null or public.alumno_en_mi_gym(alumno_id))
    and (origen_id is null or public.plan_en_mi_gym(origen_id))
  );

create policy planes_update_staff on public.planes
  for update to authenticated
  using ((select public.is_staff()) and gym_id = (select public.current_gym_id()))
  with check (
    (select public.is_staff())
    and gym_id = (select public.current_gym_id())
    and (alumno_id is null or public.alumno_en_mi_gym(alumno_id))
    and (origen_id is null or public.plan_en_mi_gym(origen_id))
  );

create policy planes_delete_staff on public.planes
  for delete to authenticated
  using ((select public.is_staff()) and gym_id = (select public.current_gym_id()));

-- ---------------------------------------------------------------------------
-- sesiones: las 24 las crea el trigger; el staff solo lee y edita (no altera el 4x6)
-- ---------------------------------------------------------------------------
create policy sesiones_select_staff on public.sesiones
  for select to authenticated
  using ((select public.is_staff()) and public.plan_en_mi_gym(plan_id));

create policy sesiones_select_alumno on public.sesiones
  for select to authenticated
  using (public.alumno_tiene_plan(plan_id));

create policy sesiones_update_staff on public.sesiones
  for update to authenticated
  using ((select public.is_staff()) and public.plan_en_mi_gym(plan_id))
  with check ((select public.is_staff()) and public.plan_en_mi_gym(plan_id));

-- ---------------------------------------------------------------------------
-- bloques: heredan la visibilidad de su sesión
-- ---------------------------------------------------------------------------
create policy bloques_select on public.bloques
  for select to authenticated
  using (exists (select 1 from public.sesiones s where s.id = bloques.sesion_id));

create policy bloques_insert_staff on public.bloques
  for insert to authenticated
  with check (
    (select public.is_staff())
    and exists (select 1 from public.sesiones s where s.id = bloques.sesion_id)
  );

create policy bloques_update_staff on public.bloques
  for update to authenticated
  using (
    (select public.is_staff())
    and exists (select 1 from public.sesiones s where s.id = bloques.sesion_id)
  )
  with check (
    (select public.is_staff())
    and exists (select 1 from public.sesiones s where s.id = bloques.sesion_id)
  );

create policy bloques_delete_staff on public.bloques
  for delete to authenticated
  using (
    (select public.is_staff())
    and exists (select 1 from public.sesiones s where s.id = bloques.sesion_id)
  );

-- ---------------------------------------------------------------------------
-- bloque_ejercicios: heredan de su bloque; los ejercicios deben ser del mismo gym
-- ---------------------------------------------------------------------------
create policy bloque_ejercicios_select on public.bloque_ejercicios
  for select to authenticated
  using (exists (select 1 from public.bloques b where b.id = bloque_ejercicios.bloque_id));

create policy bloque_ejercicios_insert_staff on public.bloque_ejercicios
  for insert to authenticated
  with check (
    (select public.is_staff())
    and exists (select 1 from public.bloques b where b.id = bloque_ejercicios.bloque_id)
    and exists (select 1 from public.ejercicios e where e.id = bloque_ejercicios.ejercicio_id)
    and (
      bloque_ejercicios.alternativa_id is null
      or exists (select 1 from public.ejercicios e where e.id = bloque_ejercicios.alternativa_id)
    )
  );

create policy bloque_ejercicios_update_staff on public.bloque_ejercicios
  for update to authenticated
  using (
    (select public.is_staff())
    and exists (select 1 from public.bloques b where b.id = bloque_ejercicios.bloque_id)
  )
  with check (
    (select public.is_staff())
    and exists (select 1 from public.bloques b where b.id = bloque_ejercicios.bloque_id)
    and exists (select 1 from public.ejercicios e where e.id = bloque_ejercicios.ejercicio_id)
    and (
      bloque_ejercicios.alternativa_id is null
      or exists (select 1 from public.ejercicios e where e.id = bloque_ejercicios.alternativa_id)
    )
  );

create policy bloque_ejercicios_delete_staff on public.bloque_ejercicios
  for delete to authenticated
  using (
    (select public.is_staff())
    and exists (select 1 from public.bloques b where b.id = bloque_ejercicios.bloque_id)
  );

-- ---------------------------------------------------------------------------
-- asignaciones
--  * El alumno lee las suyas y puede avanzar su progreso (el trigger
--    asignaciones_guard le impide cambiar de plan o de dueño).
--  * El staff las crea, edita y borra dentro de su gym.
-- ---------------------------------------------------------------------------
create policy asignaciones_select on public.asignaciones
  for select to authenticated
  using (
    alumno_id = (select auth.uid())
    or ((select public.is_staff()) and public.alumno_en_mi_gym(alumno_id))
  );

create policy asignaciones_insert_staff on public.asignaciones
  for insert to authenticated
  with check (
    (select public.is_staff())
    and public.alumno_en_mi_gym(alumno_id)
    and public.plan_en_mi_gym(plan_id)
  );

create policy asignaciones_update_staff on public.asignaciones
  for update to authenticated
  using ((select public.is_staff()) and public.alumno_en_mi_gym(alumno_id))
  with check (
    (select public.is_staff())
    and public.alumno_en_mi_gym(alumno_id)
    and public.plan_en_mi_gym(plan_id)
  );

create policy asignaciones_update_alumno on public.asignaciones
  for update to authenticated
  using (alumno_id = (select auth.uid()) and (select public.is_alumno_activo()))
  with check (alumno_id = (select auth.uid()) and (select public.is_alumno_activo()));

create policy asignaciones_delete_staff on public.asignaciones
  for delete to authenticated
  using ((select public.is_staff()) and public.alumno_en_mi_gym(alumno_id));

-- ---------------------------------------------------------------------------
-- registros_sesion
-- ---------------------------------------------------------------------------
create policy registros_sesion_select on public.registros_sesion
  for select to authenticated
  using (exists (select 1 from public.asignaciones a where a.id = registros_sesion.asignacion_id));

create policy registros_sesion_insert_alumno on public.registros_sesion
  for insert to authenticated
  with check (
    (select public.is_alumno_activo())
    and exists (
      select 1
      from public.asignaciones a
      join public.sesiones s on s.plan_id = a.plan_id
      where a.id = registros_sesion.asignacion_id
        and a.alumno_id = (select auth.uid())
        and a.estado = 'activa'
        and s.id = registros_sesion.sesion_id
    )
  );

create policy registros_sesion_update_alumno on public.registros_sesion
  for update to authenticated
  using (
    (select public.is_alumno_activo())
    and exists (
      select 1 from public.asignaciones a
      where a.id = registros_sesion.asignacion_id and a.alumno_id = (select auth.uid())
    )
  )
  with check (
    (select public.is_alumno_activo())
    and exists (
      select 1
      from public.asignaciones a
      join public.sesiones s on s.plan_id = a.plan_id
      where a.id = registros_sesion.asignacion_id
        and a.alumno_id = (select auth.uid())
        and s.id = registros_sesion.sesion_id
    )
  );

create policy registros_sesion_write_staff on public.registros_sesion
  for all to authenticated
  using (
    (select public.is_staff())
    and exists (select 1 from public.asignaciones a where a.id = registros_sesion.asignacion_id)
  )
  with check (
    (select public.is_staff())
    and exists (select 1 from public.asignaciones a where a.id = registros_sesion.asignacion_id)
  );

-- ---------------------------------------------------------------------------
-- registros_series
-- ---------------------------------------------------------------------------
create policy registros_series_select on public.registros_series
  for select to authenticated
  using (exists (select 1 from public.registros_sesion r where r.id = registros_series.registro_id));

create policy registros_series_insert_alumno on public.registros_series
  for insert to authenticated
  with check (
    (select public.is_alumno_activo())
    and exists (
      select 1
      from public.registros_sesion r
      join public.asignaciones a        on a.id = r.asignacion_id
      join public.bloques b             on b.sesion_id = r.sesion_id
      join public.bloque_ejercicios be  on be.bloque_id = b.id
      where r.id = registros_series.registro_id
        and a.alumno_id = (select auth.uid())
        and registros_series.bloque_ejercicio_id is not null
        and be.id = registros_series.bloque_ejercicio_id
        and registros_series.ejercicio_usado_id in (be.ejercicio_id, be.alternativa_id)
    )
  );

create policy registros_series_update_alumno on public.registros_series
  for update to authenticated
  using (
    (select public.is_alumno_activo())
    and exists (
      select 1
      from public.registros_sesion r
      join public.asignaciones a on a.id = r.asignacion_id
      where r.id = registros_series.registro_id and a.alumno_id = (select auth.uid())
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
      where r.id = registros_series.registro_id
        and a.alumno_id = (select auth.uid())
        and registros_series.bloque_ejercicio_id is not null
        and be.id = registros_series.bloque_ejercicio_id
        and registros_series.ejercicio_usado_id in (be.ejercicio_id, be.alternativa_id)
    )
  );

create policy registros_series_write_staff on public.registros_series
  for all to authenticated
  using (
    (select public.is_staff())
    and exists (select 1 from public.registros_sesion r where r.id = registros_series.registro_id)
  )
  with check (
    (select public.is_staff())
    and exists (select 1 from public.registros_sesion r where r.id = registros_series.registro_id)
  );

-- ---------------------------------------------------------------------------
-- solicitudes_ciclo
--  * El alumno crea la suya solo cuando su asignación está finalizada.
--  * El staff las ve y las atiende (estado/atendida_por).
-- ---------------------------------------------------------------------------
create policy solicitudes_select on public.solicitudes_ciclo
  for select to authenticated
  using (
    alumno_id = (select auth.uid())
    or ((select public.is_staff()) and public.alumno_en_mi_gym(alumno_id))
  );

create policy solicitudes_insert_alumno on public.solicitudes_ciclo
  for insert to authenticated
  with check (
    alumno_id = (select auth.uid())
    and (select public.is_alumno_activo())
    and estado = 'pendiente'
    and atendida_por is null
    and exists (
      select 1 from public.asignaciones a
      where a.id = solicitudes_ciclo.asignacion_id
        and a.alumno_id = (select auth.uid())
        and a.estado = 'finalizada'
    )
  );

create policy solicitudes_update_staff on public.solicitudes_ciclo
  for update to authenticated
  using ((select public.is_staff()) and public.alumno_en_mi_gym(alumno_id))
  with check (
    (select public.is_staff())
    and public.alumno_en_mi_gym(alumno_id)
    and (atendida_por is null or atendida_por = (select auth.uid()))
  );

-- ---------------------------------------------------------------------------
-- Privilegios de tabla
-- anon no accede a nada; authenticated pierde los privilegios que saltean RLS o no usa.
-- ---------------------------------------------------------------------------
revoke all on all tables in schema public from anon;
revoke truncate, references, trigger on all tables in schema public from authenticated;

alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke truncate, references, trigger on tables from authenticated;
