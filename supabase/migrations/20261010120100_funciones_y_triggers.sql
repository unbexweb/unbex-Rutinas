-- Unbex Rutinas · Fase 1 · Funciones helper, triggers y personalización de planes

-- ---------------------------------------------------------------------------
-- Helpers para RLS (security definer, search_path fijo)
-- Leen profiles/asignaciones saltando RLS para evitar recursión en las políticas.
-- ---------------------------------------------------------------------------
create function public.current_gym_id()
returns uuid
language sql stable security definer
set search_path = ''
as $$
  select p.gym_id from public.profiles p where p.id = (select auth.uid())
$$;

create function public.current_rol()
returns public.rol
language sql stable security definer
set search_path = ''
as $$
  select p.rol from public.profiles p where p.id = (select auth.uid())
$$;

create function public.current_estado()
returns public.estado_usuario
language sql stable security definer
set search_path = ''
as $$
  select p.estado from public.profiles p where p.id = (select auth.uid())
$$;

-- Admin o profe, y activo. El admin hereda todo lo del profe.
create function public.is_staff()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid())
      and p.rol in ('admin', 'profe')
      and p.estado = 'activo'
  )
$$;

-- Alumno aprobado (un alumno pendiente o inactivo no ve planes).
create function public.is_alumno_activo()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid())
      and p.rol = 'alumno'
      and p.estado = 'activo'
  )
$$;

create function public.alumno_en_mi_gym(p_alumno_id uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = p_alumno_id and p.gym_id = public.current_gym_id()
  )
$$;

create function public.plan_en_mi_gym(p_plan_id uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.planes pl
    where pl.id = p_plan_id and pl.gym_id = public.current_gym_id()
  )
$$;

-- El alumno activo tiene (o tuvo) una asignación con ese plan.
create function public.alumno_tiene_plan(p_plan_id uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select public.is_alumno_activo()
     and exists (
       select 1 from public.asignaciones a
       where a.alumno_id = (select auth.uid()) and a.plan_id = p_plan_id
     )
$$;

-- El alumno activo ve un ejercicio si aparece en sus planes o en sus registros.
create function public.alumno_ve_ejercicio(p_ejercicio_id uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select public.is_alumno_activo()
     and (
       exists (
         select 1
         from public.asignaciones a
         join public.sesiones s            on s.plan_id = a.plan_id
         join public.bloques b             on b.sesion_id = s.id
         join public.bloque_ejercicios be  on be.bloque_id = b.id
         where a.alumno_id = (select auth.uid())
           and (be.ejercicio_id = p_ejercicio_id or be.alternativa_id = p_ejercicio_id)
       )
       or exists (
         select 1
         from public.asignaciones a
         join public.registros_sesion r on r.asignacion_id = a.id
         join public.registros_series rs on rs.registro_id = r.id
         where a.alumno_id = (select auth.uid())
           and rs.ejercicio_usado_id = p_ejercicio_id
       )
     )
$$;

-- ---------------------------------------------------------------------------
-- Login con DNI: devuelve SOLO el email asociado.
-- Pensada para llamarse desde un Server Action con la service role key;
-- no queda expuesta a anon ni authenticated (evita enumerar DNIs).
-- ---------------------------------------------------------------------------
create function public.email_por_dni(p_dni text)
returns text
language sql stable security definer
set search_path = ''
as $$
  select p.email
  from public.profiles p
  where p.dni = regexp_replace(coalesce(p_dni, ''), '\D', '', 'g')
  limit 1
$$;

-- ---------------------------------------------------------------------------
-- Trigger: al crear un plan, crear sus 24 sesiones (4 semanas x 6 estímulos)
-- ---------------------------------------------------------------------------
create function public.crear_sesiones_del_plan()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  insert into public.sesiones (plan_id, semana, estimulo)
  select new.id, w, e
  from generate_series(1, 4) as w
  cross join generate_series(1, 6) as e;
  return new;
end;
$$;

create trigger planes_crear_sesiones
  after insert on public.planes
  for each row execute function public.crear_sesiones_del_plan();

-- ---------------------------------------------------------------------------
-- Trigger: al crear un usuario en auth.users, crear su profile.
-- Lee nombre, apellido, dni y gym_id de raw_user_meta_data.
-- Siempre nace como alumno pendiente: el rol y la aprobación los define el staff.
-- ---------------------------------------------------------------------------
create function public.handle_new_user()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_meta     jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_gym      uuid;
  v_dni      text;
  v_nombre   text := btrim(coalesce(v_meta ->> 'nombre', ''));
  v_apellido text := btrim(coalesce(v_meta ->> 'apellido', ''));
begin
  v_gym := nullif(v_meta ->> 'gym_id', '')::uuid;
  v_dni := regexp_replace(coalesce(v_meta ->> 'dni', ''), '\D', '', 'g');

  if v_gym is null or v_dni = '' or v_nombre = '' or v_apellido = '' then
    raise exception 'Faltan datos de registro: nombre, apellido, dni y gym_id son obligatorios';
  end if;

  insert into public.profiles (id, gym_id, rol, nombre, apellido, dni, email, estado)
  values (new.id, v_gym, 'alumno', v_nombre, v_apellido, v_dni, lower(new.email), 'pendiente');

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Guardas contra escalada de privilegios
-- auth.uid() es NULL para service_role / SQL editor / migraciones: ahí no se restringe.
-- ---------------------------------------------------------------------------

-- profiles: id y gym_id inmutables; solo admin puede cambiar el rol.
create function public.profiles_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    return new;
  end if;

  if new.id is distinct from old.id or new.gym_id is distinct from old.gym_id then
    raise exception 'No se puede cambiar el id ni el gimnasio de un perfil' using errcode = '42501';
  end if;

  if new.rol is distinct from old.rol and public.current_rol() is distinct from 'admin' then
    raise exception 'Solo un admin puede cambiar el rol' using errcode = '42501';
  end if;

  return new;
end;
$$;

create trigger profiles_guard
  before update on public.profiles
  for each row execute function public.profiles_guard();

-- asignaciones: el alumno solo puede avanzar su progreso (semana/estímulo/estado/fecha_fin),
-- no cambiar de plan ni de dueño.
create function public.asignaciones_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or public.is_staff() then
    return new;
  end if;

  if new.alumno_id is distinct from old.alumno_id
     or new.plan_id is distinct from old.plan_id
     or new.fecha_inicio is distinct from old.fecha_inicio then
    raise exception 'El alumno solo puede actualizar su progreso' using errcode = '42501';
  end if;

  return new;
end;
$$;

create trigger asignaciones_guard
  before update on public.asignaciones
  for each row execute function public.asignaciones_guard();

-- ---------------------------------------------------------------------------
-- Personalizar un plan para un alumno puntual.
-- Clona plan + sesiones + bloques + bloque_ejercicios con alumno_id y origen_id,
-- repunta la asignación activa del alumno y reasigna su historial (registros)
-- al plan nuevo para no perder el progreso. Solo staff.
-- ---------------------------------------------------------------------------
create function public.personalizar_plan(p_alumno_id uuid, p_plan_id uuid)
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
         carga_sugerida, registra_carga, nota)
      values
        (v_nb, be.orden, be.ejercicio_id, be.alternativa_id, be.series, be.reps,
         be.carga_sugerida, be.registra_carga, be.nota)
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

  -- Repuntar la asignación activa
  update public.asignaciones set plan_id = v_new where id = v_asig;

  return v_new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Permisos de ejecución
-- ---------------------------------------------------------------------------
revoke execute on all functions in schema public from public, anon, authenticated;

-- Helpers usados por las políticas RLS
grant execute on function
  public.current_gym_id(),
  public.current_rol(),
  public.current_estado(),
  public.is_staff(),
  public.is_alumno_activo(),
  public.alumno_en_mi_gym(uuid),
  public.plan_en_mi_gym(uuid),
  public.alumno_tiene_plan(uuid),
  public.alumno_ve_ejercicio(uuid)
to authenticated;

-- RPC para el staff (valida is_staff() adentro)
grant execute on function public.personalizar_plan(uuid, uuid) to authenticated;

-- Login con DNI: solo servidor
grant execute on function public.email_por_dni(text) to service_role;
