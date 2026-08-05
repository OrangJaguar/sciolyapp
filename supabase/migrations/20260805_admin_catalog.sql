-- ============================================================================
-- scioly.app — Plan 22 Admin Factory Catalog Studio
-- PASTE-CHECK: SCIOLY-0805-ADMIN-CATALOG
-- Prerequisites: 20260803_initial, 20260804_addons, 20260804_admin
-- Run as: postgres
-- ============================================================================

-- Prompt text is data, not deployed application code. Plan 23 assembles:
-- master + event + optional topic + concept/guide payload.
CREATE TABLE IF NOT EXISTS public.prompt_packs (
  id TEXT PRIMARY KEY,
  scope_type TEXT NOT NULL CHECK (scope_type IN ('master', 'event', 'topic')),
  scope_id TEXT,
  name TEXT NOT NULL,
  system_body TEXT NOT NULL DEFAULT '',
  few_shots JSONB NOT NULL DEFAULT '[]'::jsonb,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  version INT NOT NULL DEFAULT 1 CHECK (version > 0),
  updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT prompt_packs_scope_shape CHECK (
    (scope_type = 'master' AND scope_id IS NULL)
    OR (scope_type IN ('event', 'topic') AND scope_id IS NOT NULL)
  ),
  CONSTRAINT prompt_packs_few_shots_array CHECK (jsonb_typeof(few_shots) = 'array')
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_prompt_packs_scope
  ON public.prompt_packs(scope_type, COALESCE(scope_id, ''));

CREATE TABLE IF NOT EXISTS public.event_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id TEXT NOT NULL REFERENCES public.taxonomy_events(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  source_url TEXT,
  storage_path TEXT,
  tags TEXT[] NOT NULL DEFAULT '{}',
  notes TEXT NOT NULL DEFAULT '',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT event_media_source CHECK (
    NULLIF(BTRIM(source_url), '') IS NOT NULL
    OR NULLIF(BTRIM(storage_path), '') IS NOT NULL
  )
);

CREATE INDEX IF NOT EXISTS idx_event_media_event
  ON public.event_media(event_id, active);

ALTER TABLE public.prompt_packs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_media ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.prompt_packs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_media TO authenticated;

DROP POLICY IF EXISTS prompt_packs_admin_all ON public.prompt_packs;
CREATE POLICY prompt_packs_admin_all ON public.prompt_packs
  FOR ALL TO authenticated
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

DROP POLICY IF EXISTS event_media_admin_all ON public.event_media;
CREATE POLICY event_media_admin_all ON public.event_media
  FOR ALL TO authenticated
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

-- Catalog editing permissions.
GRANT INSERT, UPDATE ON public.concept_guides TO authenticated;
GRANT UPDATE ON public.taxonomy_events TO authenticated;
GRANT UPDATE ON public.taxonomy_concepts TO authenticated;
GRANT INSERT ON public.questions TO authenticated;

DROP POLICY IF EXISTS concept_guides_admin_insert ON public.concept_guides;
CREATE POLICY concept_guides_admin_insert ON public.concept_guides
  FOR INSERT TO authenticated
  WITH CHECK (public.is_platform_admin());

DROP POLICY IF EXISTS concept_guides_admin_update ON public.concept_guides;
CREATE POLICY concept_guides_admin_update ON public.concept_guides
  FOR UPDATE TO authenticated
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

DROP POLICY IF EXISTS taxonomy_events_admin_update ON public.taxonomy_events;
CREATE POLICY taxonomy_events_admin_update ON public.taxonomy_events
  FOR UPDATE TO authenticated
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

DROP POLICY IF EXISTS taxonomy_concepts_admin_update ON public.taxonomy_concepts;
CREATE POLICY taxonomy_concepts_admin_update ON public.taxonomy_concepts
  FOR UPDATE TO authenticated
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

DROP POLICY IF EXISTS questions_admin_insert ON public.questions;
CREATE POLICY questions_admin_insert ON public.questions
  FOR INSERT TO authenticated
  WITH CHECK (public.is_platform_admin());

-- Server-side aggregation avoids the client row limit as the bank grows.
CREATE OR REPLACE FUNCTION public.admin_question_coverage()
RETURNS TABLE (
  concept_id TEXT,
  live_count BIGINT,
  draft_count BIGINT,
  archived_count BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    q.concept_id,
    COUNT(*) FILTER (WHERE q.status = 'live') AS live_count,
    COUNT(*) FILTER (WHERE q.status = 'draft') AS draft_count,
    COUNT(*) FILTER (WHERE q.status = 'archived') AS archived_count
  FROM public.questions q
  WHERE public.is_platform_admin() AND q.concept_id IS NOT NULL
  GROUP BY q.concept_id;
$$;

GRANT EXECUTE ON FUNCTION public.admin_question_coverage() TO authenticated;

-- One master plus one editable event pack for every active studyable event.
INSERT INTO public.prompt_packs (
  id, scope_type, scope_id, name, system_body, few_shots, active
) VALUES (
  'master',
  'master',
  NULL,
  'Master MCQ Contract',
  '',
  '[]'::jsonb,
  TRUE
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.prompt_packs (
  id, scope_type, scope_id, name, system_body, few_shots, active
)
SELECT
  'event:' || e.id,
  'event',
  e.id,
  e.name || ' Style Pack',
  '',
  '[]'::jsonb,
  TRUE
FROM public.taxonomy_events e
WHERE e.active = TRUE AND e.studyable = TRUE
ON CONFLICT (id) DO NOTHING;
