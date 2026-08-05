-- ============================================================================
-- scioly.app — 2026-08-03 INITIAL MIGRATION
-- PASTE-CHECK TOKEN: SCIOLY-0803C-NO-SEMI
-- If you do NOT see SCIOLY-0803C-NO-SEMI above, you pasted an OLD buffer.
-- Close old Untitled queries → New query → paste THIS file from disk.
-- Model: Event → Topic → Concept (NO subtopics)
-- Studyable: anatomy, chem_lab, water_quality
-- Seed text: no raw ';' + dollar-quoted strings (SQL editor safe)
-- ============================================================================
-- ============================================================================
-- ENUMS
-- ============================================================================
CREATE TYPE public.division_type AS ENUM ('B', 'C');
CREATE TYPE public.team_role AS ENUM ('coach', 'captain', 'officer', 'member');
CREATE TYPE public.question_status AS ENUM ('draft', 'live', 'archived');
CREATE TYPE public.question_type AS ENUM ('mcq', 'diagram', 'calc');

-- ============================================================================
-- TEAMS
-- ============================================================================
CREATE TABLE public.teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  school_name TEXT NOT NULL,
  division public.division_type NOT NULL DEFAULT 'C',
  join_code_student VARCHAR(6) UNIQUE NOT NULL,
  join_code_admin VARCHAR(6) UNIQUE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- PROFILES (lean)
-- ============================================================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  handle TEXT UNIQUE NOT NULL,
  division public.division_type NOT NULL DEFAULT 'C',
  platform_role TEXT NOT NULL DEFAULT 'user',
  avatar_id TEXT NOT NULL DEFAULT 'recruit_helmet',
  team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL,
  xp INT NOT NULL DEFAULT 0,
  rank_title TEXT NOT NULL DEFAULT 'Recruit Level 1',
  current_streak INT NOT NULL DEFAULT 0,
  questions_answered INT NOT NULL DEFAULT 0,
  visibility TEXT NOT NULL DEFAULT 'public',
  onboarding_complete BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT profiles_visibility_check CHECK (visibility IN ('public', 'private')),
  CONSTRAINT profiles_platform_role_check CHECK (platform_role IN ('user', 'admin'))
);

CREATE TABLE public.team_roster (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role public.team_role NOT NULL DEFAULT 'member',
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (team_id, user_id)
);

-- ============================================================================
-- TAXONOMY: Event → Topic → Concept
-- ============================================================================
CREATE TABLE public.taxonomy_events (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  division public.division_type NOT NULL DEFAULT 'C',
  domain TEXT NOT NULL DEFAULT '',
  test_component TEXT NOT NULL DEFAULT 'written',
  studyable BOOLEAN NOT NULL DEFAULT FALSE,
  season INT NOT NULL DEFAULT 2027,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  official_scope TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.taxonomy_topics (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES public.taxonomy_events(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0
);

CREATE TABLE public.taxonomy_concepts (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES public.taxonomy_events(id) ON DELETE CASCADE,
  topic_id TEXT NOT NULL REFERENCES public.taxonomy_topics(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  depth_tags TEXT[] NOT NULL DEFAULT '{}',
  sort_order INT NOT NULL DEFAULT 0
);

CREATE TABLE public.concept_guides (
  concept_id TEXT PRIMARY KEY REFERENCES public.taxonomy_concepts(id) ON DELETE CASCADE,
  read_body TEXT NOT NULL DEFAULT '',
  see_html TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT concept_guides_status_check CHECK (status IN ('draft', 'live'))
);

-- ============================================================================
-- QUESTIONS (lean, concept-tagged)
-- ============================================================================
CREATE TABLE public.questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season_ids INT[] NOT NULL DEFAULT '{2027}',
  division public.division_type NOT NULL DEFAULT 'C',
  event_id TEXT NOT NULL REFERENCES public.taxonomy_events(id) ON DELETE CASCADE,
  topic_id TEXT REFERENCES public.taxonomy_topics(id) ON DELETE SET NULL,
  concept_id TEXT REFERENCES public.taxonomy_concepts(id) ON DELETE SET NULL,
  question_type public.question_type NOT NULL DEFAULT 'mcq',
  status public.question_status NOT NULL DEFAULT 'draft',
  stem TEXT NOT NULL,
  media_url TEXT,
  options JSONB NOT NULL DEFAULT '{}'::jsonb,
  correct_key VARCHAR(1) NOT NULL,
  explanation TEXT NOT NULL DEFAULT '',
  citation TEXT NOT NULL DEFAULT '',
  times_served INT NOT NULL DEFAULT 0,
  global_accuracy FLOAT NOT NULL DEFAULT 0.0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.user_weakness_map (
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  concept_id TEXT NOT NULL REFERENCES public.taxonomy_concepts(id) ON DELETE CASCADE,
  total_attempts INT NOT NULL DEFAULT 0,
  correct_attempts INT NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, concept_id)
);

CREATE TABLE public.user_history (
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  answered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_correct BOOLEAN NOT NULL,
  PRIMARY KEY (user_id, question_id, answered_at)
);

CREATE TABLE public.reinjection_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  unlock_at TIMESTAMPTZ NOT NULL,
  resolved BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- TEAM PORTAL (CMD)
-- ============================================================================
CREATE TABLE public.team_missions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  target_event_id TEXT REFERENCES public.taxonomy_events(id),
  goal_type TEXT NOT NULL,
  target_value INT NOT NULL,
  deadline TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.user_mission_progress (
  mission_id UUID NOT NULL REFERENCES public.team_missions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  current_value INT NOT NULL DEFAULT 0,
  completed BOOLEAN NOT NULL DEFAULT FALSE,
  PRIMARY KEY (mission_id, user_id)
);

CREATE TABLE public.team_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.team_vault_resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  event_id TEXT REFERENCES public.taxonomy_events(id),
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  category TEXT NOT NULL,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.binder_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id TEXT NOT NULL REFERENCES public.taxonomy_events(id) ON DELETE CASCADE,
  topic_id TEXT REFERENCES public.taxonomy_topics(id) ON DELETE SET NULL,
  type TEXT NOT NULL,
  name TEXT NOT NULL,
  payload_html TEXT NOT NULL,
  preview_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- INDEXES
-- ============================================================================
CREATE INDEX idx_profiles_team ON public.profiles(team_id);
CREATE INDEX idx_profiles_handle_lower ON public.profiles(lower(handle));
CREATE INDEX idx_topics_event ON public.taxonomy_topics(event_id);
CREATE INDEX idx_concepts_topic ON public.taxonomy_concepts(topic_id);
CREATE INDEX idx_concepts_event ON public.taxonomy_concepts(event_id);
CREATE INDEX idx_questions_event_status ON public.questions(event_id, status);
CREATE INDEX idx_questions_concept ON public.questions(concept_id) WHERE concept_id IS NOT NULL;
CREATE INDEX idx_team_roster_user ON public.team_roster(user_id);
CREATE INDEX idx_reinjection_open ON public.reinjection_queue(user_id, unlock_at) WHERE resolved = FALSE;
CREATE INDEX idx_events_studyable ON public.taxonomy_events(studyable, division, season);

-- Topic-level rollup for UI (fallback diagnosis)
CREATE OR REPLACE VIEW public.user_topic_weakness AS
SELECT
  w.user_id,
  c.topic_id,
  c.event_id,
  SUM(w.total_attempts) AS total_attempts,
  SUM(w.correct_attempts) AS correct_attempts,
  CASE WHEN SUM(w.total_attempts) = 0 THEN NULL
       ELSE SUM(w.correct_attempts)::float / SUM(w.total_attempts)
  END AS accuracy
FROM public.user_weakness_map w
JOIN public.taxonomy_concepts c ON c.id = w.concept_id
GROUP BY w.user_id, c.topic_id, c.event_id;

-- ============================================================================
-- AUTH BOOTSTRAP + RPCs
-- ============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  temp_handle TEXT;
BEGIN
  temp_handle := 'recruit_' || substr(replace(NEW.id::text, '-', ''), 1, 10);
  INSERT INTO public.profiles (id, handle, onboarding_complete)
  VALUES (NEW.id, temp_handle, FALSE);
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.generate_join_code()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  alphabet TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result TEXT := '';
  i INT;
BEGIN
  FOR i IN 1..6 LOOP
    result := result || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
  END LOOP;
  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.is_team_member(p_team_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.team_roster
    WHERE team_id = p_team_id AND user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.team_role_at_least(p_team_id UUID, p_min public.team_role)
RETURNS BOOLEAN
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  r public.team_role;
  rank_map INT;
  need INT;
BEGIN
  SELECT role INTO r FROM public.team_roster
  WHERE team_id = p_team_id AND user_id = auth.uid();
  IF r IS NULL THEN RETURN FALSE; END IF;
  rank_map := CASE r WHEN 'member' THEN 1 WHEN 'officer' THEN 2 WHEN 'captain' THEN 3 WHEN 'coach' THEN 4 END;
  need := CASE p_min WHEN 'member' THEN 1 WHEN 'officer' THEN 2 WHEN 'captain' THEN 3 WHEN 'coach' THEN 4 END;
  RETURN rank_map >= need;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_team(
  p_name TEXT,
  p_school_name TEXT,
  p_division public.division_type DEFAULT 'C'
)
RETURNS public.teams
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  new_team public.teams;
  code_s TEXT;
  code_a TEXT;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  LOOP
    code_s := public.generate_join_code();
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.teams WHERE join_code_student = code_s OR join_code_admin = code_s);
  END LOOP;
  LOOP
    code_a := public.generate_join_code();
    EXIT WHEN code_a <> code_s
      AND NOT EXISTS (SELECT 1 FROM public.teams WHERE join_code_student = code_a OR join_code_admin = code_a);
  END LOOP;
  INSERT INTO public.teams (name, school_name, division, join_code_student, join_code_admin)
  VALUES (p_name, p_school_name, p_division, code_s, code_a)
  RETURNING * INTO new_team;
  INSERT INTO public.team_roster (team_id, user_id, role) VALUES (new_team.id, auth.uid(), 'coach');
  UPDATE public.profiles SET team_id = new_team.id, division = p_division WHERE id = auth.uid();
  RETURN new_team;
END;
$$;

CREATE OR REPLACE FUNCTION public.join_team_by_code(p_code TEXT)
RETURNS public.teams
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  t public.teams;
  assigned_role public.team_role;
  normalized TEXT;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  normalized := upper(trim(p_code));
  IF length(normalized) <> 6 THEN RAISE EXCEPTION 'Invalid join code'; END IF;
  SELECT * INTO t FROM public.teams
  WHERE join_code_student = normalized OR join_code_admin = normalized;
  IF t.id IS NULL THEN RAISE EXCEPTION 'Join code not found'; END IF;
  IF normalized = t.join_code_admin THEN assigned_role := 'coach'; ELSE assigned_role := 'member'; END IF;
  INSERT INTO public.team_roster (team_id, user_id, role)
  VALUES (t.id, auth.uid(), assigned_role)
  ON CONFLICT (team_id, user_id) DO UPDATE SET role = EXCLUDED.role;
  UPDATE public.profiles SET team_id = t.id, division = t.division WHERE id = auth.uid();
  RETURN t;
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_onboarding(
  p_handle TEXT,
  p_division public.division_type,
  p_join_code TEXT DEFAULT NULL
)
RETURNS public.profiles
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  cleaned TEXT;
  prof public.profiles;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  cleaned := lower(regexp_replace(trim(p_handle), '^@', ''));
  IF cleaned !~ '^[a-z0-9_]{3,24}$' THEN
    RAISE EXCEPTION 'Handle must be 3-24 chars: a-z, 0-9, underscore';
  END IF;
  IF EXISTS (SELECT 1 FROM public.profiles WHERE lower(handle) = cleaned AND id <> auth.uid()) THEN
    RAISE EXCEPTION 'Handle already taken';
  END IF;
  UPDATE public.profiles
  SET handle = cleaned, division = p_division, onboarding_complete = TRUE
  WHERE id = auth.uid();
  IF p_join_code IS NOT NULL AND length(trim(p_join_code)) > 0 THEN
    PERFORM public.join_team_by_code(p_join_code);
  END IF;
  SELECT * INTO prof FROM public.profiles WHERE id = auth.uid();
  RETURN prof;
END;
$$;

CREATE OR REPLACE FUNCTION public.is_handle_available(p_handle TEXT)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE lower(handle) = lower(regexp_replace(trim(p_handle), '^@', ''))
      AND id <> coalesce(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid)
  );
$$;

-- ============================================================================
-- GRANTS
-- ============================================================================
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT ON public.teams TO authenticated;
GRANT SELECT ON public.team_roster TO authenticated;
GRANT SELECT ON public.taxonomy_events TO authenticated;
GRANT SELECT ON public.taxonomy_topics TO authenticated;
GRANT SELECT ON public.taxonomy_concepts TO authenticated;
GRANT SELECT ON public.concept_guides TO authenticated;
GRANT SELECT ON public.questions TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.user_weakness_map TO authenticated;
GRANT SELECT, INSERT ON public.user_history TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.reinjection_queue TO authenticated;
GRANT SELECT ON public.team_missions TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.user_mission_progress TO authenticated;
GRANT SELECT, INSERT ON public.team_posts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.team_vault_resources TO authenticated;
GRANT SELECT ON public.binder_assets TO authenticated;
GRANT SELECT ON public.user_topic_weakness TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_team(TEXT, TEXT, public.division_type) TO authenticated;
GRANT EXECUTE ON FUNCTION public.join_team_by_code(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_onboarding(TEXT, public.division_type, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_handle_available(TEXT) TO authenticated, anon;

-- ============================================================================
-- RLS
-- ============================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_roster ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.taxonomy_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.taxonomy_topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.taxonomy_concepts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.concept_guides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_weakness_map ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reinjection_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_missions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_mission_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_vault_resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.binder_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY profiles_select ON public.profiles FOR SELECT TO authenticated
  USING (visibility = 'public' OR id = auth.uid() OR (team_id IS NOT NULL AND public.is_team_member(team_id)));
CREATE POLICY profiles_update_self ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY teams_select_members ON public.teams FOR SELECT TO authenticated
  USING (public.is_team_member(id));
CREATE POLICY roster_select_members ON public.team_roster FOR SELECT TO authenticated
  USING (public.is_team_member(team_id));
CREATE POLICY taxonomy_events_read ON public.taxonomy_events FOR SELECT TO authenticated USING (true);
CREATE POLICY taxonomy_topics_read ON public.taxonomy_topics FOR SELECT TO authenticated USING (true);
CREATE POLICY taxonomy_concepts_read ON public.taxonomy_concepts FOR SELECT TO authenticated USING (true);
CREATE POLICY concept_guides_read_live ON public.concept_guides FOR SELECT TO authenticated
  USING (
    status = 'live'
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.platform_role = 'admin')
  );
CREATE POLICY questions_read_live ON public.questions FOR SELECT TO authenticated
  USING (
    status = 'live'
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.platform_role = 'admin')
  );
CREATE POLICY weakness_own ON public.user_weakness_map FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY history_own_select ON public.user_history FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY history_own_insert ON public.user_history FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY reinjection_own ON public.reinjection_queue FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY missions_team_read ON public.team_missions FOR SELECT TO authenticated
  USING (public.is_team_member(team_id));
CREATE POLICY mission_progress_own_or_team ON public.user_mission_progress FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.team_missions m WHERE m.id = mission_id AND public.is_team_member(m.team_id))
  );
CREATE POLICY mission_progress_own_write ON public.user_mission_progress FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY posts_team_read ON public.team_posts FOR SELECT TO authenticated
  USING (public.is_team_member(team_id));
CREATE POLICY posts_team_insert ON public.team_posts FOR INSERT TO authenticated
  WITH CHECK (author_id = auth.uid() AND public.team_role_at_least(team_id, 'officer'));
CREATE POLICY vault_team_read ON public.team_vault_resources FOR SELECT TO authenticated
  USING (public.is_team_member(team_id));
CREATE POLICY vault_team_write ON public.team_vault_resources FOR ALL TO authenticated
  USING (public.team_role_at_least(team_id, 'officer'))
  WITH CHECK (public.team_role_at_least(team_id, 'officer'));
CREATE POLICY binder_read ON public.binder_assets FOR SELECT TO authenticated USING (true);

-- ============================================================================
-- SEED (PASTE-CHECK: SCIOLY-0803C-NO-SEMI)
-- Each concept is its own INSERT so a stray ';' cannot corrupt the batch.
-- ============================================================================
INSERT INTO public.taxonomy_events (id, name, division, domain, test_component, studyable, season, active, official_scope) VALUES
  ($c$chem_lab$c$, $c$Chemistry Lab$c$, 'C', $c$Physical Science & Chemistry$c$, 'lab_written', TRUE, 2027, TRUE, $c$Gas Laws & Kinetics$c$),
  ($c$anatomy$c$, $c$Anatomy and Physiology$c$, 'C', $c$Life, Personal & Social Science$c$, 'written_station', TRUE, 2027, TRUE, $c$Digestive, Immune, and Respiratory Systems$c$),
  ($c$water_quality$c$, $c$Water Quality$c$, 'C', $c$Life, Personal & Social Science$c$, 'lab_written', TRUE, 2027, TRUE, $c$Marine and Estuarine Ecosystems$c$),
  ($c$astronomy$c$, $c$Astronomy$c$, 'C', $c$Earth and Space Science$c$, 'written', FALSE, 2027, TRUE, NULL),
  ($c$botany$c$, $c$Botany$c$, 'C', $c$Life, Personal & Social Science$c$, 'written_station', FALSE, 2027, TRUE, NULL),
  ($c$circuit_lab$c$, $c$Circuit Lab$c$, 'C', $c$Physical Science & Chemistry$c$, 'lab_written', FALSE, 2027, TRUE, NULL),
  ($c$codebusters$c$, $c$Codebusters$c$, 'C', $c$Inquiry & Nature of Science$c$, 'written', FALSE, 2027, TRUE, NULL),
  ($c$designer_genes$c$, $c$Designer Genes$c$, 'C', $c$Life, Personal & Social Science$c$, 'written', FALSE, 2027, TRUE, NULL),
  ($c$disease_detectives$c$, $c$Disease Detectives$c$, 'C', $c$Life, Personal & Social Science$c$, 'written', FALSE, 2027, TRUE, NULL),
  ($c$dynamic_planet$c$, $c$Dynamic Planet$c$, 'C', $c$Earth and Space Science$c$, 'written_station', FALSE, 2027, TRUE, NULL),
  ($c$engineering_cad$c$, $c$Engineering CAD$c$, 'C', $c$Inquiry & Nature of Science$c$, 'hybrid', FALSE, 2027, TRUE, NULL),
  ($c$experimental_design$c$, $c$Experimental Design$c$, 'C', $c$Inquiry & Nature of Science$c$, 'lab_written', FALSE, 2027, TRUE, NULL),
  ($c$forensics$c$, $c$Forensics$c$, 'C', $c$Physical Science & Chemistry$c$, 'lab_written', FALSE, 2027, TRUE, NULL),
  ($c$hovercraft$c$, $c$Hovercraft$c$, 'C', $c$Physical Science & Chemistry$c$, 'build_written', FALSE, 2027, TRUE, NULL),
  ($c$protein_modeling$c$, $c$Protein Modeling$c$, 'C', $c$Physical Science & Chemistry$c$, 'hybrid', FALSE, 2027, TRUE, NULL),
  ($c$remote_sensing$c$, $c$Remote Sensing$c$, 'C', $c$Earth and Space Science$c$, 'written_station', FALSE, 2027, TRUE, NULL),
  ($c$rocks_minerals$c$, $c$Rocks and Minerals$c$, 'C', $c$Earth and Space Science$c$, 'station', FALSE, 2027, TRUE, NULL),
  ($c$thermodynamics$c$, $c$Thermodynamics$c$, 'C', $c$Physical Science & Chemistry$c$, 'build_written', FALSE, 2027, TRUE, NULL),
  ($c$boomilever$c$, $c$Boomilever$c$, 'C', $c$Technology & Engineering$c$, 'build_only', FALSE, 2027, TRUE, NULL),
  ($c$electric_vehicle$c$, $c$Electric Vehicle$c$, 'C', $c$Technology & Engineering$c$, 'build_only', FALSE, 2027, TRUE, NULL),
  ($c$mission_possible$c$, $c$Mission Possible$c$, 'C', $c$Technology & Engineering$c$, 'build_only', FALSE, 2027, TRUE, NULL),
  ($c$ping_pong_parachute$c$, $c$Ping-Pong Parachute$c$, 'C', $c$Inquiry & Nature of Science$c$, 'build_only', FALSE, 2027, TRUE, NULL),
  ($c$wright_stuff$c$, $c$Wright Stuff$c$, 'C', $c$Technology & Engineering$c$, 'build_only', FALSE, 2027, TRUE, NULL);

INSERT INTO public.taxonomy_topics (id, event_id, name, sort_order) VALUES
  ($c$chem_lab_gas_variables_and_named_gas_laws$c$, $c$chem_lab$c$, $c$Gas variables and named gas laws$c$, 1),
  ($c$chem_lab_ideal_gas_law_stoichiometry_and_gas_calculations$c$, $c$chem_lab$c$, $c$Ideal gas law, stoichiometry, and gas calculations$c$, 2),
  ($c$chem_lab_kinetic_molecular_theory_and_particle_behavior$c$, $c$chem_lab$c$, $c$Kinetic molecular theory and particle behavior$c$, 3),
  ($c$chem_lab_reaction_rates_and_rate_laws$c$, $c$chem_lab$c$, $c$Reaction rates and rate laws$c$, 4),
  ($c$chem_lab_factors_affecting_reaction_rates$c$, $c$chem_lab$c$, $c$Factors affecting reaction rates$c$, 5),
  ($c$chem_lab_lab_methods_graphs_and_experimental_analysis$c$, $c$chem_lab$c$, $c$Lab methods, graphs, and experimental analysis$c$, 6),
  ($c$anatomy_respiratory_anatomy_and_mechanics$c$, $c$anatomy$c$, $c$Respiratory anatomy and mechanics$c$, 1),
  ($c$anatomy_gas_exchange_transport_and_blood_ph$c$, $c$anatomy$c$, $c$Gas exchange, transport, and blood pH$c$, 2),
  ($c$anatomy_digestive_anatomy_and_mechanical_chemical_digestion$c$, $c$anatomy$c$, $c$Digestive anatomy and mechanical/chemical digestion$c$, 3),
  ($c$anatomy_absorption_nutrition_and_metabolic_handling_of_nutrients$c$, $c$anatomy$c$, $c$Absorption, nutrition, and metabolic handling of nutrients$c$, 4),
  ($c$anatomy_immune_system_structure_and_innate_adaptive_roles$c$, $c$anatomy$c$, $c$Immune system structure and innate/adaptive roles$c$, 5),
  ($c$anatomy_immune_response_disorders_and_disease_applications$c$, $c$anatomy$c$, $c$Immune response, disorders, and disease applications$c$, 6),
  ($c$water_quality_marine_and_estuarine_habitats_and_zonation$c$, $c$water_quality$c$, $c$Marine and estuarine habitats and zonation$c$, 1),
  ($c$water_quality_physical_and_chemical_properties_of_seawater$c$, $c$water_quality$c$, $c$Physical and chemical properties of seawater$c$, 2),
  ($c$water_quality_marine_and_estuarine_organisms_and_adaptations$c$, $c$water_quality$c$, $c$Marine and estuarine organisms and adaptations$c$, 3),
  ($c$water_quality_food_webs_productivity_and_nutrient_cycling$c$, $c$water_quality$c$, $c$Food webs, productivity, and nutrient cycling$c$, 4),
  ($c$water_quality_water_monitoring_indicators_and_lab_analysis$c$, $c$water_quality$c$, $c$Water monitoring, indicators, and lab analysis$c$, 5),
  ($c$water_quality_human_impacts_pollution_and_restoration$c$, $c$water_quality$c$, $c$Human impacts, pollution, and restoration$c$, 6);

INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$chem_lab_pressure_measurement_and_units$c$, $c$chem_lab$c$, $c$chem_lab_gas_variables_and_named_gas_laws$c$, $c$Pressure measurement and units$c$, $c$Convert between common pressure units (atm, mmHg, torr, Pa, bar) and interpret open-end/closed-end manometer and barometer readings.$c$, ARRAY[$t$pressure units$t$, $t$manometer$t$, $t$barometer$t$, $t$mmHg$t$, $t$atm$t$, $t$Pa$t$]::text[], 0);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$chem_lab_temperature_scales_and_absolute_zero$c$, $c$chem_lab$c$, $c$chem_lab_gas_variables_and_named_gas_laws$c$, $c$Temperature scales and absolute zero$c$, $c$Convert between Celsius and Kelvin (K = degC + 273.15) and explain why gas law calculations require absolute temperature.$c$, ARRAY[$t$Kelvin$t$, $t$Celsius$t$, $t$absolute zero$t$, $t$temperature conversion$t$, $t$K = degC + 273.15$t$]::text[], 1);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$chem_lab_boyles_law$c$, $c$chem_lab$c$, $c$chem_lab_gas_variables_and_named_gas_laws$c$, $c$Boyle's Law (P-V inverse relationship)$c$, $c$Apply P1V1 = P2V2 at constant temperature and amount, explain the inverse relationship using particle collision frequency.$c$, ARRAY[$t$P1V1=P2V2$t$, $t$inverse relationship$t$, $t$constant n,T$t$, $t$pressure$t$, $t$volume$t$]::text[], 2);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$chem_lab_charles_law$c$, $c$chem_lab$c$, $c$chem_lab_gas_variables_and_named_gas_laws$c$, $c$Charles's Law (V-T direct relationship)$c$, $c$Use V1/T1 = V2/T2 with absolute temperatures for a fixed amount of gas at constant pressure, explain the direct relationship.$c$, ARRAY[$t$V1/T1=V2/T2$t$, $t$direct relationship$t$, $t$constant n,P$t$, $t$temperature$t$, $t$volume$t$]::text[], 3);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$chem_lab_gay_lussacs_law$c$, $c$chem_lab$c$, $c$chem_lab_gas_variables_and_named_gas_laws$c$, $c$Gay-Lussac's Law (P-T direct relationship)$c$, $c$Apply P1/T1 = P2/T2 at constant volume and amount, relate the direct P-T relationship to increased particle kinetic energy.$c$, ARRAY[$t$P1/T1=P2/T2$t$, $t$direct relationship$t$, $t$constant n,V$t$, $t$pressure$t$, $t$temperature$t$]::text[], 4);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$chem_lab_avogadros_law$c$, $c$chem_lab$c$, $c$chem_lab_gas_variables_and_named_gas_laws$c$, $c$Avogadro's Law (V proportional to n)$c$, $c$Recognize that equal volumes of gases at the same temperature and pressure contain equal numbers of moles, use V1/n1 = V2/n2.$c$, ARRAY[$t$V proportional to n$t$, $t$equal volumes equal moles$t$, $t$Avogadro's hypothesis$t$, $t$moles$t$, $t$constant T,P$t$]::text[], 5);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$chem_lab_combined_gas_law$c$, $c$chem_lab$c$, $c$chem_lab_gas_variables_and_named_gas_laws$c$, $c$Combined Gas Law$c$, $c$Combine Boyle's, Charles's, and Gay-Lussac's laws into P1V1/T1 = P2V2/T2 for a fixed amount of gas undergoing multiple variable changes.$c$, ARRAY[$t$combined gas law$t$, $t$P1V1/T1=P2V2/T2$t$, $t$constant n$t$, $t$multi-variable changes$t$]::text[], 6);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$chem_lab_daltons_law_of_partial_pressures$c$, $c$chem_lab$c$, $c$chem_lab_gas_variables_and_named_gas_laws$c$, $c$Dalton's Law of Partial Pressures$c$, $c$Calculate total pressure of a gas mixture as the sum of partial pressures, relate partial pressure to mole fraction (Pi = Xi P_total).$c$, ARRAY[$t$partial pressure$t$, $t$mole fraction$t$, $t$P_total = ?P_i$t$, $t$gas mixtures$t$, $t$Dalton's law$t$]::text[], 7);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$chem_lab_grahams_law_of_effusion$c$, $c$chem_lab$c$, $c$chem_lab_gas_variables_and_named_gas_laws$c$, $c$Graham's Law of Effusion$c$, $c$Apply rate1/rate2 = sqrt(M2/M1) to compare effusion/diffusion rates, relate effusion rate to root-mean-square speed.$c$, ARRAY[$t$effusion$t$, $t$rate proportional to 1/sqrtM$t$, $t$molar mass$t$, $t$diffusion$t$, $t$Graham's law$t$]::text[], 8);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$chem_lab_standard_temperature_and_pressure_stp$c$, $c$chem_lab$c$, $c$chem_lab_gas_variables_and_named_gas_laws$c$, $c$Standard temperature and pressure (STP)$c$, $c$Define STP as 0 degC (273.15 K) and 1 atm, and recall that one mole of an ideal gas occupies 22.4 L at STP.$c$, ARRAY[$t$STP$t$, $t$standard molar volume$t$, $t$22.4 L/mol$t$, $t$273.15 K$t$, $t$1 atm$t$]::text[], 9);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$chem_lab_ideal_gas_law_equation$c$, $c$chem_lab$c$, $c$chem_lab_ideal_gas_law_stoichiometry_and_gas_calculations$c$, $c$Ideal gas law equation PV=nRT$c$, $c$Use PV = nRT to relate pressure, volume, moles, and temperature of an ideal gas, identify the conditions where the ideal gas law is applicable.$c$, ARRAY[$t$PV=nRT$t$, $t$ideal gas$t$, $t$n$t$, $t$R$t$, $t$state equation$t$]::text[], 0);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$chem_lab_universal_gas_constant_R$c$, $c$chem_lab$c$, $c$chem_lab_ideal_gas_law_stoichiometry_and_gas_calculations$c$, $c$Universal gas constant R values$c$, $c$Select the appropriate R value (0.08206 L?atm/mol?K, 8.314 J/mol?K, 62.36 L?torr/mol?K) based on the pressure and volume units in a calculation.$c$, ARRAY[$t$R value$t$, $t$0.08206$t$, $t$8.314$t$, $t$62.36$t$, $t$unit conversion$t$]::text[], 1);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$chem_lab_standard_molar_volume$c$, $c$chem_lab$c$, $c$chem_lab_ideal_gas_law_stoichiometry_and_gas_calculations$c$, $c$Standard molar volume (22.4 L/mol)$c$, $c$Derive the molar volume of an ideal gas at STP (22.4 L/mol) from PV=nRT and apply it in stoichiometric gas volume calculations.$c$, ARRAY[$t$22.4 L/mol$t$, $t$standard molar volume$t$, $t$STP$t$, $t$PV=nRT$t$, $t$molar volume$t$]::text[], 2);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$chem_lab_volume_volume_gas_stoichiometry$c$, $c$chem_lab$c$, $c$chem_lab_ideal_gas_law_stoichiometry_and_gas_calculations$c$, $c$Volume-volume gas stoichiometry$c$, $c$Use Avogadro's law and balanced equations to relate volumes of gaseous reactants and products at constant temperature and pressure.$c$, ARRAY[$t$volume ratios$t$, $t$Avogadro's law$t$, $t$stoichiometry$t$, $t$same T,P$t$, $t$gas reactions$t$]::text[], 3);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$chem_lab_mass_volume_gas_stoichiometry$c$, $c$chem_lab$c$, $c$chem_lab_ideal_gas_law_stoichiometry_and_gas_calculations$c$, $c$Mass-volume gas stoichiometry$c$, $c$Convert between mass of a substance and volume of a gas using molar mass and the ideal gas law at non?STP conditions.$c$, ARRAY[$t$mass to volume$t$, $t$PV=nRT$t$, $t$molar mass$t$, $t$stoichiometry$t$, $t$non?STP$t$]::text[], 4);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$chem_lab_gas_density_from_ideal_gas_law$c$, $c$chem_lab$c$, $c$chem_lab_ideal_gas_law_stoichiometry_and_gas_calculations$c$, $c$Gas density from ideal gas law$c$, $c$Derive and apply d = PM/RT to calculate gas density at given P and T, or to determine molar mass from density.$c$, ARRAY[$t$d=PM/RT$t$, $t$density$t$, $t$molar mass$t$, $t$gas density$t$, $t$ideal gas law derivation$t$]::text[], 5);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$chem_lab_determining_molar_mass_of_a_gas$c$, $c$chem_lab$c$, $c$chem_lab_ideal_gas_law_stoichiometry_and_gas_calculations$c$, $c$Determining molar mass of a gas$c$, $c$Calculate the molar mass of an unknown gas from experimental mass, volume, temperature, and pressure using M = mRT/(PV).$c$, ARRAY[$t$M = mRT/PV$t$, $t$molar mass determination$t$, $t$gas sample$t$, $t$ideal gas law$t$, $t$experimental data$t$]::text[], 6);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$chem_lab_gas_collection_over_water$c$, $c$chem_lab$c$, $c$chem_lab_ideal_gas_law_stoichiometry_and_gas_calculations$c$, $c$Gas collection over water correction$c$, $c$Correct for water vapor pressure when collecting a gas over water: P_dry gas = P_total - P_H2O, then use the dry gas pressure in ideal gas calculations.$c$, ARRAY[$t$water displacement$t$, $t$vapor pressure$t$, $t$Dalton's law$t$, $t$P_dry$t$, $t$eudiometer$t$]::text[], 7);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$chem_lab_partial_pressure_and_mole_fraction$c$, $c$chem_lab$c$, $c$chem_lab_ideal_gas_law_stoichiometry_and_gas_calculations$c$, $c$Partial pressure and mole fraction calculations$c$, $c$Calculate partial pressure from mole fraction and total pressure (Pi = Xi P_total), or find mole fraction from partial pressure data.$c$, ARRAY[$t$P_i = X_i P_total$t$, $t$mole fraction$t$, $t$partial pressure$t$, $t$gas mixtures$t$, $t$Dalton's law application$t$]::text[], 8);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$chem_lab_km_postulates$c$, $c$chem_lab$c$, $c$chem_lab_kinetic_molecular_theory_and_particle_behavior$c$, $c$Postulates of kinetic molecular theory$c$, $c$List and explain the five main KMT postulates: particles in constant random motion, negligible volume, elastic collisions, no intermolecular forces, and average KE proportional to temperature.$c$, ARRAY[$t$KMT postulates$t$, $t$elastic collisions$t$, $t$negligible volume$t$, $t$no IMFs$t$, $t$KE proportional to T$t$]::text[], 0);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$chem_lab_temperature_and_average_kinetic_energy$c$, $c$chem_lab$c$, $c$chem_lab_kinetic_molecular_theory_and_particle_behavior$c$, $c$Temperature and average kinetic energy$c$, $c$Relate absolute temperature to average translational kinetic energy: KE_avg = (3/2)RT per mole and KE_avg = (3/2)k_B T per molecule.$c$, ARRAY[$t$KE = 3/2 RT$t$, $t$Boltzmann constant$t$, $t$temperature$t$, $t$kinetic energy$t$, $t$molecular speed$t$]::text[], 1);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$chem_lab_root_mean_square_speed$c$, $c$chem_lab$c$, $c$chem_lab_kinetic_molecular_theory_and_particle_behavior$c$, $c$Root-mean-square speed (u_rms)$c$, $c$Calculate u_rms = sqrt(3RT/M) using molar mass in kg/mol, explain why heavier molecules move slower at the same temperature.$c$, ARRAY[$t$u_rms$t$, $t$3RT/M$t$, $t$molar mass in kg$t$, $t$molecular speed$t$, $t$kinetic energy$t$]::text[], 2);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$chem_lab_maxwell_boltzmann_distribution$c$, $c$chem_lab$c$, $c$chem_lab_kinetic_molecular_theory_and_particle_behavior$c$, $c$Maxwell-Boltzmann speed distribution$c$, $c$Sketch and interpret the distribution of molecular speeds, predict how temperature and molar mass shift the peak height and distribution width.$c$, ARRAY[$t$Maxwell-Boltzmann$t$, $t$speed distribution$t$, $t$peak shift$t$, $t$temperature effect$t$, $t$molar mass effect$t$]::text[], 3);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$chem_lab_km_explanation_boyles_law$c$, $c$chem_lab$c$, $c$chem_lab_kinetic_molecular_theory_and_particle_behavior$c$, $c$Kinetic explanation of Boyle's Law$c$, $c$Use KMT to explain why pressure increases when volume decreases: more frequent wall collisions per unit area at constant temperature.$c$, ARRAY[$t$collision frequency$t$, $t$inverse P-V$t$, $t$KMT explanation$t$, $t$constant T$t$, $t$particle collisions$t$]::text[], 4);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$chem_lab_km_explanation_charles_law$c$, $c$chem_lab$c$, $c$chem_lab_kinetic_molecular_theory_and_particle_behavior$c$, $c$Kinetic explanation of Charles's Law$c$, $c$Explain with KMT why volume increases with temperature at constant pressure: faster particles strike walls harder, expanding the container until pressure equalizes.$c$, ARRAY[$t$particle speed$t$, $t$wall collisions$t$, $t$thermal expansion$t$, $t$constant P$t$, $t$KMT$t$]::text[], 5);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$chem_lab_km_explanation_daltons_law$c$, $c$chem_lab$c$, $c$chem_lab_kinetic_molecular_theory_and_particle_behavior$c$, $c$Kinetic explanation of Dalton's Law$c$, $c$Explain why each gas in a mixture behaves independently and contributes to total pressure proportionally to its mole fraction, according to KMT.$c$, ARRAY[$t$independent behavior$t$, $t$partial pressure$t$, $t$KMT$t$, $t$gas mixtures$t$, $t$collision independence$t$]::text[], 6);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$chem_lab_effusion_and_grahams_law_derivation$c$, $c$chem_lab$c$, $c$chem_lab_kinetic_molecular_theory_and_particle_behavior$c$, $c$Effusion and Graham's Law derivation$c$, $c$Derive Graham's law from u_rms: effusion rate proportional to average speed proportional to 1/sqrtM, and use rate1/rate2 = sqrt(M2/M1).$c$, ARRAY[$t$effusion$t$, $t$Graham's law$t$, $t$u_rms$t$, $t$molar mass$t$, $t$rate derivation$t$]::text[], 7);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$chem_lab_real_gases_compressibility_factor$c$, $c$chem_lab$c$, $c$chem_lab_kinetic_molecular_theory_and_particle_behavior$c$, $c$Real gases and compressibility factor Z$c$, $c$Use the compressibility factor Z = PV/nRT to quantify deviations from ideality, Z < 1 indicates dominant attractive forces, Z > 1 indicates dominant repulsive forces.$c$, ARRAY[$t$compressibility factor$t$, $t$Z=PV/nRT$t$, $t$non-ideal behavior$t$, $t$attractive forces$t$, $t$repulsive forces$t$]::text[], 8);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$chem_lab_van_der_waals_equation$c$, $c$chem_lab$c$, $c$chem_lab_kinetic_molecular_theory_and_particle_behavior$c$, $c$Van der Waals equation$c$, $c$Apply the van der Waals equation (P + a n2/V2)(V - nb) = nRT, interpret a and b as corrections for intermolecular attraction and finite particle volume.$c$, ARRAY[$t$van der Waals$t$, $t$a constant$t$, $t$b constant$t$, $t$excluded volume$t$, $t$intermolecular forces$t$]::text[], 9);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$chem_lab_conditions_for_ideal_gas_behavior$c$, $c$chem_lab$c$, $c$chem_lab_kinetic_molecular_theory_and_particle_behavior$c$, $c$Conditions for ideal gas behavior$c$, $c$Identify that real gases approach ideality at low pressure (large intermolecular distances) and high temperature (high kinetic energy overcomes attractions).$c$, ARRAY[$t$low P$t$, $t$high T$t$, $t$ideal behavior$t$, $t$real gases$t$, $t$KMT limits$t$]::text[], 10);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$chem_lab_reaction_rate_definition$c$, $c$chem_lab$c$, $c$chem_lab_reaction_rates_and_rate_laws$c$, $c$Reaction rate definition$c$, $c$Express average and instantaneous reaction rates using concentration changes over time, e.g., rate = -Delta[A]/Deltat, accounting for stoichiometric coefficients.$c$, ARRAY[$t$rate definition$t$, $t$-Delta[A]/Deltat$t$, $t$M/s$t$, $t$stoichiometric coefficients$t$, $t$instantaneous rate$t$]::text[], 0);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$chem_lab_rate_law_and_reaction_order$c$, $c$chem_lab$c$, $c$chem_lab_reaction_rates_and_rate_laws$c$, $c$Rate law and reaction order$c$, $c$Write the differential rate law rate = k[A]^m[B]^n, and determine the order with respect to each reactant and the overall order.$c$, ARRAY[$t$rate law$t$, $t$order$t$, $t$m$t$, $t$n$t$, $t$k$t$]::text[], 1);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$chem_lab_method_of_initial_rates$c$, $c$chem_lab$c$, $c$chem_lab_reaction_rates_and_rate_laws$c$, $c$Method of initial rates$c$, $c$Determine rate law exponents by comparing initial rates from experiments where one reactant concentration changes while others are held constant.$c$, ARRAY[$t$initial rates$t$, $t$comparison method$t$, $t$exponents$t$, $t$rate law determination$t$, $t$experimental data$t$]::text[], 2);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$chem_lab_rate_constant_units$c$, $c$chem_lab$c$, $c$chem_lab_reaction_rates_and_rate_laws$c$, $c$Rate constant units by overall order$c$, $c$Deduce units of the rate constant k: zero-order (M?s?1), first-order (s?1), second-order (M?1?s?1), etc., from the overall reaction order.$c$, ARRAY[$t$rate constant units$t$, $t$zero order$t$, $t$first order$t$, $t$second order$t$, $t$k units$t$]::text[], 3);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$chem_lab_zero_order_integrated_rate_law$c$, $c$chem_lab$c$, $c$chem_lab_reaction_rates_and_rate_laws$c$, $c$Zero-order integrated rate law$c$, $c$Apply [A] = -kt + [A]0 and half-life t1/2 = [A]0/(2k) for zero-order reactions, interpret linear [A] vs t plots.$c$, ARRAY[$t$zero-order$t$, $t$[A] = -kt + [A]0$t$, $t$half-life formula$t$, $t$linear plot$t$, $t$slope = -k$t$]::text[], 4);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$chem_lab_first_order_integrated_rate_law$c$, $c$chem_lab$c$, $c$chem_lab_reaction_rates_and_rate_laws$c$, $c$First-order integrated rate law$c$, $c$Use ln[A] = -kt + ln[A]0 and constant half-life t1/2 = 0.693/k, identify linearity in ln[A] vs t graphs.$c$, ARRAY[$t$first-order$t$, $t$ln[A] = -kt + ln[A]0$t$, $t$t1/2 = 0.693/k$t$, $t$half-life constant$t$, $t$linear ln plot$t$]::text[], 5);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$chem_lab_second_order_integrated_rate_law$c$, $c$chem_lab$c$, $c$chem_lab_reaction_rates_and_rate_laws$c$, $c$Second-order integrated rate law (single reactant)$c$, $c$Apply 1/[A] = kt + 1/[A]0 and half-life t1/2 = 1/(k[A]0) for second-order A -> products, identify linear 1/[A] vs t plots.$c$, ARRAY[$t$second-order$t$, $t$1/[A] = kt + 1/[A]0$t$, $t$half-life formula$t$, $t$linear plot$t$, $t$reciprocal concentration$t$]::text[], 6);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$chem_lab_graphical_determination_of_order$c$, $c$chem_lab$c$, $c$chem_lab_reaction_rates_and_rate_laws$c$, $c$Graphical determination of reaction order$c$, $c$Determine the order by testing which plot yields a straight line: [A] vs t (zero), ln[A] vs t (first), or 1/[A] vs t (second).$c$, ARRAY[$t$linearization$t$, $t$graphical analysis$t$, $t$order determination$t$, $t$integrated rate law plots$t$, $t$linear regression$t$]::text[], 7);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$chem_lab_elementary_reactions_and_molecularity$c$, $c$chem_lab$c$, $c$chem_lab_reaction_rates_and_rate_laws$c$, $c$Elementary reactions and molecularity$c$, $c$Classify elementary steps as unimolecular, bimolecular, or termolecular, write rate laws directly from the stoichiometry of an elementary step.$c$, ARRAY[$t$elementary step$t$, $t$molecularity$t$, $t$unimolecular$t$, $t$bimolecular$t$, $t$termolecular$t$]::text[], 8);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$chem_lab_rate_determining_step$c$, $c$chem_lab$c$, $c$chem_lab_reaction_rates_and_rate_laws$c$, $c$Rate-determining step in mechanisms$c$, $c$Identify the slowest elementary step as the rate-determining step, and confirm that its derived rate law matches the experimentally determined rate law.$c$, ARRAY[$t$rate-determining step$t$, $t$slow step$t$, $t$mechanism$t$, $t$rate law match$t$, $t$reaction coordinate$t$]::text[], 9);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$chem_lab_intermediates_and_catalysts_in_mechanisms$c$, $c$chem_lab$c$, $c$chem_lab_reaction_rates_and_rate_laws$c$, $c$Intermediates vs. catalysts in mechanisms$c$, $c$Distinguish reactive intermediates (produced then consumed) from catalysts (not consumed, regenerated), explain why intermediates do not appear in the overall rate law.$c$, ARRAY[$t$intermediate$t$, $t$catalyst$t$, $t$mechanism$t$, $t$consumed$t$, $t$regenerated$t$, $t$rate law$t$]::text[], 10);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$chem_lab_collision_theory$c$, $c$chem_lab$c$, $c$chem_lab_factors_affecting_reaction_rates$c$, $c$Collision theory of reaction rates$c$, $c$Explain that reactions require collisions with energy >= activation energy and proper orientation, relate collision frequency to concentration and temperature.$c$, ARRAY[$t$collision theory$t$, $t$activation energy$t$, $t$orientation$t$, $t$effective collisions$t$, $t$collision frequency$t$]::text[], 0);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$chem_lab_activation_energy_and_energy_profiles$c$, $c$chem_lab$c$, $c$chem_lab_factors_affecting_reaction_rates$c$, $c$Activation energy and energy profiles$c$, $c$Interpret potential energy diagrams: identify activation energy (Ea), transition state, and enthalpy change (DeltaH) for exothermic and endothermic reactions.$c$, ARRAY[$t$Ea$t$, $t$transition state$t$, $t$DeltaH$t$, $t$energy diagram$t$, $t$exothermic$t$, $t$endothermic$t$]::text[], 1);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$chem_lab_arrhenius_equation$c$, $c$chem_lab$c$, $c$chem_lab_factors_affecting_reaction_rates$c$, $c$Arrhenius equation$c$, $c$Use k = A e^(-Ea/RT) and its linear form ln k = ln A - (Ea/R)(1/T) to calculate activation energy or rate constants at different temperatures.$c$, ARRAY[$t$Arrhenius$t$, $t$k = A e^(-Ea/RT)$t$, $t$ln k vs 1/T$t$, $t$activation energy calculation$t$, $t$A factor$t$]::text[], 2);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$chem_lab_temperature_effect_on_rate$c$, $c$chem_lab$c$, $c$chem_lab_factors_affecting_reaction_rates$c$, $c$Temperature effect on reaction rate$c$, $c$Use the Maxwell-Boltzmann distribution to explain why a small temperature increase sharply raises the fraction of molecules with energy >= Ea, accelerating the reaction.$c$, ARRAY[$t$temperature dependence$t$, $t$Boltzmann distribution$t$, $t$fraction with E>=Ea$t$, $t$rate increase$t$, $t$kinetic energy$t$]::text[], 3);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$chem_lab_concentration_effect_on_rate$c$, $c$chem_lab$c$, $c$chem_lab_factors_affecting_reaction_rates$c$, $c$Effect of concentration on reaction rate$c$, $c$Relate increased reactant concentration to higher collision frequency and explain the effect predicted by the rate law, note zero-order independence.$c$, ARRAY[$t$concentration effect$t$, $t$collision frequency$t$, $t$rate law$t$, $t$zero-order exception$t$, $t$kinetics$t$]::text[], 4);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$chem_lab_surface_area_effect$c$, $c$chem_lab$c$, $c$chem_lab_factors_affecting_reaction_rates$c$, $c$Effect of surface area on rate$c$, $c$Explain that dividing a solid reactant into smaller particles increases exposed surface area, leading to more frequent collisions and a faster reaction rate.$c$, ARRAY[$t$surface area$t$, $t$solid reactant$t$, $t$rate increase$t$, $t$heterogeneous reaction$t$, $t$particle size$t$]::text[], 5);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$chem_lab_nature_of_reactants$c$, $c$chem_lab$c$, $c$chem_lab_factors_affecting_reaction_rates$c$, $c$Nature of reactants and reaction rate$c$, $c$Correlate reaction rate with bond strengths, physical state (s, l, g, aq), and whether the reaction is homogeneous or heterogeneous.$c$, ARRAY[$t$bond strength$t$, $t$physical state$t$, $t$homogeneous$t$, $t$heterogeneous$t$, $t$reactivity$t$]::text[], 6);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$chem_lab_catalysis_and_activation_energy$c$, $c$chem_lab$c$, $c$chem_lab_factors_affecting_reaction_rates$c$, $c$Catalysis and activation energy$c$, $c$Define a catalyst as a substance that provides an alternative pathway with a lower activation energy, speeding the reaction without being consumed.$c$, ARRAY[$t$catalyst$t$, $t$lower Ea$t$, $t$alternative pathway$t$, $t$regenerated$t$, $t$reaction rate$t$]::text[], 7);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$chem_lab_homogeneous_vs_heterogeneous_catalysts$c$, $c$chem_lab$c$, $c$chem_lab_factors_affecting_reaction_rates$c$, $c$Homogeneous vs. heterogeneous catalysts$c$, $c$Distinguish homogeneous catalysts (same phase as reactants) from heterogeneous catalysts (different phase), give examples such as enzymes and solid metal surfaces.$c$, ARRAY[$t$homogeneous catalyst$t$, $t$heterogeneous catalyst$t$, $t$phase$t$, $t$enzyme$t$, $t$surface catalysis$t$]::text[], 8);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$chem_lab_reaction_coordinate_diagram_with_catalyst$c$, $c$chem_lab$c$, $c$chem_lab_factors_affecting_reaction_rates$c$, $c$Reaction coordinate diagram with a catalyst$c$, $c$Draw and interpret a potential energy diagram showing a catalyzed pathway with a lower activation energy hump while DeltaH remains unchanged.$c$, ARRAY[$t$catalyst$t$, $t$energy diagram$t$, $t$lower Ea$t$, $t$same DeltaH$t$, $t$transition state$t$]::text[], 9);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$chem_lab_manometer_and_barometer_operation$c$, $c$chem_lab$c$, $c$chem_lab_lab_methods_graphs_and_experimental_analysis$c$, $c$Manometer and barometer operation$c$, $c$Read open?end and closed?end manometers to determine gas pressure, interpret mercury barometer readings for atmospheric pressure.$c$, ARRAY[$t$manometer$t$, $t$open-end$t$, $t$closed-end$t$, $t$barometer$t$, $t$pressure measurement$t$]::text[], 0);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$chem_lab_gas_volume_measurement_techniques$c$, $c$chem_lab$c$, $c$chem_lab_lab_methods_graphs_and_experimental_analysis$c$, $c$Gas volume measurement techniques$c$, $c$Describe the use of gas syringes, eudiometers, and water displacement with graduated cylinders for collecting and measuring gas volumes.$c$, ARRAY[$t$gas syringe$t$, $t$eudiometer$t$, $t$water displacement$t$, $t$gas collection$t$, $t$volume reading$t$]::text[], 1);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$chem_lab_water_displacement_vapor_pressure_correction$c$, $c$chem_lab$c$, $c$chem_lab_lab_methods_graphs_and_experimental_analysis$c$, $c$Water displacement and vapor pressure correction$c$, $c$Perform gas collection over water, apply Dalton's law to correct for water vapor pressure, and ensure temperature equilibrium before measuring.$c$, ARRAY[$t$water displacement$t$, $t$vapor pressure correction$t$, $t$Dalton's law$t$, $t$eudiometer$t$, $t$P_H2O$t$]::text[], 2);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$chem_lab_dumas_method_for_molar_mass$c$, $c$chem_lab$c$, $c$chem_lab_lab_methods_graphs_and_experimental_analysis$c$, $c$Dumas method for molar mass of a volatile liquid$c$, $c$Determine the molar mass of a volatile liquid by vaporizing it in a flask of known volume, measuring mass, and applying PV = nRT.$c$, ARRAY[$t$Dumas method$t$, $t$volatile liquid$t$, $t$molar mass$t$, $t$PV=nRT$t$, $t$vaporization$t$]::text[], 3);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$chem_lab_vapor_density_direct_measurement$c$, $c$chem_lab$c$, $c$chem_lab_lab_methods_graphs_and_experimental_analysis$c$, $c$Vapor density by direct measurement$c$, $c$Measure the mass of a known volume of gas at controlled T and P to calculate molar mass using M = mRT/PV.$c$, ARRAY[$t$gas density$t$, $t$molar mass$t$, $t$direct measurement$t$, $t$M=mRT/PV$t$, $t$gas sample$t$]::text[], 4);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$chem_lab_monitoring_reaction_progress$c$, $c$chem_lab$c$, $c$chem_lab_lab_methods_graphs_and_experimental_analysis$c$, $c$Monitoring reaction progress$c$, $c$Describe methods to follow concentration over time: spectrophotometry (absorbance), titration of aliquots, pressure change (gases), and conductivity.$c$, ARRAY[$t$spectrophotometry$t$, $t$titration$t$, $t$pressure monitoring$t$, $t$concentration vs time$t$, $t$aliquot$t$]::text[], 5);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$chem_lab_initial_rates_method_lab$c$, $c$chem_lab$c$, $c$chem_lab_lab_methods_graphs_and_experimental_analysis$c$, $c$Initial rates method in the lab$c$, $c$Design experiments to measure initial rates by varying initial concentrations and extracting the instantaneous slope at t = 0 for rate law determination.$c$, ARRAY[$t$initial rates$t$, $t$experimental design$t$, $t$slope at t=0$t$, $t$rate law determination$t$, $t$concentration variation$t$]::text[], 6);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$chem_lab_clock_reactions_for_kinetics$c$, $c$chem_lab$c$, $c$chem_lab_lab_methods_graphs_and_experimental_analysis$c$, $c$Clock reactions for kinetics$c$, $c$Use the iodine clock reaction or similar systems to determine rate by measuring the time until a sudden color change, relating time to initial rate.$c$, ARRAY[$t$clock reaction$t$, $t$iodine clock$t$, $t$thiosulfate$t$, $t$time to color change$t$, $t$rate determination$t$]::text[], 7);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$chem_lab_graphical_analysis_of_kinetics_data$c$, $c$chem_lab$c$, $c$chem_lab_lab_methods_graphs_and_experimental_analysis$c$, $c$Graphical analysis of kinetics data$c$, $c$Create and interpret plots of [A] vs t, ln[A] vs t, and 1/[A] vs t to determine reaction order and extract the rate constant from the linear slope.$c$, ARRAY[$t$graphical analysis$t$, $t$integrated rate law plots$t$, $t$order determination$t$, $t$slope$t$, $t$linear regression$t$]::text[], 8);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$chem_lab_activation_energy_experimental_determination$c$, $c$chem_lab$c$, $c$chem_lab_lab_methods_graphs_and_experimental_analysis$c$, $c$Experimental determination of activation energy$c$, $c$Measure rate constants at multiple temperatures, construct an Arrhenius plot (ln k vs 1/T), and calculate Ea from slope = -Ea/R.$c$, ARRAY[$t$Arrhenius plot$t$, $t$activation energy$t$, $t$slope = -Ea/R$t$, $t$multiple temperatures$t$, $t$rate constant$t$]::text[], 9);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$chem_lab_temperature_control_and_quenching$c$, $c$chem_lab$c$, $c$chem_lab_lab_methods_graphs_and_experimental_analysis$c$, $c$Temperature control and quenching techniques$c$, $c$Use water baths or heating blocks for precise temperature regulation, stop a reaction by rapid cooling (quenching) or by adding a quenching reagent.$c$, ARRAY[$t$water bath$t$, $t$temperature control$t$, $t$quenching$t$, $t$reaction stop$t$, $t$aliquot$t$]::text[], 10);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$chem_lab_error_analysis_gas_kinetics_experiments$c$, $c$chem_lab$c$, $c$chem_lab_lab_methods_graphs_and_experimental_analysis$c$, $c$Error analysis in gas and kinetics experiments$c$, $c$Identify common error sources: gas leaks, incomplete vaporization, temperature fluctuations, timing errors, parallax, calculate percent error and suggest improvements.$c$, ARRAY[$t$error analysis$t$, $t$percent error$t$, $t$gas leaks$t$, $t$timing$t$, $t$parallax$t$, $t$systematic errors$t$]::text[], 11);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$anatomy_upper_respiratory_anatomy$c$, $c$anatomy$c$, $c$anatomy_respiratory_anatomy_and_mechanics$c$, $c$Upper respiratory tract anatomy (nose, pharynx, larynx)$c$, $c$Identify and describe the structures of the nose, nasal conchae, pharynx (naso-, oro-, laryngopharynx), and larynx including epiglottis and vocal folds.$c$, ARRAY[$t$nasal conchae$t$, $t$pharynx regions$t$, $t$larynx cartilages$t$, $t$glottis$t$, $t$vocal folds$t$]::text[], 0);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$anatomy_lower_respiratory_anatomy$c$, $c$anatomy$c$, $c$anatomy_respiratory_anatomy_and_mechanics$c$, $c$Lower respiratory tract anatomy (trachea to alveoli)$c$, $c$Trace the tracheobronchial tree from trachea to terminal bronchioles and alveoli, characterize the respiratory membrane formed by alveolar and capillary walls.$c$, ARRAY[$t$trachea$t$, $t$bronchi$t$, $t$bronchioles$t$, $t$alveolar ducts$t$, $t$respiratory membrane$t$, $t$type I pneumocytes$t$]::text[], 1);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$anatomy_pleura_and_intrapleural_pressure$c$, $c$anatomy$c$, $c$anatomy_respiratory_anatomy_and_mechanics$c$, $c$Pleura and intrapleural pressure dynamics$c$, $c$Distinguish visceral and parietal pleura, explain how pleural fluid and negative intrapleural pressure couple lung to chest wall and prevent collapse.$c$, ARRAY[$t$visceral pleura$t$, $t$parietal pleura$t$, $t$intrapleural pressure$t$, $t$pleural fluid$t$, $t$pneumothorax$t$]::text[], 2);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$anatomy_respiratory_muscles$c$, $c$anatomy$c$, $c$anatomy_respiratory_anatomy_and_mechanics$c$, $c$Respiratory muscles and chest wall mechanics$c$, $c$Identify diaphragm, external/internal intercostals, scalenes, and abdominal muscles, describe their roles in inspiration and forced expiration.$c$, ARRAY[$t$diaphragm$t$, $t$external intercostals$t$, $t$internal intercostals$t$, $t$accessory muscles$t$, $t$bucket-handle motion$t$]::text[], 3);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$anatomy_lung_volumes_capacities$c$, $c$anatomy$c$, $c$anatomy_respiratory_anatomy_and_mechanics$c$, $c$Static lung volumes and capacities$c$, $c$Define TV, IRV, ERV, RV, VC, TLC, FRC, know normal values and how they are measured or calculated.$c$, ARRAY[$t$tidal volume$t$, $t$inspiratory reserve volume$t$, $t$expiratory reserve volume$t$, $t$residual volume$t$, $t$vital capacity$t$, $t$total lung capacity$t$]::text[], 4);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$anatomy_spirometry_flow_volume$c$, $c$anatomy$c$, $c$anatomy_respiratory_anatomy_and_mechanics$c$, $c$Spirometry and flow-volume loop interpretation$c$, $c$Interpret FVC, FEV1, FEV1/FVC ratio, differentiate obstructive (low ratio) and restrictive (normal/high ratio) patterns using flow-volume loops.$c$, ARRAY[$t$FVC$t$, $t$FEV1$t$, $t$FEV1/FVC ratio$t$, $t$obstructive pattern$t$, $t$restrictive pattern$t$, $t$flow-volume loop$t$]::text[], 5);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$anatomy_minute_alveolar_ventilation$c$, $c$anatomy$c$, $c$anatomy_respiratory_anatomy_and_mechanics$c$, $c$Minute and alveolar ventilation calculations$c$, $c$Calculate minute ventilation (VE = VT x f) and alveolar ventilation (VA = (VT - VD) x f), explain the impact of dead space on gas turnover.$c$, ARRAY[$t$minute ventilation$t$, $t$alveolar ventilation$t$, $t$tidal volume$t$, $t$dead space$t$, $t$respiratory rate$t$]::text[], 6);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$anatomy_dead_space_bohr$c$, $c$anatomy$c$, $c$anatomy_respiratory_anatomy_and_mechanics$c$, $c$Dead space and Bohr equation$c$, $c$Distinguish anatomical and physiological dead space, apply the Bohr equation (VD/VT = (PaCO2 - PECO2)/PaCO2) to quantify physiological dead space.$c$, ARRAY[$t$anatomical dead space$t$, $t$physiological dead space$t$, $t$Bohr equation$t$, $t$PaCO2$t$, $t$PECO2$t$]::text[], 7);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$anatomy_pulmonary_compliance$c$, $c$anatomy$c$, $c$anatomy_respiratory_anatomy_and_mechanics$c$, $c$Pulmonary compliance and hysteresis$c$, $c$Define compliance (DeltaV/DeltaP), interpret pressure-volume curves showing hysteresis and the effects of emphysema (increased) vs fibrosis (decreased).$c$, ARRAY[$t$compliance DeltaV/DeltaP$t$, $t$hysteresis$t$, $t$emphysema$t$, $t$pulmonary fibrosis$t$, $t$elastin$t$]::text[], 8);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$anatomy_surfactant_laplace$c$, $c$anatomy$c$, $c$anatomy_respiratory_anatomy_and_mechanics$c$, $c$Surfactant and Laplace's law in alveolar stability$c$, $c$State Laplace's law (P = 2T/r) and explain how surfactant reduces surface tension, prevents alveolar collapse and decreases work of breathing.$c$, ARRAY[$t$surfactant$t$, $t$dipalmitoylphosphatidylcholine$t$, $t$Laplace's law$t$, $t$surface tension$t$, $t$type II pneumocytes$t$, $t$NRDS$t$]::text[], 9);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$anatomy_airway_resistance$c$, $c$anatomy$c$, $c$anatomy_respiratory_anatomy_and_mechanics$c$, $c$Airway resistance and Poiseuille's law$c$, $c$Apply Poiseuille's law (R proportional to 1/r4) to explain factors affecting resistance, link to bronchial smooth muscle tone, asthma, and bronchodilators.$c$, ARRAY[$t$Poiseuille's law$t$, $t$airway radius$t$, $t$bronchoconstriction$t$, $t$asthma$t$, $t$parasympathetic tone$t$]::text[], 10);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$anatomy_work_of_breathing$c$, $c$anatomy$c$, $c$anatomy_respiratory_anatomy_and_mechanics$c$, $c$Work of breathing components$c$, $c$Identify elastic work (lung/chest wall recoil) and resistive work (airway/tissue resistance), recognize conditions that increase each component.$c$, ARRAY[$t$elastic work$t$, $t$resistive work$t$, $t$compliance$t$, $t$airway resistance$t$, $t$respiratory effort$t$]::text[], 11);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$anatomy_respiratory_centers$c$, $c$anatomy$c$, $c$anatomy_respiratory_anatomy_and_mechanics$c$, $c$Medullary and pontine respiratory centers$c$, $c$Describe the dorsal respiratory group (DRG) for inspiration, ventral respiratory group (VRG) for forced expiration, and pontine centers (apneustic, pneumotaxic) for pattern modulation.$c$, ARRAY[$t$DRG$t$, $t$VRG$t$, $t$pre-B?tzinger complex$t$, $t$apneustic center$t$, $t$pneumotaxic center$t$]::text[], 12);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$anatomy_chemoreceptors$c$, $c$anatomy$c$, $c$anatomy_respiratory_anatomy_and_mechanics$c$, $c$Peripheral and central chemoreceptors in ventilatory control$c$, $c$Explain how peripheral chemoreceptors (carotid and aortic bodies) sense PO2, PCO2, pH, and central medullary chemoreceptors respond to CSF [H+], predict ventilatory responses.$c$, ARRAY[$t$carotid body$t$, $t$aortic body$t$, $t$central chemoreceptor$t$, $t$hypercapnia$t$, $t$hypoxemia$t$, $t$CSF pH$t$]::text[], 13);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$anatomy_pressure_changes_breathing$c$, $c$anatomy$c$, $c$anatomy_respiratory_anatomy_and_mechanics$c$, $c$Pressure changes during inspiration and expiration$c$, $c$Track alveolar, intrapleural, and transpulmonary pressures during quiet breathing and forced maneuvers, explain pneumothorax consequences.$c$, ARRAY[$t$intrapleural pressure$t$, $t$alveolar pressure$t$, $t$transpulmonary pressure$t$, $t$pneumothorax$t$, $t$elastic recoil$t$]::text[], 14);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$anatomy_ficks_law_diffusion$c$, $c$anatomy$c$, $c$anatomy_gas_exchange_transport_and_blood_ph$c$, $c$Respiratory membrane and Fick's law of diffusion$c$, $c$Apply Fick's law (V gas proportional to A x DeltaP x D / T) to explain gas exchange, relate changes in surface area, thickness, or pressure gradient to disease (e.g., emphysema, fibrosis).$c$, ARRAY[$t$Fick's law$t$, $t$diffusion coefficient$t$, $t$partial pressure gradient$t$, $t$surface area$t$, $t$membrane thickness$t$]::text[], 0);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$anatomy_oxygen_cascade$c$, $c$anatomy$c$, $c$anatomy_gas_exchange_transport_and_blood_ph$c$, $c$Oxygen cascade and partial pressure gradients$c$, $c$Trace PO2 from inspired air (~160 mmHg) to mitochondrial PO2 (<5 mmHg), identify key drop points (alveolar, arterial, capillary).$c$, ARRAY[$t$PO2 cascade$t$, $t$alveolar PO2$t$, $t$arterial PO2$t$, $t$mitochondrial PO2$t$]::text[], 1);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$anatomy_alveolar_gas_equation$c$, $c$anatomy$c$, $c$anatomy_gas_exchange_transport_and_blood_ph$c$, $c$Alveolar gas equation and ideal PAO2$c$, $c$Calculate ideal alveolar PO2 using PAO2 = (PB - PH2O) x FiO2 - (PaCO2 / R), interpret in hypoventilation and altered FiO2.$c$, ARRAY[$t$alveolar gas equation$t$, $t$PAO2$t$, $t$respiratory quotient$t$, $t$barometric pressure$t$, $t$FiO2$t$]::text[], 2);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$anatomy_oxygen_transport_content$c$, $c$anatomy$c$, $c$anatomy_gas_exchange_transport_and_blood_ph$c$, $c$Oxygen content and transport in blood$c$, $c$Compute arterial O2 content: CaO2 = (Hb x 1.34 x SaO2) + (0.003 x PaO2), compare dissolved vs. hemoglobin-bound O2 contributions.$c$, ARRAY[$t$CaO2$t$, $t$oxygen content$t$, $t$hemoglobin binding capacity$t$, $t$dissolved oxygen$t$]::text[], 3);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$anatomy_hemoglobin_structure$c$, $c$anatomy$c$, $c$anatomy_gas_exchange_transport_and_blood_ph$c$, $c$Hemoglobin structure and cooperative binding$c$, $c$Describe Hb quaternary structure (alpha2beta2), heme group Fe2+, and T->R conformational change during O2 binding, relate to sigmoidal dissociation curve.$c$, ARRAY[$t$heme$t$, $t$globins$t$, $t$T state$t$, $t$R state$t$, $t$cooperativity$t$, $t$2,3-BPG$t$]::text[], 4);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$anatomy_oxyhemoglobin_dissociation_curve$c$, $c$anatomy$c$, $c$anatomy_gas_exchange_transport_and_blood_ph$c$, $c$Oxyhemoglobin dissociation curve characteristics$c$, $c$Interpret the sigmoidal curve: plateau at high PO2 (loading), steep at tissue PO2 (unloading), define P50 and its clinical significance.$c$, ARRAY[$t$P50$t$, $t$sigmoidal curve$t$, $t$oxygen saturation$t$, $t$loading/unloading$t$]::text[], 5);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$anatomy_bohr_effect_modulators$c$, $c$anatomy$c$, $c$anatomy_gas_exchange_transport_and_blood_ph$c$, $c$Bohr effect and modulators of Hb-O2 affinity$c$, $c$Explain how increased PCO2, [H+], temperature, and 2,3-BPG shift the curve right (decreased affinity) and enhance O2 unloading, opposite for left shift.$c$, ARRAY[$t$Bohr effect$t$, $t$right shift$t$, $t$left shift$t$, $t$2,3-BPG$t$, $t$temperature$t$, $t$pH$t$]::text[], 6);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$anatomy_co2_transport_forms$c$, $c$anatomy$c$, $c$anatomy_gas_exchange_transport_and_blood_ph$c$, $c$CO2 transport forms and carbonic anhydrase$c$, $c$List three CO2 transport forms: dissolved (5-10%), carbamino-Hb (20-30%), bicarbonate HCO3- (60-70%), describe role of carbonic anhydrase in RBC.$c$, ARRAY[$t$bicarbonate$t$, $t$carbaminohemoglobin$t$, $t$dissolved CO2$t$, $t$carbonic anhydrase$t$, $t$Haldane effect$t$]::text[], 7);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$anatomy_chloride_shift$c$, $c$anatomy$c$, $c$anatomy_gas_exchange_transport_and_blood_ph$c$, $c$Cloride shift (Hamburger phenomenon)$c$, $c$Explain the Cl-/HCO3- antiport across RBC membrane to maintain electroneutrality during CO2 loading/unloading, link to plasma chloride changes.$c$, ARRAY[$t$chloride shift$t$, $t$band 3 protein$t$, $t$anion exchange$t$, $t$Hamburger phenomenon$t$, $t$HCO3-$t$]::text[], 8);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$anatomy_haldane_effect$c$, $c$anatomy$c$, $c$anatomy_gas_exchange_transport_and_blood_ph$c$, $c$Haldane effect and CO2 dissociation curve$c$, $c$State that deoxygenated hemoglobin has greater affinity for CO2 and H+, facilitating CO2 loading at tissues, interpret the Haldane effect on CO2 transport.$c$, ARRAY[$t$Haldane effect$t$, $t$deoxyhemoglobin$t$, $t$CO2 binding$t$, $t$carbamino formation$t$]::text[], 9);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$anatomy_vq_matching$c$, $c$anatomy$c$, $c$anatomy_gas_exchange_transport_and_blood_ph$c$, $c$Ventilation-perfusion (V/Q) matching and regional differences$c$, $c$Define V/Q ratio (ideally ~0.8), describe lung zones (West zones) and how gravity affects ventilation/perfusion distribution, calculate alveolar-arterial O2 difference.$c$, ARRAY[$t$V/Q ratio$t$, $t$West zones$t$, $t$A-a gradient$t$, $t$gravity effect$t$, $t$alveolar dead space$t$]::text[], 10);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$anatomy_shunt_deadspace$c$, $c$anatomy$c$, $c$anatomy_gas_exchange_transport_and_blood_ph$c$, $c$Shunt vs. dead space as V/Q abnormalities$c$, $c$Distinguish shunt (perfused but not ventilated, V/Q <1, responds poorly to O2) from dead space (ventilated but not perfused, V/Q >1), give examples.$c$, ARRAY[$t$shunt$t$, $t$dead space$t$, $t$V/Q mismatch$t$, $t$pulmonary embolism$t$, $t$atelectasis$t$]::text[], 11);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$anatomy_henderson_hasselbalch$c$, $c$anatomy$c$, $c$anatomy_gas_exchange_transport_and_blood_ph$c$, $c$Henderson-Hasselbalch equation for bicarbonate buffer$c$, $c$Apply pH = pKa + log([HCO3-]/(0.03 x PCO2)) to assess acid-base status, identify normal values (pH 7.4, HCO3- 24 mM, PCO2 40 mmHg).$c$, ARRAY[$t$Henderson-Hasselbalch$t$, $t$bicarbonate buffer$t$, $t$pH$t$, $t$PCO2$t$, $t$metabolic$t$, $t$respiratory$t$]::text[], 12);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$anatomy_respiratory_compensation_acid_base$c$, $c$anatomy$c$, $c$anatomy_gas_exchange_transport_and_blood_ph$c$, $c$Respiratory compensation in acid-base disturbances$c$, $c$Predict ventilator response to metabolic acidosis/alkalosis (Kussmaul breathing, hypoventilation) and interpret compensatory changes in PCO2.$c$, ARRAY[$t$compensation$t$, $t$metabolic acidosis$t$, $t$respiratory alkalosis$t$, $t$Kussmaul respirations$t$, $t$ventilatory response$t$]::text[], 13);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$anatomy_carbon_monoxide_poisoning$c$, $c$anatomy$c$, $c$anatomy_gas_exchange_transport_and_blood_ph$c$, $c$Carbon monoxide poisoning and Hb affinity$c$, $c$Explain CO's high affinity for Hb (~200x O2), left shift of O2 dissociation curve, decreased O2 unloading, and functional anemia, identify cherry-red skin and treatment with 100% O2.$c$, ARRAY[$t$carboxyhemoglobin$t$, $t$left shift$t$, $t$competitive binding$t$, $t$functional anemia$t$, $t$pulse oximetry limitation$t$]::text[], 14);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$anatomy_oral_cavity_salivary_glands$c$, $c$anatomy$c$, $c$anatomy_digestive_anatomy_and_mechanical_chemical_digestion$c$, $c$Oral cavity and salivary glands$c$, $c$Identify teeth (incisors, canines, premolars, molars), tongue papillae, and three major salivary glands (parotid, submandibular, sublingual) with their duct openings.$c$, ARRAY[$t$parotid$t$, $t$submandibular$t$, $t$sublingual$t$, $t$ducts of Rivinus$t$, $t$Wharton's duct$t$, $t$Stensen's duct$t$]::text[], 0);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$anatomy_pharynx_esophagus_deglutition$c$, $c$anatomy$c$, $c$anatomy_digestive_anatomy_and_mechanical_chemical_digestion$c$, $c$Pharynx, esophagus, and deglutition$c$, $c$Outline oral, pharyngeal, and esophageal phases of swallowing, describe upper and lower esophageal sphincters and their role in preventing reflux.$c$, ARRAY[$t$deglutition$t$, $t$UES$t$, $t$LES$t$, $t$peristalsis$t$, $t$reflux$t$]::text[], 1);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$anatomy_stomach_gross_anatomy$c$, $c$anatomy$c$, $c$anatomy_digestive_anatomy_and_mechanical_chemical_digestion$c$, $c$Stomach gross anatomy and regions$c$, $c$Distinguish cardia, fundus, body, antrum, pylorus, identify gastric rugae and sphincters (lower esophageal, pyloric).$c$, ARRAY[$t$cardia$t$, $t$fundus$t$, $t$antrum$t$, $t$pylorus$t$, $t$rugae$t$, $t$pyloric sphincter$t$]::text[], 2);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$anatomy_gastric_gland_histology$c$, $c$anatomy$c$, $c$anatomy_digestive_anatomy_and_mechanical_chemical_digestion$c$, $c$Gastric gland histology and secretory cells$c$, $c$Identify gastric pit, mucous neck cells, parietal cells (HCl, intrinsic factor), chief cells (pepsinogen), and enteroendocrine G cells (gastrin).$c$, ARRAY[$t$parietal cells$t$, $t$chief cells$t$, $t$G cells$t$, $t$intrinsic factor$t$, $t$HCl$t$, $t$pepsinogen$t$]::text[], 3);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$anatomy_gastric_acid_secretion$c$, $c$anatomy$c$, $c$anatomy_digestive_anatomy_and_mechanical_chemical_digestion$c$, $c$Gastric acid secretion and intrinsic factor$c$, $c$Describe parietal cell H+,K+-ATPase (proton pump), stimulation by gastrin/histamine/ACh, explain intrinsic factor's role in B12 absorption.$c$, ARRAY[$t$proton pump H+K+-ATPase$t$, $t$gastrin$t$, $t$histamine$t$, $t$ACh$t$, $t$intrinsic factor$t$, $t$pernicious anemia$t$]::text[], 4);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$anatomy_small_intestine_anatomy$c$, $c$anatomy$c$, $c$anatomy_digestive_anatomy_and_mechanical_chemical_digestion$c$, $c$Small intestine anatomy and surface area adaptations$c$, $c$Distinguish duodenum, jejunum, ileum, describe plicae circulares, villi, and microvilli (brush border) increasing absorptive surface.$c$, ARRAY[$t$duodenum$t$, $t$jejunum$t$, $t$ileum$t$, $t$plicae circulares$t$, $t$villi$t$, $t$microvilli$t$]::text[], 5);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$anatomy_large_intestine_anatomy$c$, $c$anatomy$c$, $c$anatomy_digestive_anatomy_and_mechanical_chemical_digestion$c$, $c$Large intestine anatomy and features$c$, $c$Identify cecum, appendix, ascending/transverse/descending/sigmoid colon, rectum, anal canal, recognize teniae coli, haustra, and epiploic appendages.$c$, ARRAY[$t$cecum$t$, $t$appendix$t$, $t$teniae coli$t$, $t$haustra$t$, $t$rectum$t$, $t$anal canal$t$]::text[], 6);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$anatomy_accessory_digestive_organs$c$, $c$anatomy$c$, $c$anatomy_digestive_anatomy_and_mechanical_chemical_digestion$c$, $c$Liver, gallbladder, and pancreas anatomy$c$, $c$Locate liver lobes, portal triad, gallbladder, cystic duct, common bile duct, pancreatic duct (duct of Wirsung), and hepatopancreatic ampulla.$c$, ARRAY[$t$hepatic ducts$t$, $t$gallbladder$t$, $t$common bile duct$t$, $t$pancreatic duct$t$, $t$ampulla of Vater$t$, $t$sphincter of Oddi$t$]::text[], 7);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$anatomy_gi_tract_histology_layers$c$, $c$anatomy$c$, $c$anatomy_digestive_anatomy_and_mechanical_chemical_digestion$c$, $c$Histology of GI tract wall layers$c$, $c$Describe the four layers: mucosa (epithelium, lamina propria, muscularis mucosae), submucosa (Meissner's plexus), muscularis externa (Auerbach's plexus), and serosa/adventitia.$c$, ARRAY[$t$mucosa$t$, $t$submucosa$t$, $t$muscularis externa$t$, $t$serosa$t$, $t$Meissner's plexus$t$, $t$Auerbach's plexus$t$]::text[], 8);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$anatomy_enteric_nervous_system$c$, $c$anatomy$c$, $c$anatomy_digestive_anatomy_and_mechanical_chemical_digestion$c$, $c$Enteric nervous system and peristaltic reflex$c$, $c$Explain myenteric and submucosal plexuses roles, describe local peristaltic reflex (contraction behind, relaxation ahead) and law of the gut.$c$, ARRAY[$t$myenteric plexus$t$, $t$submucosal plexus$t$, $t$peristalsis$t$, $t$law of the gut$t$, $t$VIP$t$, $t$nitric oxide$t$]::text[], 9);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$anatomy_mechanical_digestion_processes$c$, $c$anatomy$c$, $c$anatomy_digestive_anatomy_and_mechanical_chemical_digestion$c$, $c$Mechanical digestion processes (mastication, churning, segmentation)$c$, $c$Define mastication (chewing), gastric churning and retropulsion, segmentation in small intestine mixing chyme, contrast with peristaltic propulsion.$c$, ARRAY[$t$mastication$t$, $t$churning$t$, $t$segmentation$t$, $t$retropulsion$t$, $t$mixing$t$]::text[], 10);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$anatomy_pancreatic_exocrine_secretion$c$, $c$anatomy$c$, $c$anatomy_digestive_anatomy_and_mechanical_chemical_digestion$c$, $c$Pancreatic exocrine enzymes and bicarbonate secretion$c$, $c$List acinar cell secretion of trypsinogen, chymotrypsinogen, procarboxypeptidase, lipase, amylase, nucleases, duct cells secrete HCO3- to neutralize chyme.$c$, ARRAY[$t$trypsinogen$t$, $t$chymotrypsinogen$t$, $t$lipase$t$, $t$amylase$t$, $t$bicarbonate$t$, $t$enteropeptidase$t$]::text[], 11);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$anatomy_bile_enterohepatic$c$, $c$anatomy$c$, $c$anatomy_digestive_anatomy_and_mechanical_chemical_digestion$c$, $c$Bile production, composition, and enterohepatic circulation$c$, $c$Describe hepatocyte synthesis of bile acids, bile salts, phospholipids, cholesterol, bilirubin, gallbladder concentration, ileal reabsorption (enterohepatic circulation).$c$, ARRAY[$t$bile salts$t$, $t$cholesterol$t$, $t$bilirubin$t$, $t$enterohepatic circulation$t$, $t$micelles$t$]::text[], 12);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$anatomy_gi_hormones_regulation$c$, $c$anatomy$c$, $c$anatomy_digestive_anatomy_and_mechanical_chemical_digestion$c$, $c$GI hormones (gastrin, CCK, secretin, GIP)$c$, $c$Identify stimuli and actions of gastrin (HCl secretion), CCK (gallbladder contraction, pancreatic enzyme), secretin (bicarbonate), and GIP (insulin).$c$, ARRAY[$t$gastrin$t$, $t$CCK$t$, $t$secretin$t$, $t$GIP$t$, $t$motilin$t$, $t$somatostatin$t$]::text[], 13);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$anatomy_gastric_phases$c$, $c$anatomy$c$, $c$anatomy_digestive_anatomy_and_mechanical_chemical_digestion$c$, $c$Phases of gastric secretion (cephalic, gastric, intestinal)$c$, $c$Describe cephalic (vagus), gastric (distension, peptides, gastrin), and intestinal (enterogastric reflex) phases that regulate gastric acid and motility.$c$, ARRAY[$t$cephalic phase$t$, $t$gastric phase$t$, $t$intestinal phase$t$, $t$vagus$t$, $t$enterogastric reflex$t$, $t$somatostatin$t$]::text[], 14);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$anatomy_absorption_pathways$c$, $c$anatomy$c$, $c$anatomy_absorption_nutrition_and_metabolic_handling_of_nutrients$c$, $c$Absorption pathways across intestinal epithelium$c$, $c$Differentiate transcellular (passive, active, facilitated) and paracellular routes, identify carriers, channels, and energy-dependent transporters.$c$, ARRAY[$t$transcellular$t$, $t$paracellular$t$, $t$active transport$t$, $t$facilitated diffusion$t$, $t$SGLT1$t$]::text[], 0);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$anatomy_carb_digestion_monosaccharides$c$, $c$anatomy$c$, $c$anatomy_absorption_nutrition_and_metabolic_handling_of_nutrients$c$, $c$Carbohydrate digestion to monosaccharides and brush border enzymes$c$, $c$Outline starch/glycogen breakdown by salivary and pancreatic amylase to oligosaccharides, final hydrolysis by brush border maltase, sucrase, lactase to monosaccharides.$c$, ARRAY[$t$amylase$t$, $t$maltase$t$, $t$sucrase$t$, $t$lactase$t$, $t$dextrinase$t$, $t$oligosaccharides$t$]::text[], 1);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$anatomy_monosaccharide_absorption$c$, $c$anatomy$c$, $c$anatomy_absorption_nutrition_and_metabolic_handling_of_nutrients$c$, $c$Intestinal absorption of monosaccharides (SGLT1, GLUT2, GLUT5)$c$, $c$Describe Na+-dependent glucose/galactose uptake via SGLT1, basolateral exit by GLUT2, and fructose via GLUT5, link to oral rehydration therapy.$c$, ARRAY[$t$SGLT1$t$, $t$GLUT2$t$, $t$GLUT5$t$, $t$Na+ cotransport$t$, $t$fructose absorption$t$]::text[], 2);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$anatomy_protein_digestion_absorption$c$, $c$anatomy$c$, $c$anatomy_absorption_nutrition_and_metabolic_handling_of_nutrients$c$, $c$Protein digestion and amino acid/peptide absorption$c$, $c$Explain endopeptidases (pepsin, trypsin) and exopeptidases (carboxypeptidase, aminopeptidase), absorption as amino acids (Na+ cotransport) and di/tripeptides (PepT1).$c$, ARRAY[$t$pepsin$t$, $t$trypsin$t$, $t$carboxypeptidase$t$, $t$PepT1$t$, $t$Na+ cotransport$t$, $t$amino acids$t$]::text[], 3);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$anatomy_lipid_digestion_micelles$c$, $c$anatomy$c$, $c$anatomy_absorption_nutrition_and_metabolic_handling_of_nutrients$c$, $c$Lipid digestion and micelle formation$c$, $c$Describe emulsification by bile salts, pancreatic lipase/colipase action on triglycerides, and micelle formation with monoglycerides and fatty acids for diffusion across unstirred layer.$c$, ARRAY[$t$lipase$t$, $t$colipase$t$, $t$bile salts$t$, $t$micelle$t$, $t$monoglycerides$t$, $t$emulsification$t$]::text[], 4);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$anatomy_lipid_absorption_chylomicrons$c$, $c$anatomy$c$, $c$anatomy_absorption_nutrition_and_metabolic_handling_of_nutrients$c$, $c$Lipid absorption and chylomicron pathway$c$, $c$Inside enterocyte, re-esterify fatty acids to triglycerides, package into chylomicrons with apoproteins B-48, exit via lacteals to lymph, then thoracic duct.$c$, ARRAY[$t$chylomicron$t$, $t$apoprotein B-48$t$, $t$lacteal$t$, $t$lymphatic$t$, $t$triglycerides$t$, $t$exocytosis$t$]::text[], 5);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$anatomy_vitamin_absorption$c$, $c$anatomy$c$, $c$anatomy_absorption_nutrition_and_metabolic_handling_of_nutrients$c$, $c$Absorption of fat-soluble and water-soluble vitamins$c$, $c$Compare absorption of fat-soluble (A,D,E,K) requiring micelles and chylomicrons with water-soluble vitamins, highlight B12 needing intrinsic factor for ileal uptake.$c$, ARRAY[$t$fat-soluble vitamins$t$, $t$water-soluble vitamins$t$, $t$intrinsic factor$t$, $t$B12 absorption$t$, $t$micelle$t$]::text[], 6);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$anatomy_iron_absorption$c$, $c$anatomy$c$, $c$anatomy_absorption_nutrition_and_metabolic_handling_of_nutrients$c$, $c$Iron absorption and regulation by hepcidin$c$, $c$Distinguish heme iron (directly absorbed) vs non-heme (DMT1 uptake, ferroportin export), explain hepcidin-mediated ferroportin degradation regulating iron entry.$c$, ARRAY[$t$DMT1$t$, $t$ferroportin$t$, $t$hepcidin$t$, $t$transferrin$t$, $t$heme iron$t$, $t$non-heme iron$t$]::text[], 7);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$anatomy_calcium_absorption$c$, $c$anatomy$c$, $c$anatomy_absorption_nutrition_and_metabolic_handling_of_nutrients$c$, $c$Calcium absorption and vitamin D$c$, $c$Describe active transcellular Ca2+ absorption in duodenum (calbindin, Ca-ATPase) regulated by 1,25-(OH)2 vitamin D, passive paracellular in jejunum/ileum.$c$, ARRAY[$t$calbindin$t$, $t$TRPV6$t$, $t$vitamin D receptor$t$, $t$1,25-dihydroxyvitamin D$t$, $t$paracellular Ca absorption$t$]::text[], 8);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$anatomy_water_electrolyte_absorption$c$, $c$anatomy$c$, $c$anatomy_absorption_nutrition_and_metabolic_handling_of_nutrients$c$, $c$Water and electrolyte absorption in the intestine$c$, $c$Explain Na+ absorption (cotransport with glucose/amino acids, Na+/H+ exchange), Cl- and HCO3- transport, and osmotic water movement, link to diarrhea mechanisms.$c$, ARRAY[$t$Na+/H+ exchanger$t$, $t$Cl-/HCO3- exchange$t$, $t$osmosis$t$, $t$SGLT1$t$, $t$CFTR$t$, $t$secretory diarrhea$t$]::text[], 9);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$anatomy_hepatic_portal_circulation$c$, $c$anatomy$c$, $c$anatomy_absorption_nutrition_and_metabolic_handling_of_nutrients$c$, $c$Hepatic portal circulation and first-pass metabolism$c$, $c$Trace venous drainage from intestines to liver via portal vein, explain first-pass metabolism of drugs and nutrient processing (glycogen storage, detoxification).$c$, ARRAY[$t$portal vein$t$, $t$sinusoids$t$, $t$first-pass effect$t$, $t$hepatocytes$t$, $t$Kupffer cells$t$]::text[], 10);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$anatomy_postabsorptive_glucose_metabolism$c$, $c$anatomy$c$, $c$anatomy_absorption_nutrition_and_metabolic_handling_of_nutrients$c$, $c$Postabsorptive glucose metabolism and hormonal control$c$, $c$Outline glycogenesis (insulin), glycogenolysis, gluconeogenesis (glucagon, cortisol), contrast fed vs fasted states and role of liver in maintaining blood glucose.$c$, ARRAY[$t$glycogenesis$t$, $t$glycogenolysis$t$, $t$gluconeogenesis$t$, $t$insulin$t$, $t$glucagon$t$, $t$glucose-6-phosphatase$t$]::text[], 11);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$anatomy_lipoprotein_metabolism$c$, $c$anatomy$c$, $c$anatomy_absorption_nutrition_and_metabolic_handling_of_nutrients$c$, $c$Lipoprotein metabolism and lipid transport$c$, $c$Describe chylomicron remodeling, VLDL secretion, LDL delivery, HDL reverse cholesterol transport, roles of lipoprotein lipase, CETP, and receptors.$c$, ARRAY[$t$VLDL$t$, $t$LDL$t$, $t$HDL$t$, $t$lipoprotein lipase$t$, $t$cholesterol$t$, $t$ApoB-100$t$]::text[], 12);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$anatomy_amino_acid_metabolism$c$, $c$anatomy$c$, $c$anatomy_absorption_nutrition_and_metabolic_handling_of_nutrients$c$, $c$Amino acid metabolism and urea cycle$c$, $c$Outline transamination, oxidative deamination, and the urea cycle (liver) converting ammonia to urea for excretion, nitrogen balance concepts.$c$, ARRAY[$t$transamination$t$, $t$alanine aminotransferase$t$, $t$urea cycle$t$, $t$ammonia$t$, $t$glutamate dehydrogenase$t$, $t$nitrogen balance$t$]::text[], 13);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$anatomy_nutrient_requirements$c$, $c$anatomy$c$, $c$anatomy_absorption_nutrition_and_metabolic_handling_of_nutrients$c$, $c$Macronutrient and essential nutrient requirements$c$, $c$Define essential amino acids, essential fatty acids, vitamins, minerals, list recommended daily allowances for macronutrients and concept of nitrogen balance.$c$, ARRAY[$t$essential amino acids$t$, $t$omega-3/6$t$, $t$RDA$t$, $t$nitrogen balance$t$, $t$macronutrients$t$]::text[], 14);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$anatomy_primary_lymphoid_organs$c$, $c$anatomy$c$, $c$anatomy_immune_system_structure_and_innate_adaptive_roles$c$, $c$Primary lymphoid organs: bone marrow and thymus$c$, $c$Explain B cell development in bone marrow (including central tolerance) and T cell maturation in thymus (cortex/medulla), recognize thymic involution.$c$, ARRAY[$t$bone marrow$t$, $t$thymus$t$, $t$Hassall's corpuscles$t$, $t$B cell maturation$t$, $t$T cell maturation$t$]::text[], 0);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$anatomy_secondary_lymphoid_organs$c$, $c$anatomy$c$, $c$anatomy_immune_system_structure_and_innate_adaptive_roles$c$, $c$Secondary lymphoid organs: lymph nodes, spleen, MALT$c$, $c$Describe lymph node structure (follicle, germinal center, paracortex, medulla), spleen white/red pulp, and mucosa-associated lymphoid tissue (tonsils, Peyer's patches).$c$, ARRAY[$t$lymph node$t$, $t$germinal center$t$, $t$spleen white pulp$t$, $t$Peyer's patches$t$, $t$MALT$t$]::text[], 1);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$anatomy_leukocyte_types$c$, $c$anatomy$c$, $c$anatomy_immune_system_structure_and_innate_adaptive_roles$c$, $c$Leukocyte types and general functions$c$, $c$Classify neutrophils, eosinophils, basophils, monocytes/macrophages, dendritic cells, lymphocytes (B, T, NK), identify primary roles in innate/adaptive immunity.$c$, ARRAY[$t$neutrophil$t$, $t$eosinophil$t$, $t$basophil$t$, $t$monocyte$t$, $t$lymphocyte$t$, $t$NK cell$t$]::text[], 2);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$anatomy_innate_barriers$c$, $c$anatomy$c$, $c$anatomy_immune_system_structure_and_innate_adaptive_roles$c$, $c$Innate immunity barriers and antimicrobial factors$c$, $c$List physical (skin, mucous), chemical (lysozyme, defensins, stomach acid), and microbial barriers, describe roles of antimicrobial peptides and normal flora.$c$, ARRAY[$t$lysozyme$t$, $t$defensins$t$, $t$mucus$t$, $t$commensal bacteria$t$, $t$acid pH$t$]::text[], 3);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$anatomy_phagocytosis_tlrs$c$, $c$anatomy$c$, $c$anatomy_immune_system_structure_and_innate_adaptive_roles$c$, $c$Phagocytosis and pattern recognition receptors (TLRs)$c$, $c$Detail phagocytosis steps (chemotaxis, opsonization, ingestion, killing), identify TLRs and other PRRs recognizing PAMPs (LPS, peptidoglycan, dsRNA).$c$, ARRAY[$t$phagosome$t$, $t$phagolysosome$t$, $t$TLR4$t$, $t$PAMP$t$, $t$opsonization$t$, $t$respiratory burst$t$]::text[], 4);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$anatomy_inflammation_mediators$c$, $c$anatomy$c$, $c$anatomy_immune_system_structure_and_innate_adaptive_roles$c$, $c$Inflammatory response and mediators$c$, $c$Outline cardinal signs (rubor, tumor, calor, dolor), vascular changes (vasodilation, permeability), and key mediators: histamine, prostaglandins, leukotrienes, cytokines.$c$, ARRAY[$t$vasodilation$t$, $t$histamine$t$, $t$prostaglandins$t$, $t$leukotrienes$t$, $t$cytokines$t$, $t$selectins$t$]::text[], 5);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$anatomy_complement_system$c$, $c$anatomy$c$, $c$anatomy_immune_system_structure_and_innate_adaptive_roles$c$, $c$Complement system pathways and effectors$c$, $c$Compare classical (antibody), lectin (MBL), and alternative pathways, describe C3 convertase, MAC formation, opsonization (C3b), and anaphylatoxins (C3a, C5a).$c$, ARRAY[$t$C3 convertase$t$, $t$MAC$t$, $t$C3b$t$, $t$C5a$t$, $t$classical pathway$t$, $t$alternative pathway$t$]::text[], 6);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$anatomy_nk_cells$c$, $c$anatomy$c$, $c$anatomy_immune_system_structure_and_innate_adaptive_roles$c$, $c$Natural killer cells and missing-self recognition$c$, $c$Explain how NK cells detect lack of MHC I (missing self) via inhibitory receptors, kill via perforin/granzyme or FasL, ADCC via CD16.$c$, ARRAY[$t$NK cell$t$, $t$missing self$t$, $t$perforin$t$, $t$granzyme$t$, $t$ADCC$t$, $t$CD16$t$]::text[], 7);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$anatomy_mhc_antigen_presentation$c$, $c$anatomy$c$, $c$anatomy_immune_system_structure_and_innate_adaptive_roles$c$, $c$MHC class I and II in antigen presentation$c$, $c$Distinguish MHC I (all nucleated cells, presents endogenous antigens to CD8+ T cells) and MHC II (APCs, presents exogenous antigens to CD4+ T cells), describe peptide loading.$c$, ARRAY[$t$MHC I$t$, $t$MHC II$t$, $t$endogenous pathway$t$, $t$exogenous pathway$t$, $t$TAP$t$, $t$invariant chain$t$]::text[], 8);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$anatomy_dendritic_cells$c$, $c$anatomy$c$, $c$anatomy_immune_system_structure_and_innate_adaptive_roles$c$, $c$Dendritic cells as professional antigen-presenting cells$c$, $c$Describe immature DCs capturing antigen in tissues, maturing upon TLR signals, upregulating MHC II and costimulatory molecules, migrating to lymph nodes.$c$, ARRAY[$t$dendritic cell$t$, $t$Langerhans cell$t$, $t$costimulation$t$, $t$B7-CD28$t$, $t$CCR7$t$]::text[], 9);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$anatomy_t_cell_development$c$, $c$anatomy$c$, $c$anatomy_immune_system_structure_and_innate_adaptive_roles$c$, $c$T cell maturation and thymic selection$c$, $c$Outline positive selection (recognize self MHC) and negative selection (deletion of self-reactive) in thymus, CD4/CD8 lineage commitment.$c$, ARRAY[$t$positive selection$t$, $t$negative selection$t$, $t$CD4+$t$, $t$CD8+$t$, $t$AIRE$t$, $t$thymic epithelium$t$]::text[], 10);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$anatomy_cd4_helper_subsets$c$, $c$anatomy$c$, $c$anatomy_immune_system_structure_and_innate_adaptive_roles$c$, $c$CD4+ T helper cell subsets and cytokines$c$, $c$Describe Th1 (IFN-gamma, activate macrophages), Th2 (IL-4,5,13, help B cells), Th17 (IL-17, antifungal), Tfh (IL-21, germinal center), regulatory T cells (FoxP3).$c$, ARRAY[$t$Th1$t$, $t$Th2$t$, $t$Th17$t$, $t$Tfh$t$, $t$Treg$t$, $t$FoxP3$t$]::text[], 11);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$anatomy_cytotoxic_t_cells$c$, $c$anatomy$c$, $c$anatomy_immune_system_structure_and_innate_adaptive_roles$c$, $c$Cytotoxic T cell killing mechanisms$c$, $c$Detail CTL target cell killing: perforin/granzyme (pore formation, caspase activation) and Fas/FasL (apoptosis), MHC I-restricted recognition.$c$, ARRAY[$t$perforin$t$, $t$granzyme$t$, $t$FasL$t$, $t$caspase$t$, $t$apoptosis$t$, $t$CD8+$t$]::text[], 12);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$anatomy_b_cell_activation$c$, $c$anatomy$c$, $c$anatomy_immune_system_structure_and_innate_adaptive_roles$c$, $c$B cell activation and plasma cell differentiation$c$, $c$Describe T-dependent (CD40-CD40L, cytokine) and T-independent (TI-1, TI-2) activation, germinal center reaction, somatic hypermutation, class switching, memory B cells.$c$, ARRAY[$t$CD40$t$, $t$germinal center$t$, $t$somatic hypermutation$t$, $t$class switch recombination$t$, $t$AID$t$, $t$plasma cell$t$]::text[], 13);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$anatomy_antibody_structure_isotypes$c$, $c$anatomy$c$, $c$anatomy_immune_system_structure_and_innate_adaptive_roles$c$, $c$Immunoglobulin structure and isotype functions$c$, $c$Draw basic Ig structure (heavy/light chains, variable/constant, Fab/Fc), list five isotypes (IgG, IgM, IgA, IgE, IgD) and key functions (opsonization, complement, mucosal, allergy).$c$, ARRAY[$t$IgG$t$, $t$IgM$t$, $t$IgA$t$, $t$IgE$t$, $t$Fab$t$, $t$Fc$t$]::text[], 14);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$anatomy_primary_secondary_response$c$, $c$anatomy$c$, $c$anatomy_immune_response_disorders_and_disease_applications$c$, $c$Primary and secondary immune response kinetics$c$, $c$Compare lag, peak antibody titer, isotype (IgM then IgG), and magnitude, explain basis of immunological memory due to expanded memory B/T cells.$c$, ARRAY[$t$primary response$t$, $t$secondary response$t$, $t$IgM to IgG switch$t$, $t$memory cells$t$, $t$affinity maturation$t$]::text[], 0);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$anatomy_immunological_memory$c$, $c$anatomy$c$, $c$anatomy_immune_response_disorders_and_disease_applications$c$, $c$Immunological memory and long-term protection$c$, $c$Identify long-lived memory B, memory CD4+, and memory CD8+ T cells, describe rapid recall response and maintenance of protective antibody levels by plasma cells.$c$, ARRAY[$t$memory B cells$t$, $t$memory T cells$t$, $t$recall response$t$, $t$long-lived plasma cells$t$, $t$vaccination$t$]::text[], 1);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$anatomy_vaccine_types$c$, $c$anatomy$c$, $c$anatomy_immune_response_disorders_and_disease_applications$c$, $c$Vaccine types and immunization strategies$c$, $c$Classify vaccines: live attenuated, inactivated, subunit/conjugate, toxoid, mRNA, explain how each induces immunity without disease and need for boosters.$c$, ARRAY[$t$live attenuated$t$, $t$inactivated$t$, $t$subunit vaccine$t$, $t$mRNA vaccine$t$, $t$adjuvant$t$, $t$booster$t$]::text[], 2);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$anatomy_type1_hypersensitivity$c$, $c$anatomy$c$, $c$anatomy_immune_response_disorders_and_disease_applications$c$, $c$Type I hypersensitivity (IgE-mediated allergy)$c$, $c$Describe sensitization phase (IgE binding to mast cells), cross-linking on re-exposure, degranulation releasing histamine, leukotrienes, anaphylaxis treatment.$c$, ARRAY[$t$IgE$t$, $t$mast cell$t$, $t$histamine$t$, $t$anaphylaxis$t$, $t$epinephrine$t$, $t$allergen$t$]::text[], 3);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$anatomy_type2_hypersensitivity$c$, $c$anatomy$c$, $c$anatomy_immune_response_disorders_and_disease_applications$c$, $c$Type II hypersensitivity (antibody-mediated cytotoxicity)$c$, $c$Explain antibodies against cell-surface antigens leading to complement lysis or ADCC, examples: hemolytic disease of newborn, autoimmune hemolytic anemia.$c$, ARRAY[$t$Rh incompatibility$t$, $t$Goodpasture syndrome$t$, $t$ADCC$t$, $t$complement lysis$t$, $t$IgG/IgM$t$]::text[], 4);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$anatomy_type3_hypersensitivity$c$, $c$anatomy$c$, $c$anatomy_immune_response_disorders_and_disease_applications$c$, $c$Type III hypersensitivity (immune complex disease)$c$, $c$Deposition of soluble antigen-antibody complexes in tissues (vessel walls, glomeruli) causing inflammation, examples: serum sickness, SLE nephritis.$c$, ARRAY[$t$immune complexes$t$, $t$serum sickness$t$, $t$lupus nephritis$t$, $t$type III$t$, $t$vasculitis$t$]::text[], 5);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$anatomy_type4_hypersensitivity$c$, $c$anatomy$c$, $c$anatomy_immune_response_disorders_and_disease_applications$c$, $c$Type IV hypersensitivity (delayed-type, cell-mediated)$c$, $c$T cell-mediated: sensitized CD4+ Th1 cells release cytokines recruiting macrophages (e.g., TB granuloma) or CD8+ direct killing (contact dermatitis).$c$, ARRAY[$t$Th1$t$, $t$granuloma$t$, $t$contact dermatitis$t$, $t$Mantoux test$t$, $t$delayed-type$t$]::text[], 6);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$anatomy_autoimmunity_mechanisms$c$, $c$anatomy$c$, $c$anatomy_immune_response_disorders_and_disease_applications$c$, $c$Autoimmune disease mechanisms and examples$c$, $c$Describe breakdown of central/peripheral tolerance (molecular mimicry, bystander activation), give examples: Type 1 diabetes (beta-cell destruction), SLE, rheumatoid arthritis.$c$, ARRAY[$t$self-tolerance$t$, $t$molecular mimicry$t$, $t$AIRE$t$, $t$Type 1 diabetes$t$, $t$SLE$t$, $t$rheumatoid arthritis$t$]::text[], 7);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$anatomy_immunodeficiency_disorders$c$, $c$anatomy$c$, $c$anatomy_immune_response_disorders_and_disease_applications$c$, $c$Immunodeficiency disorders: primary and acquired$c$, $c$Contrast congenital (SCID, X-linked agammaglobulinemia) vs acquired (HIV/AIDS, malnutrition, immunosuppressive drugs), note infections characteristic of each defect.$c$, ARRAY[$t$SCID$t$, $t$XLA$t$, $t$HIV$t$, $t$opportunistic infections$t$, $t$Bruton's tyrosine kinase$t$]::text[], 8);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$anatomy_hiv_pathogenesis$c$, $c$anatomy$c$, $c$anatomy_immune_response_disorders_and_disease_applications$c$, $c$HIV replication and CD4+ T cell depletion$c$, $c$Describe HIV entry (gp120-CD4, coreceptors CCR5/CXCR4), reverse transcription, integration, budding, CD4+ decline leading to AIDS, monitor viral load, CD4 count.$c$, ARRAY[$t$gp120$t$, $t$CD4$t$, $t$CCR5$t$, $t$reverse transcriptase$t$, $t$integrase$t$, $t$protease$t$]::text[], 9);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$anatomy_immune_response_bacteria$c$, $c$anatomy$c$, $c$anatomy_immune_response_disorders_and_disease_applications$c$, $c$Immune response to bacterial pathogens$c$, $c$Describe extracellular bacteria: antibody opsonization, complement, phagocytosis, intracellular: Th1 activation of macrophages, examples like Streptococcus, Mycobacterium.$c$, ARRAY[$t$opsonization$t$, $t$complement$t$, $t$Th1$t$, $t$macrophage activation$t$, $t$IFN-gamma$t$]::text[], 10);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$anatomy_immune_response_viruses$c$, $c$anatomy$c$, $c$anatomy_immune_response_disorders_and_disease_applications$c$, $c$Antiviral immune response and interferons$c$, $c$Detail type I IFN production by infected cells, NK cell killing, CTL killing of infected cells, neutralizing antibodies blocking viral entry.$c$, ARRAY[$t$IFN-alpha/beta$t$, $t$NK cells$t$, $t$CTL$t$, $t$neutralizing antibody$t$, $t$MHC I presentation$t$]::text[], 11);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$anatomy_immunodiagnostics$c$, $c$anatomy$c$, $c$anatomy_immune_response_disorders_and_disease_applications$c$, $c$ELISA and Western blot immunodiagnostic methods$c$, $c$Interpret direct, indirect, sandwich ELISA for antigen/antibody detection, Western blot for confirmatory protein detection (e.g., HIV).$c$, ARRAY[$t$ELISA$t$, $t$sandwich ELISA$t$, $t$Western blot$t$, $t$primary antibody$t$, $t$secondary antibody$t$, $t$enzyme conjugate$t$]::text[], 12);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$anatomy_transplant_rejection$c$, $c$anatomy$c$, $c$anatomy_immune_response_disorders_and_disease_applications$c$, $c$Transplant rejection types and MHC matching$c$, $c$Classify hyperacute (preformed antibodies), acute (cellular/humoral), chronic rejection, explain graft-versus-host disease and importance of HLA matching and immunosuppression.$c$, ARRAY[$t$hyperacute rejection$t$, $t$acute rejection$t$, $t$chronic rejection$t$, $t$GVHD$t$, $t$HLA$t$, $t$calcineurin inhibitors$t$]::text[], 13);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$anatomy_cancer_immunoediting$c$, $c$anatomy$c$, $c$anatomy_immune_response_disorders_and_disease_applications$c$, $c$Cancer immunoediting and checkpoint inhibitor therapy$c$, $c$Outline three Es: elimination, equilibrium, escape, describe immune checkpoint blockade (anti-CTLA-4, anti-PD-1/PD-L1) releasing T cell inhibition against tumors.$c$, ARRAY[$t$immunoediting$t$, $t$CTLA-4$t$, $t$PD-1$t$, $t$PD-L1$t$, $t$immune evasion$t$, $t$melanoma$t$]::text[], 14);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$water_quality_estuary_definition_and_classification$c$, $c$water_quality$c$, $c$water_quality_marine_and_estuarine_habitats_and_zonation$c$, $c$Estuary definition and geomorphic classification$c$, $c$Define an estuary as a semi-enclosed coastal body of water with a free connection to the sea and measurable dilution by freshwater. Classify by geomorphology: drowned river valley, bar-built, tectonic, and fjord.$c$, ARRAY[$t$estuary$t$, $t$drowned river valley$t$, $t$bar-built$t$, $t$tectonic$t$, $t$fjord$t$, $t$geomorphology$t$]::text[], 0);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$water_quality_estuarine_circulation_types$c$, $c$water_quality$c$, $c$water_quality_marine_and_estuarine_habitats_and_zonation$c$, $c$Estuarine circulation patterns$c$, $c$Distinguish salt-wedge, partially mixed, well-mixed, and fjord circulation based on stratification and freshwater input. Explain how tidal forcing and river flow control the mixing regime.$c$, ARRAY[$t$salt-wedge$t$, $t$partially mixed$t$, $t$well-mixed$t$, $t$fjord circulation$t$, $t$stratification$t$, $t$tidal mixing$t$]::text[], 1);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$water_quality_intertidal_zonation_rocky_shore$c$, $c$water_quality$c$, $c$water_quality_marine_and_estuarine_habitats_and_zonation$c$, $c$Intertidal zonation of rocky shores$c$, $c$Identify spray/supralittoral, upper, middle, lower intertidal, and subtidal zones on rocky shores based on tidal exposure and characteristic organisms (e.g., barnacle line, mussel bed).$c$, ARRAY[$t$supralittoral$t$, $t$upper intertidal$t$, $t$middle intertidal$t$, $t$lower intertidal$t$, $t$barnacle line$t$, $t$zonation$t$]::text[], 2);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$water_quality_intertidal_zonation_sandy_beach$c$, $c$water_quality$c$, $c$water_quality_marine_and_estuarine_habitats_and_zonation$c$, $c$Intertidal zonation of sandy beaches$c$, $c$Describe zonation of sandy beaches including beach wrack, swash zone, and distribution of infauna such as sand crabs, polychaetes, and bivalves, contrast exposed vs. sheltered beaches.$c$, ARRAY[$t$swash zone$t$, $t$beach wrack$t$, $t$sand crab$t$, $t$polychaete$t$, $t$exposed beach$t$, $t$sheltered beach$t$]::text[], 3);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$water_quality_pelagic_depth_zones$c$, $c$water_quality$c$, $c$water_quality_marine_and_estuarine_habitats_and_zonation$c$, $c$Pelagic depth zones (epipelagic to hadal)$c$, $c$Define pelagic zones by depth and light penetration: epipelagic (0-200 m), mesopelagic (200-1000 m), bathypelagic (1000-4000 m), abyssopelagic (4000-6000 m), and hadal (>6000 m).$c$, ARRAY[$t$epipelagic$t$, $t$mesopelagic$t$, $t$bathypelagic$t$, $t$abyssopelagic$t$, $t$hadal$t$, $t$photic zone$t$]::text[], 4);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$water_quality_benthic_zones$c$, $c$water_quality$c$, $c$water_quality_marine_and_estuarine_habitats_and_zonation$c$, $c$Benthic zonation (littoral to hadal)$c$, $c$Distinguish benthic zones: supralittoral, littoral (intertidal), sublittoral (continental shelf), bathyal (slope), abyssal (abyssal plain), and hadal (trenches).$c$, ARRAY[$t$supralittoral$t$, $t$littoral$t$, $t$sublittoral$t$, $t$bathyal$t$, $t$abyssal$t$, $t$hadal$t$]::text[], 5);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$water_quality_coral_reef_types$c$, $c$water_quality$c$, $c$water_quality_marine_and_estuarine_habitats_and_zonation$c$, $c$Coral reef types and formation$c$, $c$Compare fringing, barrier, and atoll reefs, explain Darwin's subsidence theory and reef zonation (fore reef, reef crest, back reef).$c$, ARRAY[$t$fringing reef$t$, $t$barrier reef$t$, $t$atoll$t$, $t$Darwin's subsidence$t$, $t$reef zonation$t$, $t$fore reef$t$]::text[], 6);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$water_quality_mangrove_habitat_and_zonation$c$, $c$water_quality$c$, $c$water_quality_marine_and_estuarine_habitats_and_zonation$c$, $c$Mangrove habitat and species zonation$c$, $c$Identify mangrove zonation from seaward to landward (red mangrove Rhizophora, black mangrove Avicennia, white mangrove Laguncularia) and associated adaptations to tidal flooding and salinity.$c$, ARRAY[$t$Rhizophora$t$, $t$Avicennia$t$, $t$Laguncularia$t$, $t$pneumatophores$t$, $t$salt exclusion$t$, $t$vivipary$t$]::text[], 7);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$water_quality_salt_marsh_structure_and_zonation$c$, $c$water_quality$c$, $c$water_quality_marine_and_estuarine_habitats_and_zonation$c$, $c$Salt marsh structure and zonation$c$, $c$Describe low marsh (dominated by Spartina alterniflora) and high marsh (Spartina patens, Juncus) zones, tidal creek networks, and the role of flooding frequency in determining plant distribution.$c$, ARRAY[$t$low marsh$t$, $t$high marsh$t$, $t$Spartina alterniflora$t$, $t$Spartina patens$t$, $t$salinity$t$, $t$tidal creek$t$]::text[], 8);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$water_quality_seagrass_meadow_ecology$c$, $c$water_quality$c$, $c$water_quality_marine_and_estuarine_habitats_and_zonation$c$, $c$Seagrass meadow ecology and zonation$c$, $c$Identify common seagrass species (eelgrass Zostera marina, turtle grass Thalassia testudinum) and their depth zonation limited by light attenuation, recognize seagrasses as ecosystem engineers that stabilize sediment and provide nursery habitat.$c$, ARRAY[$t$Zostera marina$t$, $t$Thalassia testudinum$t$, $t$light attenuation$t$, $t$rhizome$t$, $t$ecosystem engineer$t$, $t$seagrass bed$t$]::text[], 9);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$water_quality_kelp_forest_structure$c$, $c$water_quality$c$, $c$water_quality_marine_and_estuarine_habitats_and_zonation$c$, $c$Kelp forest structure and canopy layers$c$, $c$Describe vertical structure of kelp forests: canopy (Macrocystis, Nereocystis), understory, and holdfast, explain environmental requirements (hard substrate, light, nutrient-rich upwelling).$c$, ARRAY[$t$Macrocystis$t$, $t$Nereocystis$t$, $t$canopy$t$, $t$holdfast$t$, $t$light$t$, $t$nutrient upwelling$t$]::text[], 10);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$water_quality_hydrothermal_vent_communities$c$, $c$water_quality$c$, $c$water_quality_marine_and_estuarine_habitats_and_zonation$c$, $c$Hydrothermal vent communities and chemosynthesis$c$, $c$Describe vent fauna (giant tube worms Riftia pachyptila, clams, shrimp) that rely on chemosynthetic bacteria oxidizing hydrogen sulfide, explain black smoker fluid chemistry and mineral chimney formation.$c$, ARRAY[$t$black smoker$t$, $t$Riftia pachyptila$t$, $t$chemosynthesis$t$, $t$hydrogen sulfide$t$, $t$thermophilic$t$, $t$vent zonation$t$]::text[], 11);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$water_quality_cold_seep_ecosystems$c$, $c$water_quality$c$, $c$water_quality_marine_and_estuarine_habitats_and_zonation$c$, $c$Cold seep ecosystems and authigenic carbonate$c$, $c$Explain methane seep communities supported by chemosynthetic symbionts, identify indicator species such as bathymodiolid mussels and vestimentiferan tube worms, describe formation of authigenic carbonate rocks.$c$, ARRAY[$t$cold seep$t$, $t$methane$t$, $t$Beggiatoa$t$, $t$bathymodiolid mussels$t$, $t$authigenic carbonate$t$, $t$chemosynthesis$t$]::text[], 12);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$water_quality_tidal_patterns_and_zonation$c$, $c$water_quality$c$, $c$water_quality_marine_and_estuarine_habitats_and_zonation$c$, $c$Tidal patterns and spring-neap cycles$c$, $c$Differentiate diurnal, semidiurnal, and mixed tidal regimes, explain spring and neap tides in relation to sun-moon alignment, relate tidal range to the vertical extent of intertidal zonation.$c$, ARRAY[$t$diurnal tide$t$, $t$semidiurnal$t$, $t$mixed tide$t$, $t$spring tide$t$, $t$neap tide$t$, $t$tidal range$t$]::text[], 13);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$water_quality_estuarine_salinity_zones$c$, $c$water_quality$c$, $c$water_quality_marine_and_estuarine_habitats_and_zonation$c$, $c$Estuarine salinity zones and mixing$c$, $c$Classify estuarine regions by salinity: oligohaline (0-5 ppt), mesohaline (5-18 ppt), polyhaline (18-30 ppt), and euhaline (>30 ppt), describe the longitudinal salinity gradient.$c$, ARRAY[$t$oligohaline$t$, $t$mesohaline$t$, $t$polyhaline$t$, $t$euhaline$t$, $t$salinity gradient$t$, $t$estuary$t$]::text[], 14);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$water_quality_seawater_salinity_composition$c$, $c$water_quality$c$, $c$water_quality_physical_and_chemical_properties_of_seawater$c$, $c$Seawater salinity: composition and definition$c$, $c$Define salinity as total dissolved solids (g/kg), list major ions (Cl-, Na+, SO4^2-, Mg2+, Ca2+, K+) and state the rule of constant proportions (Marcet's principle).$c$, ARRAY[$t$salinity$t$, $t$ppt$t$, $t$psu$t$, $t$major ions$t$, $t$constant proportions$t$, $t$chlorinity$t$]::text[], 0);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$water_quality_salinity_measurement_methods$c$, $c$water_quality$c$, $c$water_quality_physical_and_chemical_properties_of_seawater$c$, $c$Salinity measurement techniques$c$, $c$Compare conductivity-based methods (CTD, salinometer), optical refractometer, and chemical titration (Mohr-Knudsen chlorinity) for determining salinity, convert between practical salinity units and chlorinity.$c$, ARRAY[$t$conductivity$t$, $t$CTD$t$, $t$refractometer$t$, $t$chlorinity titration$t$, $t$salinometer$t$, $t$practical salinity$t$]::text[], 1);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$water_quality_temperature_structure_thermocline$c$, $c$water_quality$c$, $c$water_quality_physical_and_chemical_properties_of_seawater$c$, $c$Temperature structure: mixed layer and thermocline$c$, $c$Describe the seasonal thermocline, permanent thermocline, surface mixed layer, and deep isothermal layer, interpret temperature-depth profiles and calculate mixed layer depth.$c$, ARRAY[$t$thermocline$t$, $t$mixed layer$t$, $t$seasonal thermocline$t$, $t$isothermal$t$, $t$temperature profile$t$, $t$SST$t$]::text[], 2);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$water_quality_halocline_salinity_stratification$c$, $c$water_quality$c$, $c$water_quality_physical_and_chemical_properties_of_seawater$c$, $c$Halocline and salinity stratification$c$, $c$Define halocline as a rapid vertical change in salinity, explain formation by freshwater input or ice melt, and identify its role in estuarine and ocean stratification.$c$, ARRAY[$t$halocline$t$, $t$salinity stratification$t$, $t$freshwater lens$t$, $t$pycnocline$t$, $t$profile$t$, $t$mixing barrier$t$]::text[], 3);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$water_quality_density_stratification_pycnocline$c$, $c$water_quality$c$, $c$water_quality_physical_and_chemical_properties_of_seawater$c$, $c$Density stratification and pycnocline$c$, $c$Explain how temperature and salinity control seawater density (sigma-t), define pycnocline as a density gradient that inhibits vertical mixing, calculate potential density.$c$, ARRAY[$t$sigma-t$t$, $t$density$t$, $t$pycnocline$t$, $t$stratification$t$, $t$potential density$t$, $t$mixing$t$]::text[], 4);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$water_quality_light_penetration_euphotic_zone$c$, $c$water_quality$c$, $c$water_quality_physical_and_chemical_properties_of_seawater$c$, $c$Light penetration and euphotic depth$c$, $c$Describe exponential attenuation of light with depth, define euphotic zone as depth where PAR reaches 1% of surface value, relate Secchi disk depth to light attenuation coefficient.$c$, ARRAY[$t$euphotic zone$t$, $t$Secchi depth$t$, $t$attenuation coefficient$t$, $t$photic zone$t$, $t$turbidity$t$, $t$PAR$t$]::text[], 5);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$water_quality_sound_speed_sofar_channel$c$, $c$water_quality$c$, $c$water_quality_physical_and_chemical_properties_of_seawater$c$, $c$Sound speed in seawater and SOFAR channel$c$, $c$Explain how temperature, salinity, and pressure affect sound speed, identify the SOFAR channel as a depth of minimum sound speed that enables long-range propagation.$c$, ARRAY[$t$sound speed$t$, $t$SOFAR channel$t$, $t$thermocline effect$t$, $t$pressure effect$t$, $t$sonar$t$, $t$refraction$t$]::text[], 6);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$water_quality_hydrostatic_pressure$c$, $c$water_quality$c$, $c$water_quality_physical_and_chemical_properties_of_seawater$c$, $c$Hydrostatic pressure and depth relationship$c$, $c$Calculate hydrostatic pressure increase with depth (approx. 1 atm per 10 m), explain effects on organism physiology and engineering constraints.$c$, ARRAY[$t$hydrostatic pressure$t$, $t$depth$t$, $t$atm$t$, $t$pressure gradient$t$, $t$compressibility$t$, $t$deep-sea$t$]::text[], 7);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$water_quality_dissolved_oxygen_omz$c$, $c$water_quality$c$, $c$water_quality_physical_and_chemical_properties_of_seawater$c$, $c$Dissolved oxygen and oxygen minimum zone$c$, $c$Describe oxygen solubility dependence on temperature and salinity, explain formation of the oxygen minimum zone (OMZ) by organic matter respiration and limited ventilation at intermediate depths.$c$, ARRAY[$t$dissolved oxygen$t$, $t$oxygen minimum zone$t$, $t$OMZ$t$, $t$solubility$t$, $t$respiration$t$, $t$hypoxia$t$]::text[], 8);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$water_quality_carbonate_system_equilibrium$c$, $c$water_quality$c$, $c$water_quality_physical_and_chemical_properties_of_seawater$c$, $c$Carbonate system: CO2 equilibrium species$c$, $c$Write the equilibrium series CO2(aq) + H2O <-> H2CO3 <-> HCO3- + H+ <-> CO3^2- + 2H+, calculate the relative proportions of bicarbonate and carbonate at typical seawater pH 8.1.$c$, ARRAY[$t$CO2(aq)$t$, $t$HCO3-$t$, $t$CO3^2-$t$, $t$carbonic acid$t$, $t$pH$t$, $t$bicarbonate$t$]::text[], 9);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$water_quality_pH_alkalinity_buffering$c$, $c$water_quality$c$, $c$water_quality_physical_and_chemical_properties_of_seawater$c$, $c$pH, alkalinity, and buffering capacity$c$, $c$Define total alkalinity as acid-neutralizing capacity, explain seawater buffering by the carbonate and borate systems, identify alkalinity as a conservative tracer.$c$, ARRAY[$t$pH$t$, $t$total alkalinity$t$, $t$buffer$t$, $t$borate$t$, $t$carbonate alkalinity$t$, $t$acid titration$t$]::text[], 10);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$water_quality_ocean_acidification_impacts$c$, $c$water_quality$c$, $c$water_quality_physical_and_chemical_properties_of_seawater$c$, $c$Ocean acidification: CO2 uptake and carbonate saturation$c$, $c$Describe the decrease in pH and carbonate ion concentration due to anthropogenic CO2, explain aragonite and calcite saturation states (?) and their thresholds for calcifying organisms.$c$, ARRAY[$t$ocean acidification$t$, $t$aragonite saturation$t$, $t$calcite saturation$t$, $t$pCO2$t$, $t$calcifiers$t$, $t$pH decrease$t$]::text[], 11);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$water_quality_nutrient_profiles_nitrate_phosphate$c$, $c$water_quality$c$, $c$water_quality_physical_and_chemical_properties_of_seawater$c$, $c$Nutrient profiles: nitrate, phosphate, silicate$c$, $c$Describe typical vertical profiles of nitrate, phosphate, and silicate (surface depletion, deep enrichment), link to biological uptake in the photic zone and regeneration at depth.$c$, ARRAY[$t$nitrate$t$, $t$phosphate$t$, $t$silicate$t$, $t$nutrient profile$t$, $t$regeneration$t$, $t$biological pump$t$]::text[], 12);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$water_quality_redfield_ratio_nutrient_limitation$c$, $c$water_quality$c$, $c$water_quality_physical_and_chemical_properties_of_seawater$c$, $c$Redfield ratio and nutrient limitation$c$, $c$Apply the Redfield ratio C:N:P 106:16:1 to determine which nutrient limits primary production, state Liebig's Law of the Minimum and recognize nitrogen and phosphorus as common limiting nutrients.$c$, ARRAY[$t$Redfield ratio$t$, $t$106:16:1$t$, $t$nitrogen limitation$t$, $t$phosphorus limitation$t$, $t$Liebig's Law$t$, $t$stoichiometry$t$]::text[], 13);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$water_quality_trace_metals_micronutrients$c$, $c$water_quality$c$, $c$water_quality_physical_and_chemical_properties_of_seawater$c$, $c$Trace metals and micronutrient limitation$c$, $c$Explain iron limitation in High-Nutrient Low-Chlorophyll (HNLC) regions, describe the role of trace metals (Fe, Zn, Co) as enzyme cofactors and the input of iron via aeolian dust.$c$, ARRAY[$t$iron limitation$t$, $t$HNLC$t$, $t$trace metal$t$, $t$aeolian dust$t$, $t$cofactor$t$, $t$phytoplankton$t$]::text[], 14);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$water_quality_ts_diagram_water_masses$c$, $c$water_quality$c$, $c$water_quality_physical_and_chemical_properties_of_seawater$c$, $c$T-S diagrams and water mass identification$c$, $c$Interpret temperature-salinity (T-S) diagrams to identify distinct water masses, use density contours (isopycnals) to assess mixing and water mass formation.$c$, ARRAY[$t$T-S diagram$t$, $t$water mass$t$, $t$thermohaline$t$, $t$density sigma-t$t$, $t$potential temperature$t$, $t$mixing$t$]::text[], 15);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$water_quality_upwelling_processes$c$, $c$water_quality$c$, $c$water_quality_physical_and_chemical_properties_of_seawater$c$, $c$Upwelling processes and water properties$c$, $c$Describe wind-driven coastal upwelling via Ekman transport, producing cold, nutrient-rich surface water, identify major upwelling regions and characteristic sea surface temperature anomalies.$c$, ARRAY[$t$upwelling$t$, $t$Ekman transport$t$, $t$nutrient enrichment$t$, $t$cold water$t$, $t$SST anomaly$t$, $t$coastal upwelling$t$]::text[], 16);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$water_quality_plankton_classification$c$, $c$water_quality$c$, $c$water_quality_marine_and_estuarine_organisms_and_adaptations$c$, $c$Plankton classification: phyto-, zooplankton, and size spectra$c$, $c$Distinguish phytoplankton, zooplankton, and bacterioplankton, classify by size from femtoplankton (<0.2 um) to megaplankton (>20 cm) and explain the concept of meroplankton vs. holoplankton.$c$, ARRAY[$t$phytoplankton$t$, $t$zooplankton$t$, $t$picoplankton$t$, $t$nanoplankton$t$, $t$microplankton$t$, $t$meroplankton$t$]::text[], 0);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$water_quality_diatoms_siliceous_frustules$c$, $c$water_quality$c$, $c$water_quality_marine_and_estuarine_organisms_and_adaptations$c$, $c$Diatoms: siliceous frustules and ecological role$c$, $c$Identify diatom cell structure with two-valve silica frustule (centric and pennate forms), explain their importance as primary producers and their role in the silica cycle.$c$, ARRAY[$t$diatom$t$, $t$frustule$t$, $t$centric$t$, $t$pennate$t$, $t$silica$t$, $t$primary producer$t$]::text[], 1);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$water_quality_dinoflagellates_characteristics$c$, $c$water_quality$c$, $c$water_quality_marine_and_estuarine_organisms_and_adaptations$c$, $c$Dinoflagellates: flagella, bioluminescence, and HABs$c$, $c$Describe dinoflagellate traits: two flagella, cellulosic thecal plates, bioluminescence, and role in harmful algal blooms (red tides, paralytic shellfish poisoning).$c$, ARRAY[$t$dinoflagellate$t$, $t$flagella$t$, $t$bioluminescence$t$, $t$harmful algal bloom$t$, $t$red tide$t$, $t$theca$t$]::text[], 2);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$water_quality_coccolithophores_calcite_plates$c$, $c$water_quality$c$, $c$water_quality_marine_and_estuarine_organisms_and_adaptations$c$, $c$Coccolithophores: calcareous plates and carbon cycle$c$, $c$Recognize coccolithophores covered by calcium carbonate coccoliths, explain their contribution to the carbonate pump, ocean albedo via blooms (Emiliania huxleyi), and paleoclimate records.$c$, ARRAY[$t$coccolithophore$t$, $t$coccolith$t$, $t$CaCO3$t$, $t$carbonate pump$t$, $t$albedo$t$, $t$Emiliania huxleyi$t$]::text[], 3);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$water_quality_copepods_krill_zooplankton$c$, $c$water_quality$c$, $c$water_quality_marine_and_estuarine_organisms_and_adaptations$c$, $c$Key zooplankton: copepods and krill$c$, $c$Describe copepod anatomy, life cycle, and role as a major link between phytoplankton and fish, highlight Antarctic krill (Euphausia superba) as a keystone prey for whales, seals, and penguins.$c$, ARRAY[$t$copepod$t$, $t$krill$t$, $t$Euphausia superba$t$, $t$calanoid$t$, $t$zooplankton$t$, $t$antarctic food web$t$]::text[], 4);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$water_quality_coral_zooxanthellae_symbiosis$c$, $c$water_quality$c$, $c$water_quality_marine_and_estuarine_organisms_and_adaptations$c$, $c$Coral-zooxanthellae symbiosis and bleaching$c$, $c$Explain the mutualistic symbiosis between coral polyps and dinoflagellate algae Symbiodinium, describe how thermal or light stress leads to expulsion of symbionts and coral bleaching.$c$, ARRAY[$t$coral polyp$t$, $t$zooxanthellae$t$, $t$Symbiodinium$t$, $t$bleaching$t$, $t$mutualism$t$, $t$calcification$t$]::text[], 5);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$water_quality_mangrove_adaptations$c$, $c$water_quality$c$, $c$water_quality_marine_and_estuarine_organisms_and_adaptations$c$, $c$Mangrove adaptations: aerial roots and salt management$c$, $c$Identify pneumatophores, prop roots, and knee roots, describe salt exclusion at roots, salt excretion via leaf glands, and viviparous seedlings (propagules).$c$, ARRAY[$t$pneumatophores$t$, $t$prop roots$t$, $t$salt glands$t$, $t$vivipary$t$, $t$hypocotyl$t$, $t$halophyte$t$]::text[], 6);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$water_quality_salt_marsh_halophyte_adaptations$c$, $c$water_quality$c$, $c$water_quality_marine_and_estuarine_organisms_and_adaptations$c$, $c$Salt marsh plant adaptations to salinity and anoxia$c$, $c$Describe halophyte traits: aerenchyma for oxygen transport to roots, salt secretion via salt bladders or glands, succulence, and osmoregulation, use Spartina alterniflora and Salicornia as examples.$c$, ARRAY[$t$halophyte$t$, $t$aerenchyma$t$, $t$salt secretion$t$, $t$succulence$t$, $t$Spartina$t$, $t$Salicornia$t$]::text[], 7);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$water_quality_seagrass_biology$c$, $c$water_quality$c$, $c$water_quality_marine_and_estuarine_organisms_and_adaptations$c$, $c$Seagrass biology: submerged flowering plants$c$, $c$Identify seagrasses as angiosperms with rhizomes, strap-like leaves, and underwater pollination (hydrophily), explain adaptations to soft anoxic sediments and importance as ecosystem engineers.$c$, ARRAY[$t$seagrass$t$, $t$hydrophily$t$, $t$rhizome$t$, $t$aerenchyma$t$, $t$Zostera$t$, $t$flowering underwater$t$]::text[], 8);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$water_quality_osmoregulation_marine_estuarine_fish$c$, $c$water_quality$c$, $c$water_quality_marine_and_estuarine_organisms_and_adaptations$c$, $c$Osmoregulation in marine and estuarine fish$c$, $c$Compare osmoregulatory strategies: marine teleosts drink seawater and excrete excess ions via chloride cells in gills, euryhaline species (e.g., salmon, bull shark) adjust between freshwater and saltwater environments.$c$, ARRAY[$t$osmoregulation$t$, $t$chloride cells$t$, $t$euryhaline$t$, $t$stenohaline$t$, $t$ion transport$t$, $t$salinity tolerance$t$]::text[], 9);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$water_quality_buoyancy_mechanisms$c$, $c$water_quality$c$, $c$water_quality_marine_and_estuarine_organisms_and_adaptations$c$, $c$Buoyancy mechanisms in marine organisms$c$, $c$Explain buoyancy adaptations: swim bladder gas regulation in teleost fish, lipid storage in sharks (squalene) and copepods (wax esters), gas-filled floats in siphonophores, and ammonia-rich fluids in squids.$c$, ARRAY[$t$swim bladder$t$, $t$lipid buoyancy$t$, $t$gas gland$t$, $t$squalene$t$, $t$siphonophore$t$, $t$neutral buoyancy$t$]::text[], 10);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$water_quality_deep_sea_adaptations$c$, $c$water_quality$c$, $c$water_quality_marine_and_estuarine_organisms_and_adaptations$c$, $c$Deep-sea adaptations: bioluminescence and gigantism$c$, $c$Describe deep-sea adaptations including bioluminescence for counterillumination and prey attraction, large sensitive eyes, slow metabolism, deep-sea gigantism, and pressure-resistant enzymes.$c$, ARRAY[$t$bioluminescence$t$, $t$deep-sea gigantism$t$, $t$piezophile$t$, $t$photophore$t$, $t$large eyes$t$, $t$low metabolism$t$]::text[], 11);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$water_quality_intertidal_adaptations$c$, $c$water_quality$c$, $c$water_quality_marine_and_estuarine_organisms_and_adaptations$c$, $c$Intertidal organism adaptations to desiccation and waves$c$, $c$Identify structural and behavioral adaptations: byssal threads and holdfasts for attachment, closing shells to reduce water loss, hiding in crevices, and physiological tolerance to temperature and salinity extremes.$c$, ARRAY[$t$desiccation tolerance$t$, $t$byssus$t$, $t$holdfast$t$, $t$shell closing$t$, $t$crevice$t$, $t$thermal stress$t$]::text[], 12);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$water_quality_marine_mammal_diving_adaptations$c$, $c$water_quality$c$, $c$water_quality_marine_and_estuarine_organisms_and_adaptations$c$, $c$Marine mammal diving physiology$c$, $c$Explain adaptations for prolonged dives: high myoglobin concentrations in muscle, bradycardia, peripheral vasoconstriction, collapsible lungs, and efficient blood oxygen storage.$c$, ARRAY[$t$myoglobin$t$, $t$bradycardia$t$, $t$dive reflex$t$, $t$blood oxygen$t$, $t$apnea$t$, $t$marine mammal$t$]::text[], 13);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$water_quality_nekton_fish_body_forms$c$, $c$water_quality$c$, $c$water_quality_marine_and_estuarine_organisms_and_adaptations$c$, $c$Nektonic fish body forms and locomotion$c$, $c$Relate fusiform, laterally compressed, and depressed body shapes to swimming speed and habitat, describe anguilliform, carangiform, and thunniform swimming modes and energy efficiency.$c$, ARRAY[$t$fusiform$t$, $t$carangiform$t$, $t$thunniform$t$, $t$anguilliform$t$, $t$body shape$t$, $t$swimming$t$]::text[], 14);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$water_quality_trophic_levels_food_chain$c$, $c$water_quality$c$, $c$water_quality_food_webs_productivity_and_nutrient_cycling$c$, $c$Trophic levels and marine food chains$c$, $c$Classify organisms into trophic levels: primary producers, primary consumers, secondary consumers, and apex predators, construct simple grazing and detrital food chains.$c$, ARRAY[$t$trophic level$t$, $t$primary producer$t$, $t$consumer$t$, $t$apex predator$t$, $t$food chain$t$, $t$energy transfer$t$]::text[], 0);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$water_quality_primary_productivity_measurement$c$, $c$water_quality$c$, $c$water_quality_food_webs_productivity_and_nutrient_cycling$c$, $c$Primary productivity: GPP, NPP, light-dark bottle method$c$, $c$Define gross primary productivity (GPP) and net primary productivity (NPP), explain measurement using dissolved oxygen changes in light and dark bottles incubated in situ.$c$, ARRAY[$t$GPP$t$, $t$NPP$t$, $t$light bottle$t$, $t$dark bottle$t$, $t$dissolved oxygen$t$, $t$respiration$t$]::text[], 1);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$water_quality_chlorophyll_a_productivity_proxy$c$, $c$water_quality$c$, $c$water_quality_food_webs_productivity_and_nutrient_cycling$c$, $c$Chlorophyll-a as productivity proxy and remote sensing$c$, $c$Use extracted chlorophyll-a concentration as a proxy for phytoplankton biomass, interpret satellite ocean color imagery (SeaWiFS, MODIS) to map surface productivity.$c$, ARRAY[$t$chlorophyll-a$t$, $t$fluorometry$t$, $t$ocean color$t$, $t$remote sensing$t$, $t$SeaWiFS$t$, $t$MODIS$t$]::text[], 2);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$water_quality_limiting_nutrients_liebig$c$, $c$water_quality$c$, $c$water_quality_food_webs_productivity_and_nutrient_cycling$c$, $c$Limiting nutrients and Liebig's Law of the Minimum$c$, $c$Apply Liebig's Law: growth is limited by the nutrient in shortest supply relative to demand, identify nitrogen, phosphorus, and iron as common limiting nutrients in different ocean regions.$c$, ARRAY[$t$Liebig's Law$t$, $t$nitrogen limitation$t$, $t$phosphorus limitation$t$, $t$iron limitation$t$, $t$nutrient bioassay$t$, $t$growth limitation$t$]::text[], 3);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$water_quality_redfield_ratio_stoichiometry$c$, $c$water_quality$c$, $c$water_quality_food_webs_productivity_and_nutrient_cycling$c$, $c$Redfield ratio and nutrient stoichiometry$c$, $c$Use the Redfield ratio C:N:P 106:16:1 to assess nutrient limitation, calculate elemental ratios from measured nutrient concentrations and interpret deviations.$c$, ARRAY[$t$Redfield ratio$t$, $t$106:16:1$t$, $t$C:N:P$t$, $t$stoichiometry$t$, $t$nitrate:phosphate$t$, $t$particulate organic matter$t$]::text[], 4);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$water_quality_marine_nitrogen_cycle$c$, $c$water_quality$c$, $c$water_quality_food_webs_productivity_and_nutrient_cycling$c$, $c$Marine nitrogen cycle: fixation, nitrification, denitrification$c$, $c$Describe transformations: nitrogen fixation by cyanobacteria (Trichodesmium), nitrification (NH4+ -> NO3-), denitrification and anammox in oxygen-minimum zones.$c$, ARRAY[$t$nitrogen fixation$t$, $t$nitrification$t$, $t$denitrification$t$, $t$anammox$t$, $t$Trichodesmium$t$, $t$nitrate$t$]::text[], 5);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$water_quality_marine_phosphorus_cycle$c$, $c$water_quality$c$, $c$water_quality_food_webs_productivity_and_nutrient_cycling$c$, $c$Marine phosphorus cycle: sources and sinks$c$, $c$Explain phosphate uptake, regeneration from organic matter, and ultimate burial as apatite, identify phosphorus limitation in oligotrophic subtropical gyres.$c$, ARRAY[$t$phosphate$t$, $t$apatite$t$, $t$regeneration$t$, $t$upwelling$t$, $t$aeolian input$t$, $t$phosphorus burial$t$]::text[], 6);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$water_quality_silicon_cycle_diatoms$c$, $c$water_quality$c$, $c$water_quality_food_webs_productivity_and_nutrient_cycling$c$, $c$Silicon cycle and diatom utilization$c$, $c$Describe uptake of dissolved silica by diatoms for frustule construction, regeneration via dissolution of biogenic opal, and silica limitation in the equatorial Pacific.$c$, ARRAY[$t$silicate$t$, $t$diatom frustule$t$, $t$biogenic silica$t$, $t$silica dissolution$t$, $t$opal$t$, $t$Si limitation$t$]::text[], 7);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$water_quality_microbial_loop$c$, $c$water_quality$c$, $c$water_quality_food_webs_productivity_and_nutrient_cycling$c$, $c$Microbial loop: bacterial processing of DOM$c$, $c$Explain how bacterioplankton consume dissolved organic matter (DOM), are grazed by nanoflagellates and ciliates, thereby channeling carbon back into the classical food web.$c$, ARRAY[$t$microbial loop$t$, $t$DOM$t$, $t$bacterioplankton$t$, $t$nanoflagellate$t$, $t$ciliate$t$, $t$heterotrophic bacteria$t$]::text[], 8);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$water_quality_detrital_food_web_estuary$c$, $c$water_quality$c$, $c$water_quality_food_webs_productivity_and_nutrient_cycling$c$, $c$Detrital food web in estuaries$c$, $c$Describe detritus-based pathways: decomposition of vascular plant litter (mangrove, marsh) by microbes and fungi, consumption by detritivores, and the importance of detritus in estuarine energy flow.$c$, ARRAY[$t$detritus$t$, $t$detritivore$t$, $t$marsh detritus$t$, $t$decomposition$t$, $t$infauna$t$, $t$estuarine food web$t$]::text[], 9);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$water_quality_biological_pump_carbon_export$c$, $c$water_quality$c$, $c$water_quality_food_webs_productivity_and_nutrient_cycling$c$, $c$Biological pump: carbon export to deep sea$c$, $c$Explain sinking of particulate organic carbon (POC) as marine snow and fecal pellets, the associated drawdown of atmospheric CO2, and the long-term sequestration of carbon in deep waters.$c$, ARRAY[$t$biological pump$t$, $t$POC$t$, $t$marine snow$t$, $t$fecal pellets$t$, $t$carbon export$t$, $t$sequestration$t$]::text[], 10);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$water_quality_upwelling_productivity$c$, $c$water_quality$c$, $c$water_quality_food_webs_productivity_and_nutrient_cycling$c$, $c$Upwelling systems and high primary productivity$c$, $c$Link coastal upwelling (e.g., Peru, California, Benguela currents) and equatorial upwelling to nutrient supply, elevated chlorophyll, and highly productive fisheries.$c$, ARRAY[$t$upwelling$t$, $t$Peru Current$t$, $t$Benguela$t$, $t$California Current$t$, $t$nutrient supply$t$, $t$fisheries$t$]::text[], 11);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$water_quality_eutrophication_hypoxia$c$, $c$water_quality$c$, $c$water_quality_food_webs_productivity_and_nutrient_cycling$c$, $c$Eutrophication and hypoxia in coastal waters$c$, $c$Explain how excess nutrient input drives algal blooms, subsequent microbial decomposition consumes oxygen, and leads to hypoxia (<2 mg/L DO) or anoxia, creating dead zones.$c$, ARRAY[$t$eutrophication$t$, $t$hypoxia$t$, $t$dead zone$t$, $t$nutrient loading$t$, $t$algal bloom$t$, $t$oxygen depletion$t$]::text[], 12);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$water_quality_seasonal_bloom_dynamics$c$, $c$water_quality$c$, $c$water_quality_food_webs_productivity_and_nutrient_cycling$c$, $c$Seasonal phytoplankton bloom dynamics$c$, $c$Explain the critical depth hypothesis (Sverdrup) for the spring bloom initiation, describe the interplay of light, mixing depth, and nutrients that controls bloom timing and succession.$c$, ARRAY[$t$spring bloom$t$, $t$critical depth$t$, $t$Sverdrup$t$, $t$mixed layer depth$t$, $t$light limitation$t$, $t$succession$t$]::text[], 13);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$water_quality_chemosynthetic_food_webs_vents$c$, $c$water_quality$c$, $c$water_quality_food_webs_productivity_and_nutrient_cycling$c$, $c$Chemosynthetic food webs at hydrothermal vents$c$, $c$Describe chemosynthetic primary production using reduced compounds (H2S, CH4) by free-living and symbiotic bacteria, supporting unique vent communities in the absence of sunlight.$c$, ARRAY[$t$chemosynthesis$t$, $t$H2S$t$, $t$vent bacteria$t$, $t$Riftia symbiosis$t$, $t$primary production$t$, $t$sulfide oxidation$t$]::text[], 14);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$water_quality_key_water_quality_parameters$c$, $c$water_quality$c$, $c$water_quality_water_monitoring_indicators_and_lab_analysis$c$, $c$Key water quality parameters for marine/estuarine systems$c$, $c$List the core parameters: temperature, salinity, dissolved oxygen, pH, turbidity, nutrients (nitrate, phosphate), chlorophyll-a, and fecal coliform, understand their typical ranges and monitoring significance.$c$, ARRAY[$t$temperature$t$, $t$salinity$t$, $t$DO$t$, $t$pH$t$, $t$turbidity$t$, $t$chlorophyll-a$t$]::text[], 0);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$water_quality_secchi_disk_turbidity$c$, $c$water_quality$c$, $c$water_quality_water_monitoring_indicators_and_lab_analysis$c$, $c$Secchi disk and turbidity measurement$c$, $c$Measure water clarity using a Secchi disk, relate Secchi depth to turbidity (NTU) and the light attenuation coefficient, interpret as an indicator of suspended solids and algal biomass.$c$, ARRAY[$t$Secchi disk$t$, $t$turbidity$t$, $t$NTU$t$, $t$attenuation$t$, $t$visibility$t$, $t$euphotic depth$t$]::text[], 1);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$water_quality_dissolved_oxygen_measurement_winkler$c$, $c$water_quality$c$, $c$water_quality_water_monitoring_indicators_and_lab_analysis$c$, $c$Dissolved oxygen measurement: Winkler titration and electrode$c$, $c$Describe the Winkler method (manganous sulfate, alkaline iodide, azide modification, thiosulfate titration) and electrochemical/optical DO probes, compare accuracy, detection limit, and field suitability.$c$, ARRAY[$t$Winkler titration$t$, $t$DO probe$t$, $t$manganous sulfate$t$, $t$thiosulfate$t$, $t$electrode$t$, $t$optical DO$t$]::text[], 2);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$water_quality_bod5_test$c$, $c$water_quality$c$, $c$water_quality_water_monitoring_indicators_and_lab_analysis$c$, $c$Biochemical oxygen demand (BOD5) test$c$, $c$Explain the 5-day BOD test: measure initial DO, incubate in the dark at 20 degC for 5 days, then measure final DO, interpret the difference as organic matter load.$c$, ARRAY[$t$BOD5$t$, $t$biochemical oxygen demand$t$, $t$20 degC$t$, $t$5-day$t$, $t$organic pollution$t$, $t$DO depletion$t$]::text[], 3);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$water_quality_salinity_measurement_lab$c$, $c$water_quality$c$, $c$water_quality_water_monitoring_indicators_and_lab_analysis$c$, $c$Salinity measurement: conductivity, refractometer, chloride titration$c$, $c$Determine salinity using a conductivity meter (PSU scale), handheld refractometer, and Mohr titration for chlorinity with silver nitrate and potassium chromate indicator.$c$, ARRAY[$t$conductivity$t$, $t$refractometer$t$, $t$Mohr titration$t$, $t$chlorinity$t$, $t$silver nitrate$t$, $t$potassium chromate$t$]::text[], 4);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$water_quality_pH_measurement$c$, $c$water_quality$c$, $c$water_quality_water_monitoring_indicators_and_lab_analysis$c$, $c$pH measurement: electrode and colorimetric methods$c$, $c$Use a pH meter with glass electrode calibrated with NBS buffers, interpret color changes of indicators (bromothymol blue, phenolphthalein) for approximate pH estimation.$c$, ARRAY[$t$pH meter$t$, $t$glass electrode$t$, $t$buffer calibration$t$, $t$bromothymol blue$t$, $t$indicator$t$, $t$NBS scale$t$]::text[], 5);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$water_quality_nitrate_analysis_cadmium_reduction$c$, $c$water_quality$c$, $c$water_quality_water_monitoring_indicators_and_lab_analysis$c$, $c$Nitrate analysis by cadmium reduction and spectrophotometry$c$, $c$Reduce nitrate to nitrite with a cadmium column, diazotize with sulfanilamide, couple with N-(1-naphthyl)-ethylenediamine to form an azo dye, measure absorbance at 543 nm.$c$, ARRAY[$t$cadmium reduction$t$, $t$nitrate$t$, $t$sulfanilamide$t$, $t$NED$t$, $t$azo dye$t$, $t$543 nm$t$]::text[], 6);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$water_quality_phosphate_analysis_ascorbic_acid$c$, $c$water_quality$c$, $c$water_quality_water_monitoring_indicators_and_lab_analysis$c$, $c$Phosphate analysis by ascorbic acid method$c$, $c$React orthophosphate with ammonium molybdate and ascorbic acid to form phosphomolybdenum blue, measure absorbance at 880 nm and report as orthophosphate-P.$c$, ARRAY[$t$ascorbic acid method$t$, $t$phosphate$t$, $t$molybdenum blue$t$, $t$ammonium molybdate$t$, $t$880 nm$t$, $t$orthophosphate$t$]::text[], 7);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$water_quality_chlorophyll_extraction_fluorometry$c$, $c$water_quality$c$, $c$water_quality_water_monitoring_indicators_and_lab_analysis$c$, $c$Chlorophyll-a extraction and fluorometry$c$, $c$Filter water, extract pigments with 90% acetone, measure fluorescence before and after acidification to correct for phaeopigments, calculate chlorophyll-a concentration.$c$, ARRAY[$t$chlorophyll-a$t$, $t$acetone extraction$t$, $t$fluorometer$t$, $t$acidification$t$, $t$phaeopigment$t$, $t$Turner design$t$]::text[], 8);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$water_quality_fecal_coliform_testing$c$, $c$water_quality$c$, $c$water_quality_water_monitoring_indicators_and_lab_analysis$c$, $c$Fecal coliform detection: membrane filtration and MPN$c$, $c$Use membrane filtration with mFC agar at 44.5 degC to enumerate fecal coliform colonies, explain the Most Probable Number (MPN) method and interpret results for recreational water quality.$c$, ARRAY[$t$fecal coliform$t$, $t$membrane filtration$t$, $t$mFC agar$t$, $t$44.5 degC$t$, $t$MPN$t$, $t$indicator bacteria$t$]::text[], 9);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$water_quality_benthic_index_estuary$c$, $c$water_quality$c$, $c$water_quality_water_monitoring_indicators_and_lab_analysis$c$, $c$Benthic macroinvertebrate indices for estuarine health$c$, $c$Apply multi-metric indices such as AMBI (AZTI's Marine Biotic Index) or Benthic IBI to assess pollution and habitat quality based on benthic community composition.$c$, ARRAY[$t$AMBI$t$, $t$B-IBI$t$, $t$benthic index$t$, $t$pollution tolerance$t$, $t$macroinvertebrate$t$, $t$bioassessment$t$]::text[], 10);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$water_quality_indicator_species_estuarine$c$, $c$water_quality$c$, $c$water_quality_water_monitoring_indicators_and_lab_analysis$c$, $c$Indicator species for estuarine water quality$c$, $c$Identify pollution-tolerant species (e.g., Capitella capitata) and sensitive taxa (e.g., certain amphipods, eelgrass) as biological indicators to infer sediment and water quality.$c$, ARRAY[$t$Capitella capitata$t$, $t$Amphipoda$t$, $t$indicator species$t$, $t$eelgrass$t$, $t$sentinel$t$, $t$bioindicator$t$]::text[], 11);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$water_quality_water_quality_index_calculation$c$, $c$water_quality$c$, $c$water_quality_water_monitoring_indicators_and_lab_analysis$c$, $c$Water Quality Index (WQI) calculation$c$, $c$Compute a WQI (e.g., NSF WQI) using weighted sub-indices for parameters such as DO, pH, BOD, temperature, and nutrients, interpret the final score to classify water quality.$c$, ARRAY[$t$WQI$t$, $t$sub-index$t$, $t$weighting$t$, $t$rating curve$t$, $t$water quality class$t$, $t$NSF WQI$t$]::text[], 12);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$water_quality_sampling_techniques_niskin$c$, $c$water_quality$c$, $c$water_quality_water_monitoring_indicators_and_lab_analysis$c$, $c$Sampling techniques: Niskin bottle and depth profiling$c$, $c$Use a Niskin bottle rosette to collect discrete water samples at specific depths, describe CTD profiling, sample preservation (ice, filtration), and field parameter measurement.$c$, ARRAY[$t$Niskin bottle$t$, $t$rosette$t$, $t$CTD$t$, $t$depth profile$t$, $t$sample preservation$t$, $t$Go-Flo$t$]::text[], 13);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$water_quality_lab_quality_assurance$c$, $c$water_quality$c$, $c$water_quality_water_monitoring_indicators_and_lab_analysis$c$, $c$Lab quality assurance and quality control$c$, $c$Apply replicates, method blanks, certified standards, calibration curves, and spike recovery tests, calculate precision, accuracy, method detection limit, and control charts.$c$, ARRAY[$t$QA/QC$t$, $t$calibration curve$t$, $t$blank$t$, $t$standard$t$, $t$precision$t$, $t$accuracy$t$]::text[], 14);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$water_quality_nutrient_pollution_eutrophication$c$, $c$water_quality$c$, $c$water_quality_human_impacts_pollution_and_restoration$c$, $c$Nutrient pollution and coastal eutrophication$c$, $c$Explain sources of excess nitrogen and phosphorus (agricultural runoff, sewage) leading to eutrophication symptoms: algal blooms, reduced water clarity, and shifts in ecosystem structure.$c$, ARRAY[$t$nutrient pollution$t$, $t$fertilizer$t$, $t$sewage$t$, $t$algal bloom$t$, $t$nitrate$t$, $t$phosphate$t$]::text[], 0);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$water_quality_hypoxia_dead_zones$c$, $c$water_quality$c$, $c$water_quality_human_impacts_pollution_and_restoration$c$, $c$Hypoxia and dead zones in coastal waters$c$, $c$Describe formation of seasonal hypoxic zones (<2 mg/L DO) due to nutrient-fueled algal blooms and stratification, analyze the Gulf of Mexico dead zone as a case study.$c$, ARRAY[$t$hypoxia$t$, $t$dead zone$t$, $t$Gulf of Mexico$t$, $t$stratification$t$, $t$nutrient loading$t$, $t$oxygen depletion$t$]::text[], 1);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$water_quality_oil_spill_impacts_remediation$c$, $c$water_quality$c$, $c$water_quality_human_impacts_pollution_and_restoration$c$, $c$Oil spill impacts and remediation techniques$c$, $c$Outline physical (booms, skimmers, in-situ burning) and chemical (dispersants) cleanup methods, explain bioremediation using hydrocarbon-degrading bacteria and trade-offs of each approach.$c$, ARRAY[$t$oil spill$t$, $t$booms$t$, $t$dispersant$t$, $t$skimmer$t$, $t$bioremediation$t$, $t$hydrocarbon-degrading bacteria$t$]::text[], 2);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$water_quality_microplastic_pollution$c$, $c$water_quality$c$, $c$water_quality_human_impacts_pollution_and_restoration$c$, $c$Microplastic pollution: sources and ecological effects$c$, $c$Identify primary (microbeads, fibers) and secondary (fragmented debris) microplastics, describe ingestion by marine organisms, trophic transfer, and vector for adsorbed pollutants (POPs).$c$, ARRAY[$t$microplastic$t$, $t$primary microplastic$t$, $t$fiber$t$, $t$ingestion$t$, $t$trophic transfer$t$, $t$POP adsorption$t$]::text[], 3);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$water_quality_heavy_metal_mercury_biomagnification$c$, $c$water_quality$c$, $c$water_quality_human_impacts_pollution_and_restoration$c$, $c$Heavy metal pollution: mercury and biomagnification$c$, $c$Explain sources of mercury (coal combustion, artisanal mining), microbial methylation to methylmercury, and its biomagnification in marine food webs leading to human health risks (Minamata disease).$c$, ARRAY[$t$mercury$t$, $t$methylmercury$t$, $t$biomagnification$t$, $t$bioaccumulation$t$, $t$Minamata$t$, $t$neurotoxin$t$]::text[], 4);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$water_quality_persistent_organic_pollutants$c$, $c$water_quality$c$, $c$water_quality_human_impacts_pollution_and_restoration$c$, $c$Persistent organic pollutants: DDT, PCBs, dioxins$c$, $c$Describe POPs characteristics: persistence, lipophilicity, long-range transport, illustrate bioaccumulation and impacts (e.g., DDT-induced eggshell thinning in birds, endocrine disruption).$c$, ARRAY[$t$DDT$t$, $t$PCBs$t$, $t$dioxins$t$, $t$bioaccumulation$t$, $t$biomagnification$t$, $t$endocrine disruptor$t$]::text[], 5);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$water_quality_sewage_pathogen_indicators$c$, $c$water_quality$c$, $c$water_quality_human_impacts_pollution_and_restoration$c$, $c$Sewage pollution and pathogen indicators$c$, $c$Discuss sewage contamination assessed by fecal indicator bacteria (fecal coliform, enterococci), link to waterborne disease outbreaks, shellfish bed closures, and beach advisories.$c$, ARRAY[$t$sewage$t$, $t$fecal coliform$t$, $t$enterococci$t$, $t$pathogen$t$, $t$shellfish bed closure$t$, $t$beach advisory$t$]::text[], 6);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$water_quality_ocean_acidification_impacts_calcifiers$c$, $c$water_quality$c$, $c$water_quality_human_impacts_pollution_and_restoration$c$, $c$Ocean acidification impacts on calcifying organisms$c$, $c$Explain how reduced carbonate ion concentration and lower aragonite saturation state decrease calcification rates in corals, pteropods, foraminifera, and coralline algae.$c$, ARRAY[$t$ocean acidification$t$, $t$aragonite undersaturation$t$, $t$calcification$t$, $t$pteropod$t$, $t$coral$t$, $t$carbonate ion$t$]::text[], 7);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$water_quality_coral_bleaching_thermal_stress$c$, $c$water_quality$c$, $c$water_quality_human_impacts_pollution_and_restoration$c$, $c$Coral bleaching: thermal stress and zooxanthellae expulsion$c$, $c$Describe mechanism: elevated sea surface temperature causes oxidative stress in Symbiodinium, leading to breakdown of symbiosis and loss of pigment, link to mass bleaching events and climate change.$c$, ARRAY[$t$coral bleaching$t$, $t$thermal stress$t$, $t$SST anomaly$t$, $t$Symbiodinium$t$, $t$oxidative stress$t$, $t$mass bleaching$t$]::text[], 8);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$water_quality_invasive_species_ballast_water$c$, $c$water_quality$c$, $c$water_quality_human_impacts_pollution_and_restoration$c$, $c$Invasive marine species and ballast water introduction$c$, $c$Identify pathways (ballast water, hull fouling) and high-impact invaders (lionfish Pterois, European green crab Carcinus maenas), describe ecological and economic consequences.$c$, ARRAY[$t$ballast water$t$, $t$lionfish$t$, $t$Carcinus maenas$t$, $t$invasive species$t$, $t$ecological impact$t$, $t$biocontrol$t$]::text[], 9);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$water_quality_coastal_habitat_loss_trawling_sea_level$c$, $c$water_quality$c$, $c$water_quality_human_impacts_pollution_and_restoration$c$, $c$Coastal habitat loss: trawling, development, and sea level rise$c$, $c$Describe destruction of benthic habitat by bottom trawling and dredging, loss of mangroves and seagrasses to coastal urbanization, and wetland drowning due to sea level rise and coastal squeeze.$c$, ARRAY[$t$bottom trawling$t$, $t$coastal development$t$, $t$sea level rise$t$, $t$mangrove loss$t$, $t$coastal squeeze$t$, $t$erosion$t$]::text[], 10);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$water_quality_overfishing_bycatch$c$, $c$water_quality$c$, $c$water_quality_human_impacts_pollution_and_restoration$c$, $c$Overfishing and bycatch$c$, $c$Define maximum sustainable yield (MSY) and overexploitation, discuss bycatch of non-target species (sea turtles, dolphins, sharks) and cascading trophic effects of removing top predators.$c$, ARRAY[$t$overfishing$t$, $t$bycatch$t$, $t$MSY$t$, $t$fishery collapse$t$, $t$trophic cascade$t$, $t$discards$t$]::text[], 11);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$water_quality_marine_protected_areas$c$, $c$water_quality$c$, $c$water_quality_human_impacts_pollution_and_restoration$c$, $c$Marine Protected Areas (MPAs) and fisheries management$c$, $c$Design MPAs: no-take zones, size, connectivity, evaluate evidence for biodiversity increase, fish stock spillover, and larval export, relate to ecosystem-based management.$c$, ARRAY[$t$MPA$t$, $t$no-take zone$t$, $t$connectivity$t$, $t$spillover$t$, $t$biodiversity$t$, $t$fishery management$t$]::text[], 12);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$water_quality_coral_reef_restoration$c$, $c$water_quality$c$, $c$water_quality_human_impacts_pollution_and_restoration$c$, $c$Coral reef restoration techniques$c$, $c$Explain coral gardening, microfragmentation, artificial reef deployment, and larval enhancement, discuss genetic diversity and scalability challenges.$c$, ARRAY[$t$coral gardening$t$, $t$microfragmentation$t$, $t$artificial reef$t$, $t$larval enhancement$t$, $t$coral restoration$t$, $t$nursery$t$]::text[], 13);
INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES
  ($c$water_quality_mangrove_seagrass_restoration$c$, $c$water_quality$c$, $c$water_quality_human_impacts_pollution_and_restoration$c$, $c$Mangrove and seagrass restoration techniques$c$, $c$Describe replanting of mangroves and seagrasses, hydrological restoration to reestablish tidal flow, and use of living shorelines, identify success indicators such as habitat function and erosion control.$c$, ARRAY[$t$restoration$t$, $t$mangrove planting$t$, $t$seagrass restoration$t$, $t$living shoreline$t$, $t$ecosystem services$t$, $t$hydrological restoration$t$]::text[], 14);

-- END SEED: 245 concepts | PASTE-CHECK: SCIOLY-0803C-NO-SEMI
