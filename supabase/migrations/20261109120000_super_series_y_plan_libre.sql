-- Unbex Rutinas · Fase 7 · Super series con estructura y plan libre
--
--  1. bloque_ejercicios.grupo: letra A, B, C… Los ejercicios del mismo grupo (dentro de un bloque)
--     forman una super serie. Se puebla desde las notas "Super Serie", "Super Serie 1/2".
--  2. registros_series.hecha: cada serie se tilda por separado; el ejercicio queda hecho cuando
--     todas sus series están tildadas.
--  3. completar_sesion: el alumno puede hacer cualquier entrenamiento pendiente de su plan, en el
--     orden que quiera. semana_actual/estimulo_actual pasan a ser el primer pendiente (sugerido).
--  4. pedir_proximo_ciclo: finaliza la asignación (aunque queden pendientes) y crea la solicitud.
--  5. _clonar_bloques y personalizar_plan copian también el grupo.

-- ---------------------------------------------------------------------------
-- 1. Super series
-- ---------------------------------------------------------------------------
alter table public.bloque_ejercicios
  add column grupo text,
  add constraint bloque_ejercicios_grupo_letra check (grupo is null or grupo ~ '^[A-Z]$');

-- La clave de cada nota: el número ("1", "2") o '' si es "Super Serie" a secas.
-- Dentro de cada bloque se asignan letras en el orden en que aparecen los grupos.
with candidatos as (
  select
    be.id,
    be.bloque_id,
    be.orden,
    coalesce(substring(be.nota from '(?i)super serie\s*(\d+)\s*$'), '') as clave
  from public.bloque_ejercicios be
  where be.nota ~* 'super serie\s*\d*\s*$'
),
grupos as (
  select
    bloque_id,
    clave,
    chr(64 + dense_rank() over (partition by bloque_id order by min(orden), clave)::int) as letra
  from candidatos
  group by bloque_id, clave
)
update public.bloque_ejercicios be
set grupo = g.letra,
    -- se limpia la nota; si lo que queda es ruido de la planilla (solo f, x, t, z, r, g, comas…) también se borra
    nota = case
             when length(btrim(regexp_replace(be.nota, '[\s·]*super serie\s*\d*\s*$', '', 'i'))) >= 20
                  and btrim(regexp_replace(be.nota, '[\s·]*super serie\s*\d*\s*$', '', 'i')) ~ '^[fxtþzrg,$ -]*$' then null
             else nullif(btrim(regexp_replace(be.nota, '[\s·]*super serie\s*\d*\s*$', '', 'i')), '')
           end
from candidatos c
join grupos g on g.bloque_id = c.bloque_id and g.clave = c.clave
where be.id = c.id;

-- ---------------------------------------------------------------------------
-- 2. Series tildadas
-- ---------------------------------------------------------------------------
alter table public.registros_series add column hecha boolean not null default false;
-- lo que ya estaba registrado cuenta como hecho
update public.registros_series set hecha = true where peso is not null or reps is not null;

-- ---------------------------------------------------------------------------
-- 5. Los clones copian el grupo
-- ---------------------------------------------------------------------------
create or replace function public._clonar_bloques(p_origen uuid, p_destino uuid)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  b    record;
  v_nb uuid;
begin
  for b in
    select * from public.bloques where sesion_id = p_origen order by orden, created_at
  loop
    insert into public.bloques (sesion_id, orden, nombre, indicacion)
    values (p_destino, b.orden, b.nombre, b.indicacion)
    returning id into v_nb;

    insert into public.bloque_ejercicios
      (bloque_id, orden, ejercicio_id, alternativa_id, series, reps,
       carga_sugerida, registra_carga, nota, grupo)
    select v_nb, orden, ejercicio_id, alternativa_id, series, reps,
           carga_sugerida, registra_carga, nota, grupo
    from public.bloque_ejercicios
    where bloque_id = b.id;
  end loop;
end;
$$;

create or replace function public.personalizar_plan(p_alumno_id uuid, p_plan_id uuid)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_gym     uuid := public.current_gym_id();
  v_plan    public.planes%rowtype;
  v_new     uuid;
  v_asig    uuid;
  v_asig_plan uuid;
  v_old_ids uuid[] := '{}';
  v_new_ids uuid[] := '{}';
  v_nb      uuid;
  v_nbe     uuid;
  b         record;
  be        record;
begin
  if not public.is_staff() then
    raise exception 'Solo el staff puede personalizar planes' using errcode = '42501';
  end if;

  select * into v_plan from public.planes where id = p_plan_id and gym_id = v_gym;
  if not found then
    raise exception 'El plan no existe en tu gimnasio' using errcode = 'P0002';
  end if;

  if v_plan.alumno_id is not null then
    raise exception 'El plan ya es personalizado; partí de la plantilla general' using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.profiles
    where id = p_alumno_id and gym_id = v_gym and rol = 'alumno'
  ) then
    raise exception 'El alumno no existe en tu gimnasio' using errcode = 'P0002';
  end if;

  select id, plan_id into v_asig, v_asig_plan
  from public.asignaciones
  where alumno_id = p_alumno_id and estado = 'activa'
  for update;
  if not found then
    raise exception 'El alumno no tiene una asignación activa' using errcode = 'P0002';
  end if;

  if v_asig_plan is distinct from p_plan_id then
    raise exception 'El alumno no tiene asignado ese plan' using errcode = '22023';
  end if;

  -- Plan nuevo (el trigger crea sus 24 sesiones vacías)
  insert into public.planes (gym_id, nombre, tipo, nivel, alumno_id, origen_id)
  values (v_plan.gym_id, v_plan.nombre, v_plan.tipo, v_plan.nivel, p_alumno_id, v_plan.id)
  returning id into v_new;

  -- Bloques y ejercicios de cada sesión (se emparejan por semana/estímulo)
  for b in
    select bl.id, bl.orden, bl.nombre, bl.indicacion, ns.id as new_sesion_id
    from public.bloques bl
    join public.sesiones os on os.id = bl.sesion_id and os.plan_id = v_plan.id
    join public.sesiones ns on ns.plan_id = v_new
                           and ns.semana = os.semana and ns.estimulo = os.estimulo
    order by os.semana, os.estimulo, bl.orden
  loop
    insert into public.bloques (sesion_id, orden, nombre, indicacion)
    values (b.new_sesion_id, b.orden, b.nombre, b.indicacion)
    returning id into v_nb;

    for be in
      select * from public.bloque_ejercicios where bloque_id = b.id order by orden
    loop
      insert into public.bloque_ejercicios
        (bloque_id, orden, ejercicio_id, alternativa_id, series, reps,
         carga_sugerida, registra_carga, nota, grupo)
      values
        (v_nb, be.orden, be.ejercicio_id, be.alternativa_id, be.series, be.reps,
         be.carga_sugerida, be.registra_carga, be.nota, be.grupo)
      returning id into v_nbe;

      v_old_ids := v_old_ids || be.id;
      v_new_ids := v_new_ids || v_nbe;
    end loop;
  end loop;

  -- Historial del alumno: pasa a apuntar a las sesiones/ejercicios del plan nuevo
  update public.registros_sesion r
  set sesion_id = ns.id
  from public.sesiones os, public.sesiones ns
  where r.asignacion_id = v_asig
    and os.id = r.sesion_id
    and ns.plan_id = v_new
    and ns.semana = os.semana and ns.estimulo = os.estimulo;

  update public.registros_series rs
  set bloque_ejercicio_id = m.new_id
  from unnest(v_old_ids, v_new_ids) as m(old_id, new_id), public.registros_sesion r
  where rs.bloque_ejercicio_id = m.old_id
    and r.id = rs.registro_id
    and r.asignacion_id = v_asig;

  update public.registros_ejercicios re
  set bloque_ejercicio_id = m.new_id
  from unnest(v_old_ids, v_new_ids) as m(old_id, new_id), public.registros_sesion r
  where re.bloque_ejercicio_id = m.old_id
    and r.id = re.registro_id
    and r.asignacion_id = v_asig;

  -- Repuntar la asignación activa
  update public.asignaciones set plan_id = v_new where id = v_asig;

  return v_new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. completar_sesion: cualquier entrenamiento pendiente, en cualquier orden
-- Devuelve true si con esta sesión quedaron completas las 24 (la asignación se finaliza).
-- ---------------------------------------------------------------------------
create or replace function public.completar_sesion(p_asignacion_id uuid, p_sesion_id uuid)
returns boolean
language plpgsql security definer
set search_path = ''
as $$
declare
  v_uid  uuid := (select auth.uid());
  v_asig public.asignaciones%rowtype;
  v_sem  smallint;
  v_est  smallint;
  v_hoy  date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
begin
  if v_uid is null or not public.is_alumno_activo() then
    raise exception 'No tenés permiso para completar entrenamientos' using errcode = '42501';
  end if;

  select * into v_asig
  from public.asignaciones
  where id = p_asignacion_id and alumno_id = v_uid
  for update;
  if not found then
    raise exception 'La asignación no existe' using errcode = 'P0002';
  end if;

  if v_asig.estado <> 'activa' then
    raise exception 'Tu plan ya está finalizado' using errcode = '22023';
  end if;

  if not exists (select 1 from public.sesiones where id = p_sesion_id and plan_id = v_asig.plan_id) then
    raise exception 'Ese entrenamiento no es de tu plan' using errcode = '22023';
  end if;

  if exists (
    select 1 from public.registros_sesion
    where asignacion_id = p_asignacion_id and sesion_id = p_sesion_id and completada
  ) then
    raise exception 'Ese entrenamiento ya está hecho' using errcode = '22023';
  end if;

  insert into public.registros_sesion (asignacion_id, sesion_id, fecha, completada)
  values (p_asignacion_id, p_sesion_id, v_hoy, true)
  on conflict (asignacion_id, sesion_id)
  do update set completada = true, fecha = v_hoy;

  -- El primer pendiente pasa a ser el sugerido.
  select s.semana, s.estimulo into v_sem, v_est
  from public.sesiones s
  where s.plan_id = v_asig.plan_id
    and not exists (
      select 1 from public.registros_sesion r
      where r.asignacion_id = p_asignacion_id and r.sesion_id = s.id and r.completada
    )
  order by s.semana, s.estimulo
  limit 1;

  if not found then
    update public.asignaciones
    set estado = 'finalizada', fecha_fin = v_hoy
    where id = p_asignacion_id;
    return true;
  end if;

  update public.asignaciones
  set semana_actual = v_sem, estimulo_actual = v_est
  where id = p_asignacion_id;
  return false;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. pedir_proximo_ciclo: disponible siempre; finaliza la asignación y crea la solicitud.
-- ---------------------------------------------------------------------------
create function public.pedir_proximo_ciclo(p_asignacion_id uuid, p_tipo text, p_nota text)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_uid  uuid := (select auth.uid());
  v_asig public.asignaciones%rowtype;
  v_sol  uuid;
  v_hoy  date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
begin
  if v_uid is null or not public.is_alumno_activo() then
    raise exception 'No tenés permiso para pedir un ciclo' using errcode = '42501';
  end if;

  if btrim(coalesce(p_tipo, '')) = '' then
    raise exception 'Elegí qué ciclo querés' using errcode = '22023';
  end if;

  select * into v_asig
  from public.asignaciones
  where id = p_asignacion_id and alumno_id = v_uid
  for update;
  if not found then
    raise exception 'La asignación no existe' using errcode = 'P0002';
  end if;

  -- una sola solicitud pendiente por asignación
  select id into v_sol
  from public.solicitudes_ciclo
  where asignacion_id = p_asignacion_id and estado = 'pendiente'
  limit 1;
  if found then
    return v_sol;
  end if;

  if v_asig.estado = 'activa' then
    update public.asignaciones
    set estado = 'finalizada', fecha_fin = v_hoy
    where id = p_asignacion_id;
  end if;

  insert into public.solicitudes_ciclo (alumno_id, asignacion_id, tipo_solicitado, nota)
  values (v_uid, p_asignacion_id, btrim(p_tipo), nullif(btrim(coalesce(p_nota, '')), ''))
  returning id into v_sol;

  return v_sol;
end;
$$;

revoke execute on function public.pedir_proximo_ciclo(uuid, text, text) from public, anon;
grant execute on function public.pedir_proximo_ciclo(uuid, text, text) to authenticated;
