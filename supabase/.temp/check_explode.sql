SELECT position('questionsPerEvent' in pg_get_functiondef('public.admin_explode_generation_plan(jsonb)'::regprocedure)) > 0 AS has_per_event;
