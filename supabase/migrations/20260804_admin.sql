-- ============================================================================
-- scioly.app — Plan 21 admin review queue
-- PASTE-CHECK: SCIOLY-0804-ADMIN
-- Prerequisites: 20260803_initial (questions + platform_role)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.platform_role = 'admin'
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_platform_admin() TO authenticated;

-- Admins can edit / publish / archive questions (Plan 22 will also need INSERT)
GRANT UPDATE ON public.questions TO authenticated;

DROP POLICY IF EXISTS questions_admin_update ON public.questions;
CREATE POLICY questions_admin_update ON public.questions
  FOR UPDATE TO authenticated
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

-- Lock platform_role: users cannot self-promote to admin via client UPDATE
DROP POLICY IF EXISTS profiles_update_self ON public.profiles;
CREATE POLICY profiles_update_self ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid()
    AND platform_role = (SELECT p.platform_role FROM public.profiles p WHERE p.id = auth.uid())
  );

-- Sample drafts so the queue is non-empty before Plan 22 NIM generate
DELETE FROM public.questions WHERE citation = 'seed:plan21-draft';

INSERT INTO public.questions (
  season_ids, division, event_id, topic_id, concept_id,
  question_type, status, stem, options, correct_key, explanation, citation
) VALUES
  (
    '{2027}'::int[], 'C',
    $q$chem_lab$q$, $q$chem_lab_gas_variables_and_named_gas_laws$q$, $q$chem_lab_charles_law$q$,
    'mcq', 'draft',
    $q$DRAFT REVIEW: At constant pressure, if absolute temperature doubles, volume of an ideal gas…$q$,
    jsonb_build_object(
      'A', $q$halves$q$,
      'B', $q$doubles$q$,
      'C', $q$stays the same$q$,
      'D', $q$quadruples$q$
    ),
    $q$B$q$,
    $q$Charles's law: V/T constant at fixed n,P. Double T → double V.$q$,
    'seed:plan21-draft'
  ),
  (
    '{2027}'::int[], 'C',
    $q$anatomy$q$, $q$anatomy_gas_exchange_transport_and_blood_ph$q$, $q$anatomy_henderson_hasselbalch$q$,
    'mcq', 'draft',
    $q$DRAFT REVIEW: Normal arterial blood pH is closest to…$q$,
    jsonb_build_object(
      'A', $q$6.8$q$,
      'B', $q$7.0$q$,
      'C', $q$7.4$q$,
      'D', $q$8.0$q$
    ),
    $q$C$q$,
    $q$Arterial pH is tightly regulated near 7.40.$q$,
    'seed:plan21-draft'
  ),
  (
    '{2027}'::int[], 'C',
    $q$water_quality$q$, NULL, NULL,
    'mcq', 'draft',
    $q$DRAFT REVIEW: Which measurement is most directly related to water's ability to neutralize acid?$q$,
    jsonb_build_object(
      'A', $q$dissolved oxygen$q$,
      'B', $q$alkalinity$q$,
      'C', $q$turbidity$q$,
      'D', $q$conductivity only$q$
    ),
    $q$B$q$,
    $q$Alkalinity measures acid-neutralizing capacity (mainly bicarbonates).$q$,
    'seed:plan21-draft'
  );
