-- Plan 03: allow service_role to run generation worker RPCs + 429 requeue helper.

-- Service role JWT is already the project’s most privileged key; treating it as a
-- generation runner lets generate-dispatcher claim/complete without a human JWT.
CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.platform_role = 'admin'
  )
  OR coalesce(auth.jwt() ->> 'role', '') = 'service_role';
$$;

ALTER FUNCTION public.is_platform_admin() OWNER TO postgres;

COMMENT ON FUNCTION public.is_platform_admin() IS
  'True for profiles.platform_role=admin, or Edge/cron callers using the service_role JWT.';

-- Requeue a running item after transient provider errors (e.g. DeepSeek 429).
CREATE OR REPLACE FUNCTION public.admin_generation_requeue_item(
  p_item_id uuid,
  p_error text DEFAULT NULL,
  p_diagnosis text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_item public.generation_job_items;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'admin only';
  END IF;

  SELECT * INTO v_item
  FROM public.generation_job_items
  WHERE id = p_item_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'item not found';
  END IF;

  UPDATE public.generation_job_items
  SET
    status = 'queued',
    diagnosis = COALESCE(NULLIF(trim(p_diagnosis), ''), diagnosis, 'requeued'),
    error = LEFT(
      COALESCE(NULLIF(trim(p_error), ''), error, 'Requeued after transient error'),
      2000
    ),
    finished_at = NULL,
    last_claimed_at = NULL
  WHERE id = p_item_id;

  -- Soft backoff hint on the job config (dispatcher reads drain_backoff_until).
  IF COALESCE(NULLIF(trim(p_diagnosis), ''), '') IN ('deepseek_429', 'rate_limited') THEN
    UPDATE public.generation_jobs
    SET
      config = jsonb_set(
        COALESCE(config, '{}'::jsonb),
        '{drain_backoff_until}',
        to_jsonb((now() + interval '45 seconds')::text),
        true
      ),
      updated_at = now()
    WHERE id = v_item.job_id;
  END IF;

  RETURN jsonb_build_object(
    'status', 'queued',
    'requeued', true,
    'diagnosis', COALESCE(NULLIF(trim(p_diagnosis), ''), 'requeued')
  );
END;
$$;

ALTER FUNCTION public.admin_generation_requeue_item(uuid, text, text) OWNER TO postgres;
GRANT ALL ON FUNCTION public.admin_generation_requeue_item(uuid, text, text) TO authenticated;
GRANT ALL ON FUNCTION public.admin_generation_requeue_item(uuid, text, text) TO service_role;

COMMENT ON FUNCTION public.admin_generation_requeue_item(uuid, text, text) IS
  'Return a running generation item to queued (429 / transient). May set drain_backoff_until.';
