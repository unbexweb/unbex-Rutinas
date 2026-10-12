# Unbex Rutinas — Permisos (RLS) por rol y tabla

Fuente: `supabase/migrations/20261010120200_rls.sql` (políticas) y `20261010120100_funciones_y_triggers.sql` (helpers y guardas).
Todo está **restringido al gym del usuario** (`gym_id`); un usuario de otro gym no ve nada.

**Leyenda:** `S` leer · `I` crear · `U` editar · `D` borrar · `—` sin acceso

**Quién es quién**
- **anon**: sin sesión. No tiene acceso a ninguna tabla.
- **Alumno activo**: `rol = alumno` y `estado = activo`.
- **Alumno pendiente/inactivo**: `rol = alumno` y estado distinto de activo. Solo ve su propio perfil y su ficha; **no ve planes**.
- **Profe / Admin** (= "staff"): deben estar `activo`. El admin hereda todo lo del profe; las únicas diferencias están en `profiles`.

## Matriz

| Tabla | anon | Alumno pendiente / inactivo | Alumno activo | Profe | Admin |
| --- | --- | --- | --- | --- | --- |
| `gyms` | — | S (su gym) | S (su gym) | S (su gym) | S (su gym) |
| `profiles` | — | S (solo el propio) | S (solo el propio) | S (todo el gym) · U solo de **alumnos** | S (todo el gym) · U de **todos** (incluye `rol`) |
| `fichas_salud` | — | S, I, U (solo la propia) | S, I, U (solo la propia) | S (de alumnos del gym) | S (de alumnos del gym) |
| `ejercicios` | — | — | S (solo los de sus planes y los que ya registró) | S, I, U, D (gym) | S, I, U, D (gym) |
| `planes` | — | — | S (solo los de sus asignaciones) | S, I, U, D (gym) | S, I, U, D (gym) |
| `sesiones` | — | — | S (de sus planes) | S, U (gym) | S, U (gym) |
| `bloques` | — | — | S (de sus planes) | S, I, U, D (gym) | S, I, U, D (gym) |
| `bloque_ejercicios` | — | — | S (de sus planes) | S, I, U, D (gym) | S, I, U, D (gym) |
| `asignaciones` | — | S (las propias) | S (las propias) · U solo progreso | S, I, U, D (alumnos del gym) | S, I, U, D (alumnos del gym) |
| `registros_sesion` | — | S (los propios) | S, I, U (los propios, de sesiones de su asignación activa) | S, I, U, D (gym) | S, I, U, D (gym) |
| `registros_series` | — | S (los propios) | S, I, U (los propios) | S, I, U, D (gym) | S, I, U, D (gym) |
| `solicitudes_ciclo` | — | S (las propias) | S (las propias) · I (solo con asignación finalizada) | S, U (atender) | S, U (atender) |

## Detalles que no entran en la tabla

**profiles**
- No hay `INSERT` desde el cliente: el perfil lo crea el trigger de `auth.users` (siempre `alumno` + `pendiente`). El alta que hace el gym y la aprobación se hacen con service role o con un `UPDATE` del staff.
- No hay `DELETE`: la baja es `estado = inactivo`.
- **Solo el admin puede cambiar un `rol`** (política + trigger `profiles_guard`). Un profe no puede editar a otro profe ni a un admin, ni ascenderse.
- `id` y `gym_id` son inmutables para cualquier usuario con sesión.

**Alumno y planes**
- El alumno ve un plan solo si tiene (o tuvo) una asignación con ese plan. Así ve su plan actual, los ya hechos y los de ciclos anteriores.
- Un alumno que pasa a `pendiente`/`inactivo` deja de ver planes, bloques, ejercicios y de poder registrar.
- `ejercicios`: el alumno ve únicamente los que aparecen en sus planes o en sus registros (necesarios para "peso de la vez anterior" entre planes).

**asignaciones**
- El alumno puede `UPDATE` su asignación para avanzar (`semana_actual`, `estimulo_actual`, `estado`, `fecha_fin`). El trigger `asignaciones_guard` le **impide cambiar `plan_id`, `alumno_id` o `fecha_inicio`**.
- Solo hay una asignación `activa` por alumno (índice único parcial).

**registros**
- El alumno solo crea registros de sesiones que pertenecen al plan de su asignación **activa**, y series de ejercicios de esa sesión usando el ejercicio o su alternativa.
- No hay `DELETE` para el alumno (si se equivoca, edita la serie).

**solicitudes_ciclo**
- El alumno solo puede crear una solicitud (`pendiente`, sin `atendida_por`) sobre una asignación suya ya `finalizada`.
- El staff atiende: cambia `estado` a `atendida` y `atendida_por` debe ser él mismo.

**Funciones**
| Función | Quién puede ejecutarla |
| --- | --- |
| `current_gym_id()`, `current_rol()`, `current_estado()`, `is_staff()`, `is_alumno_activo()`, `alumno_en_mi_gym()`, `plan_en_mi_gym()`, `alumno_tiene_plan()`, `alumno_ve_ejercicio()` | `authenticated` (las usan las políticas) |
| `asignar_plan(alumno_id, plan_id)` | `authenticated`, exige `is_staff()` y mismo gym. Finaliza la asignación activa (si hay) y crea la nueva en S1·E1 |
| `atender_solicitud(solicitud_id, plan_id)` | Ídem. Llama a `asignar_plan` y marca la solicitud `atendida` por el usuario actual |
| `duplicar_plan(plan_id, nombre, tipo, nivel)` | Ídem. Clona un plan completo como plantilla nueva |
| `copiar_semana(plan_id, origen, destino)` | Ídem. Reemplaza los bloques de la semana destino con una copia de la origen |
| `completar_sesion(asignacion_id, sesion_id)` | `authenticated` (alumno activo): valida que la asignación sea suya y esté activa y que la sesión sea la que le toca; marca la sesión hecha y avanza (S4·E6 finaliza la asignación) |
| `personalizar_plan(alumno_id, plan_id)` | `authenticated`, pero adentro exige `is_staff()` y que plan y alumno sean del mismo gym |
| `email_por_dni(dni)` | **solo `service_role`** (Server Action de login). No está expuesta a `anon` ni `authenticated` para que nadie pueda averiguar el email de un DNI |

## Decisiones para revisar

1. **`email_por_dni` solo para service_role.** El SPEC dice "función server-side", así que el login por DNI tiene que pasar por un Server Action con la service role key. Si preferís llamarla desde el cliente con anon, hay que abrirla (y se puede enumerar DNI → email).
2. **El alumno puede hacer `UPDATE` de su asignación** (limitado por trigger a progreso). El pedido original no lo listaba, pero "marcar entrenamiento como hecho → avanza" lo necesita. Alternativa: una función `completar_sesion()` y sin `UPDATE` directo.
3. **`sesiones`: el staff no puede insertar ni borrar** (solo leer/editar), para no romper el 4×6 = 24. Los borrados llegan solo por cascada al borrar un plan.
4. **El staff tiene escritura sobre `registros_*`** del gym (corregir un dato). Si preferís que sea solo lectura, se saca la política `*_write_staff`.
5. **`registros_series.ejercicio_usado_id` es NOT NULL (y `bloque_ejercicio_id` es nullable, `ON DELETE SET NULL`)** (el SPEC lo muestra como "si eligió la alternativa"). Siempre se guarda el ejercicio realmente usado; así "peso de la vez anterior" es una consulta directa y con índice.
6. **Profe/admin pendiente o inactivo no tienen permisos de staff** (`is_staff()` exige `activo`).
7. **El `gym_id` del alumno viene de `raw_user_meta_data`** al registrarse (como pediste). Cualquiera puede autoregistrarse en cualquier gym, pero queda `pendiente` y sin acceso hasta que el staff lo apruebe.
8. **Primer admin:** se crea el usuario (con `nombre`, `apellido`, `dni`, `gym_id` en el metadata) y se promueve a mano desde el SQL editor: `update public.profiles set rol = 'admin', estado = 'activo' where email = '...';` (sin sesión, el guard no restringe).

## Personalizar un plan (`personalizar_plan`)

Solo staff. Clona plan, sesiones, bloques y ejercicios con `alumno_id` y `origen_id` (la plantilla), **repunta la asignación activa** y además **reasigna el historial del alumno** (`registros_sesion` / `registros_series` de esa asignación) a las sesiones y ejercicios del plan nuevo, para que no pierda lo que ya registró. Falla si el plan ya es personalizado, si el alumno no tiene asignación activa o si esa asignación no es de `p_plan_id` («El alumno no tiene asignado ese plan»).

## Nota para el editor de planes (Fase 4)

Editar bloques y ejercicios con **`UPDATE` en el lugar**; no borrar y reinsertar. `registros_series.bloque_ejercicio_id` es `ON DELETE SET NULL`: si se borra un `bloque_ejercicio`, las series registradas no se pierden (el historial queda por `ejercicio_usado_id`), pero pierden el vínculo con el bloque y el alumno ya no puede editarlas (la política exige `bloque_ejercicio_id` no nulo). Borrar y reinsertar le cortaría ese vínculo a todo el historial del ejercicio. Borrar solo cuando el profe saca de verdad un ejercicio del plan.

## Panel de staff (Fase 4)

- Toda Server Action que usa el cliente admin (service role) verifica antes con `verificarStaff()` / `verificarAdmin()` (`lib/staff/auth.ts`) y toma el `gym_id` del perfil de quien llama, nunca del formulario. Hoy solo la usan el alta de alumnos y de profes (`lib/staff/crear-usuario.ts`).
- El resto del panel (editor de planes, alumnos, ejercicios, solicitudes) usa el cliente con sesión del usuario: RLS sigue filtrando por gym.
- El editor de planes edita con `UPDATE` en el lugar (cambiar ejercicio, series, orden...). Solo se borra cuando el profe quita algo a propósito. `copiar_semana` sí reemplaza los bloques de la semana destino, así que las series ya registradas en ellos quedan con `bloque_ejercicio_id` nulo.
- Un plan con asignaciones (activas o históricas) no se puede eliminar; el panel lo avisa antes de llegar al error de la base.
