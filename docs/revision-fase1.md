# Revisión Fase 1 — correcciones antes del push

Editá las migraciones existentes (todavía no se aplicaron a Supabase).

1. `registros_series.bloque_ejercicio_id`: hacela nullable con `ON DELETE SET NULL`. El historial se conserva por `ejercicio_usado_id`. Ajustá las políticas de insert/update del alumno para que sigan exigiendo `bloque_ejercicio_id` no nulo al crear.

2. `personalizar_plan`: validá que la asignación activa del alumno tenga `plan_id = p_plan_id`. Si no, error claro: "El alumno no tiene asignado ese plan".

3. En todas las políticas RLS, envolvé las llamadas a `is_staff()`, `is_alumno_activo()` y `current_rol()` en `(select ...)` para que se evalúen una vez por consulta.

4. Agregá en `docs/RLS.md` una nota para el editor de planes (Fase 4): editar bloques y ejercicios con UPDATE en el lugar, no borrar y reinsertar.

5. Volvé a correr las pruebas en PGlite, incluida una nueva: borrar un `bloque_ejercicio` que ya tiene series registradas no falla y la serie conserva `peso` y `ejercicio_usado_id`.

6. Commiteá todo: `feat: esquema, RLS y seed (Fase 1)`. No hagas `db push`.

Al terminar, borrá este archivo (`docs/revision-fase1.md`) en el mismo commit.
