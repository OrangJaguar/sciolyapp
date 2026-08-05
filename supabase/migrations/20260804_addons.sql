-- ============================================================================
-- scioly.app — All post-initial addons (Plans 03–17)
-- PASTE-CHECK: SCIOLY-0804-ADDONS
-- Run AFTER 20260803_initial.sql on a fresh project (postgres role).
-- Already-applied DBs: do NOT re-run this whole file; only run new addons.
-- ============================================================================


-- >>> BEGIN 20260804_progression.sql >>>
-- scioly.app — Plan 03 progression support
-- Additive. Safe to run after 20260803_initial.sql.
-- Rank titles are derived from XP on the client (and later in RPCs).
-- Mirror award constants from src/lib/progression.ts when writing Plan 09+ RPCs.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS last_activity_on DATE;

COMMENT ON COLUMN public.profiles.xp IS
  'Authoritative progression currency. Rank = f(xp); do not invent ad-hoc awards.';
COMMENT ON COLUMN public.profiles.rank_title IS
  'Legacy/display cache only. Prefer derive: level=floor(xp/100)+1 → Recruit/Specialist/Tactician/Master/National Legend.';
COMMENT ON COLUMN public.profiles.current_streak IS
  'Consecutive UTC calendar days with graded activity. Does not multiply XP (MVP).';
COMMENT ON COLUMN public.profiles.last_activity_on IS
  'UTC date (YYYY-MM-DD) of last graded activity; used for streak updates.';

-- XP award mirror (documentation for RPC authors — not enforced by Postgres):
-- casual_correct 10 | casual_incorrect 2 | clinic_do 5
-- timed_correct 12 | timed_incorrect 2 | mission_complete 50
-- <<< END 20260804_progression.sql <<<


-- >>> BEGIN 20260804_seed_questions.sql >>>
-- ============================================================================
-- scioly.app — Plan 04 test question seed
-- PASTE-CHECK: SCIOLY-0804-QSEED
-- 24 live MCQs (12 chem_lab, 6 anatomy, 6 water_quality)
-- Correct keys shuffled (not all A) — re-run replaces prior seed:plan04
-- Prerequisites: 20260803 taxonomy + 20260804 progression
-- ============================================================================

DELETE FROM public.questions WHERE citation = 'seed:plan04';

INSERT INTO public.questions (
  season_ids, division, event_id, topic_id, concept_id,
  question_type, status, stem, options, correct_key, explanation, citation
) VALUES
  (
    '{2027}'::int[], 'C',
    $q$chem_lab$q$, $q$chem_lab_gas_variables_and_named_gas_laws$q$, $q$chem_lab_boyles_law$q$,
    'mcq', 'live',
    $q$A fixed amount of ideal gas is held at constant temperature. If the volume is halved, what happens to the pressure?$q$,
    jsonb_build_object('A', $q$It quadruples$q$, 'B', $q$It doubles$q$, 'C', $q$It halves$q$, 'D', $q$It stays the same$q$),
    $q$B$q$,
    $q$Boyle's law: P1V1 = P2V2 at constant n and T. Halving V doubles P.$q$,
    'seed:plan04'
  ),
  (
    '{2027}'::int[], 'C',
    $q$chem_lab$q$, $q$chem_lab_gas_variables_and_named_gas_laws$q$, $q$chem_lab_boyles_law$q$,
    'mcq', 'live',
    $q$Which statement best describes Boyle's law for a fixed amount of gas at constant temperature?$q$,
    jsonb_build_object('A', $q$Volume and temperature are inversely related$q$, 'B', $q$Pressure and temperature are inversely related$q$, 'C', $q$Pressure and volume are inversely related$q$, 'D', $q$Pressure and volume are directly related$q$),
    $q$C$q$,
    $q$At constant n,T, P is proportional to 1/V (inverse relationship).$q$,
    'seed:plan04'
  ),
  (
    '{2027}'::int[], 'C',
    $q$chem_lab$q$, $q$chem_lab_ideal_gas_law_stoichiometry_and_gas_calculations$q$, $q$chem_lab_ideal_gas_law_equation$q$,
    'mcq', 'live',
    $q$Which equation is the ideal gas law?$q$,
    jsonb_build_object('A', $q$P1V1 = P2V2$q$, 'B', $q$V1/T1 = V2/T2$q$, 'C', $q$rate1/rate2 = sqrt(M2/M1)$q$, 'D', $q$PV = nRT$q$),
    $q$D$q$,
    $q$The ideal gas law relates pressure, volume, moles, and absolute temperature: PV = nRT.$q$,
    'seed:plan04'
  ),
  (
    '{2027}'::int[], 'C',
    $q$chem_lab$q$, $q$chem_lab_ideal_gas_law_stoichiometry_and_gas_calculations$q$, $q$chem_lab_universal_gas_constant_R$q$,
    'mcq', 'live',
    $q$When P is in atm and V is in liters, which value of R is appropriate for PV = nRT with T in kelvin?$q$,
    jsonb_build_object('A', $q$0.0821 L?atm/(mol?K)$q$, 'B', $q$8.314 J/(mol?K) only$q$, 'C', $q$1.987 cal/(mol?K) only$q$, 'D', $q$62.4 L?mmHg/(mol?K) for atm units$q$),
    $q$A$q$,
    $q$R = 0.0821 L?atm/(mol?K) matches P in atm and V in L.$q$,
    'seed:plan04'
  ),
  (
    '{2027}'::int[], 'C',
    $q$chem_lab$q$, $q$chem_lab_kinetic_molecular_theory_and_particle_behavior$q$, $q$chem_lab_km_postulates$q$,
    'mcq', 'live',
    $q$According to kinetic molecular theory for an ideal gas, collisions between particles are:$q$,
    jsonb_build_object('A', $q$Only possible with container walls, not other particles$q$, 'B', $q$Elastic (no net loss of kinetic energy)$q$, 'C', $q$Inelastic (kinetic energy is always lost)$q$, 'D', $q$Forbidden$q$),
    $q$B$q$,
    $q$KMT assumes elastic collisions among particles and with walls.$q$,
    'seed:plan04'
  ),
  (
    '{2027}'::int[], 'C',
    $q$chem_lab$q$, $q$chem_lab_kinetic_molecular_theory_and_particle_behavior$q$, $q$chem_lab_temperature_and_average_kinetic_energy$q$,
    'mcq', 'live',
    $q$For an ideal gas, absolute temperature is proportional to:$q$,
    jsonb_build_object('A', $q$The volume of each particle$q$, 'B', $q$The number of moles only$q$, 'C', $q$Average kinetic energy of the particles$q$, 'D', $q$Average potential energy between particles$q$),
    $q$C$q$,
    $q$KMT: average KE is proportional to absolute temperature T.$q$,
    'seed:plan04'
  ),
  (
    '{2027}'::int[], 'C',
    $q$chem_lab$q$, $q$chem_lab_reaction_rates_and_rate_laws$q$, $q$chem_lab_reaction_rate_definition$q$,
    'mcq', 'live',
    $q$The average rate of disappearance of reactant A is often written as -Delta[A]/Deltat. Why is the negative sign used?$q$,
    jsonb_build_object('A', $q$Because rates are always negative by definition$q$, 'B', $q$To convert moles to molarity$q$, 'C', $q$To cancel stoichiometric coefficients$q$, 'D', $q$So the reported rate is a positive quantity as [A] decreases$q$),
    $q$D$q$,
    $q$Concentration of a reactant falls, so Delta[A] is negative, the minus sign makes rate positive.$q$,
    'seed:plan04'
  ),
  (
    '{2027}'::int[], 'C',
    $q$chem_lab$q$, $q$chem_lab_reaction_rates_and_rate_laws$q$, $q$chem_lab_rate_law_and_reaction_order$q$,
    'mcq', 'live',
    $q$For rate = k[A]^2[B], what is the overall reaction order?$q$,
    jsonb_build_object('A', $q$3$q$, 'B', $q$2$q$, 'C', $q$1$q$, 'D', $q$0$q$),
    $q$A$q$,
    $q$Overall order is the sum of exponents: 2 + 1 = 3.$q$,
    'seed:plan04'
  ),
  (
    '{2027}'::int[], 'C',
    $q$chem_lab$q$, $q$chem_lab_factors_affecting_reaction_rates$q$, $q$chem_lab_collision_theory$q$,
    'mcq', 'live',
    $q$Collision theory says a reaction requires collisions with sufficient energy and:$q$,
    jsonb_build_object('A', $q$A catalyst in every collision$q$, 'B', $q$Proper molecular orientation$q$, 'C', $q$Zero activation energy$q$, 'D', $q$Identical molecular masses$q$),
    $q$B$q$,
    $q$Effective collisions need E >= Ea and correct orientation.$q$,
    'seed:plan04'
  ),
  (
    '{2027}'::int[], 'C',
    $q$chem_lab$q$, $q$chem_lab_factors_affecting_reaction_rates$q$, $q$chem_lab_activation_energy_and_energy_profiles$q$,
    'mcq', 'live',
    $q$On a reaction energy profile, the activation energy Ea for the forward reaction is best described as:$q$,
    jsonb_build_object('A', $q$Always equal to DeltaH of reaction$q$, 'B', $q$The energy of the products only$q$, 'C', $q$The energy difference from reactants to the transition state$q$, 'D', $q$The energy difference from reactants to products$q$),
    $q$C$q$,
    $q$Ea(forward) is the barrier height from reactants up to the activated complex/transition state.$q$,
    'seed:plan04'
  ),
  (
    '{2027}'::int[], 'C',
    $q$chem_lab$q$, $q$chem_lab_lab_methods_graphs_and_experimental_analysis$q$, $q$chem_lab_manometer_and_barometer_operation$q$,
    'mcq', 'live',
    $q$A mercury barometer measures:$q$,
    jsonb_build_object('A', $q$Gauge pressure of a closed gas sample only$q$, 'B', $q$Temperature of mercury$q$, 'C', $q$Humidity only$q$, 'D', $q$Atmospheric pressure$q$),
    $q$D$q$,
    $q$A barometer measures atmospheric pressure via mercury column height.$q$,
    'seed:plan04'
  ),
  (
    '{2027}'::int[], 'C',
    $q$chem_lab$q$, $q$chem_lab_lab_methods_graphs_and_experimental_analysis$q$, $q$chem_lab_gas_volume_measurement_techniques$q$,
    'mcq', 'live',
    $q$Collecting a gas by water displacement typically uses which piece of glassware to read volume?$q$,
    jsonb_build_object('A', $q$A graduated cylinder (or eudiometer) inverted over water$q$, 'B', $q$A volumetric pipette only$q$, 'C', $q$A buret filled with acid$q$, 'D', $q$A thermometer stem$q$),
    $q$A$q$,
    $q$Water displacement commonly uses an inverted graduated cylinder or eudiometer to measure gas volume.$q$,
    'seed:plan04'
  ),
  (
    '{2027}'::int[], 'C',
    $q$anatomy$q$, $q$anatomy_respiratory_anatomy_and_mechanics$q$, $q$anatomy_upper_respiratory_anatomy$q$,
    'mcq', 'live',
    $q$Which structure is part of the upper respiratory tract?$q$,
    jsonb_build_object('A', $q$Pleural cavity space itself$q$, 'B', $q$Larynx$q$, 'C', $q$Alveoli$q$, 'D', $q$Primary bronchioles only deep in the lung$q$),
    $q$B$q$,
    $q$Upper airway includes nose/nasal cavity, pharynx, and larynx, before the trachea descends into the lower tract.$q$,
    'seed:plan04'
  ),
  (
    '{2027}'::int[], 'C',
    $q$anatomy$q$, $q$anatomy_gas_exchange_transport_and_blood_ph$q$, $q$anatomy_ficks_law_diffusion$q$,
    'mcq', 'live',
    $q$Fick's law of diffusion implies gas exchange across the respiratory membrane increases when:$q$,
    jsonb_build_object('A', $q$Partial pressure gradient becomes zero$q$, 'B', $q$Only blood viscosity changes$q$, 'C', $q$Surface area increases and membrane thickness decreases$q$, 'D', $q$Surface area decreases and membrane thickness increases$q$),
    $q$C$q$,
    $q$Diffusion rate rises with area and partial-pressure gradient, and falls as thickness increases.$q$,
    'seed:plan04'
  ),
  (
    '{2027}'::int[], 'C',
    $q$anatomy$q$, $q$anatomy_digestive_anatomy_and_mechanical_chemical_digestion$q$, $q$anatomy_oral_cavity_salivary_glands$q$,
    'mcq', 'live',
    $q$Salivary amylase begins chemical digestion of:$q$,
    jsonb_build_object('A', $q$Proteins$q$, 'B', $q$Lipids exclusively$q$, 'C', $q$Nucleic acids exclusively$q$, 'D', $q$Starches (carbohydrates)$q$),
    $q$D$q$,
    $q$Salivary amylase starts breaking down starches in the mouth.$q$,
    'seed:plan04'
  ),
  (
    '{2027}'::int[], 'C',
    $q$anatomy$q$, $q$anatomy_absorption_nutrition_and_metabolic_handling_of_nutrients$q$, $q$anatomy_absorption_pathways$q$,
    'mcq', 'live',
    $q$Most nutrient absorption in the GI tract occurs in the:$q$,
    jsonb_build_object('A', $q$Small intestine$q$, 'B', $q$Esophagus$q$, 'C', $q$Large intestine only$q$, 'D', $q$Gallbladder lumen$q$),
    $q$A$q$,
    $q$The small intestine (especially jejunum/ileum with villi) is the primary absorptive region.$q$,
    'seed:plan04'
  ),
  (
    '{2027}'::int[], 'C',
    $q$anatomy$q$, $q$anatomy_immune_system_structure_and_innate_adaptive_roles$q$, $q$anatomy_primary_lymphoid_organs$q$,
    'mcq', 'live',
    $q$Which are primary lymphoid organs?$q$,
    jsonb_build_object('A', $q$Peyers patches only$q$, 'B', $q$Bone marrow and thymus$q$, 'C', $q$Spleen and lymph nodes only$q$, 'D', $q$Tonsils only$q$),
    $q$B$q$,
    $q$Primary lymphoid organs (bone marrow, thymus) are where lymphocytes develop/mature.$q$,
    'seed:plan04'
  ),
  (
    '{2027}'::int[], 'C',
    $q$anatomy$q$, $q$anatomy_immune_response_disorders_and_disease_applications$q$, $q$anatomy_primary_secondary_response$q$,
    'mcq', 'live',
    $q$Compared with a primary immune response, a secondary (memory) response typically is:$q$,
    jsonb_build_object('A', $q$Identical in timing and magnitude$q$, 'B', $q$Impossible after vaccination$q$, 'C', $q$Faster and produces higher antibody titers$q$, 'D', $q$Slower and weaker$q$),
    $q$C$q$,
    $q$Memory B/T cells make the secondary response quicker and stronger.$q$,
    'seed:plan04'
  ),
  (
    '{2027}'::int[], 'C',
    $q$water_quality$q$, $q$water_quality_marine_and_estuarine_habitats_and_zonation$q$, $q$water_quality_estuary_definition_and_classification$q$,
    'mcq', 'live',
    $q$An estuary is best defined as:$q$,
    jsonb_build_object('A', $q$The open ocean beyond the continental shelf$q$, 'B', $q$A freshwater lake with no tidal influence$q$, 'C', $q$A hydrothermal vent community only$q$, 'D', $q$A semi-enclosed coastal water body where freshwater mixes with seawater$q$),
    $q$D$q$,
    $q$Estuaries are coastal mixing zones of riverine freshwater and marine saltwater.$q$,
    'seed:plan04'
  ),
  (
    '{2027}'::int[], 'C',
    $q$water_quality$q$, $q$water_quality_physical_and_chemical_properties_of_seawater$q$, $q$water_quality_seawater_salinity_composition$q$,
    'mcq', 'live',
    $q$Average open-ocean salinity is closest to:$q$,
    jsonb_build_object('A', $q$35 ppt (parts per thousand)$q$, 'B', $q$3.5 ppt$q$, 'C', $q$350 ppt$q$, 'D', $q$0.35 ppt$q$),
    $q$A$q$,
    $q$Typical seawater salinity is about 35 ppt (psu).$q$,
    'seed:plan04'
  ),
  (
    '{2027}'::int[], 'C',
    $q$water_quality$q$, $q$water_quality_marine_and_estuarine_organisms_and_adaptations$q$, $q$water_quality_plankton_classification$q$,
    'mcq', 'live',
    $q$Phytoplankton are best described as:$q$,
    jsonb_build_object('A', $q$Air-breathing marine mammals$q$, 'B', $q$Photosynthetic drifting organisms that form the base of many marine food webs$q$, 'C', $q$Bottom-dwelling filter feeders only$q$, 'D', $q$Fast-swimming predatory fish$q$),
    $q$B$q$,
    $q$Phytoplankton are microscopic photosynthetic plankton, primary producers in many aquatic systems.$q$,
    'seed:plan04'
  ),
  (
    '{2027}'::int[], 'C',
    $q$water_quality$q$, $q$water_quality_food_webs_productivity_and_nutrient_cycling$q$, $q$water_quality_trophic_levels_food_chain$q$,
    'mcq', 'live',
    $q$In a simplified marine food chain, primary producers occupy which trophic level?$q$,
    jsonb_build_object('A', $q$Third trophic level$q$, 'B', $q$Decomposer level only$q$, 'C', $q$First trophic level$q$, 'D', $q$Second trophic level$q$),
    $q$C$q$,
    $q$Primary producers (e.g. phytoplankton) are trophic level 1.$q$,
    'seed:plan04'
  ),
  (
    '{2027}'::int[], 'C',
    $q$water_quality$q$, $q$water_quality_water_monitoring_indicators_and_lab_analysis$q$, $q$water_quality_key_water_quality_parameters$q$,
    'mcq', 'live',
    $q$Which set lists common key water-quality parameters for marine/estuarine monitoring?$q$,
    jsonb_build_object('A', $q$Only air pressure and wind speed$q$, 'B', $q$Only fish taxonomy keys$q$, 'C', $q$Only sediment grain color$q$, 'D', $q$Temperature, salinity, dissolved oxygen, pH, nutrients$q$),
    $q$D$q$,
    $q$Core WQ parameters include T, salinity, DO, pH, turbidity, and nutrients (N/P), among others.$q$,
    'seed:plan04'
  ),
  (
    '{2027}'::int[], 'C',
    $q$water_quality$q$, $q$water_quality_human_impacts_pollution_and_restoration$q$, $q$water_quality_nutrient_pollution_eutrophication$q$,
    'mcq', 'live',
    $q$Coastal eutrophication is most directly driven by excess:$q$,
    jsonb_build_object('A', $q$Nitrogen and phosphorus inputs$q$, 'B', $q$Dissolved oxygen supersaturation alone$q$, 'C', $q$Decreased sunlight in space$q$, 'D', $q$Volcanic ash only$q$),
    $q$A$q$,
    $q$Nutrient pollution (especially N and P) fuels algal blooms and can lead to eutrophication and hypoxia.$q$,
    'seed:plan04'
  );

-- Verify:
-- SELECT correct_key, count(*) FROM questions WHERE citation='seed:plan04' GROUP BY 1;
-- SELECT count(*) FROM questions WHERE citation='seed:plan04';  -- expect 24
-- <<< END 20260804_seed_questions.sql <<<


-- >>> BEGIN 20260804_session_commit.sql >>>
-- ============================================================================
-- scioly.app — Plan 09 session commit RPC
-- PASTE-CHECK: SCIOLY-0804-SESSION
-- Prerequisites: 20260803 + 20260804_progression (+ questions seed)
-- XP awards mirror src/lib/progression.ts XP_AWARDS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.casual_session_commits (
  session_token UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  event_id TEXT NOT NULL REFERENCES public.taxonomy_events(id),
  topic_id TEXT,
  xp_awarded INT NOT NULL DEFAULT 0,
  answered_count INT NOT NULL DEFAULT 0,
  correct_count INT NOT NULL DEFAULT 0,
  skipped_count INT NOT NULL DEFAULT 0,
  result JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_casual_commits_user
  ON public.casual_session_commits(user_id, created_at DESC);

ALTER TABLE public.casual_session_commits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS casual_commits_own ON public.casual_session_commits;
CREATE POLICY casual_commits_own ON public.casual_session_commits
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

GRANT SELECT ON public.casual_session_commits TO authenticated;

-- Rank title helper (cache only — client still derives on read)
CREATE OR REPLACE FUNCTION public.rank_title_from_xp(p_xp INT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  lvl INT;
BEGIN
  lvl := (GREATEST(p_xp, 0) / 100) + 1;
  IF lvl <= 5 THEN
    RETURN 'Recruit Level ' || lvl::text;
  ELSIF lvl <= 10 THEN
    RETURN 'Specialist';
  ELSIF lvl <= 20 THEN
    RETURN 'Tactician';
  ELSIF lvl <= 35 THEN
    RETURN 'Master';
  ELSE
    RETURN 'National Legend';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.submit_casual_session(
  p_session_token UUID,
  p_event_id TEXT,
  p_topic_id TEXT,
  p_answers JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  existing public.casual_session_commits%ROWTYPE;
  ans JSONB;
  qid UUID;
  skipped BOOLEAN;
  is_correct BOOLEAN;
  qrec public.questions%ROWTYPE;
  xp_gain INT := 0;
  answered INT := 0;
  correct_n INT := 0;
  skipped_n INT := 0;
  prof public.profiles%ROWTYPE;
  today DATE := (timezone('utc', now()))::date;
  new_streak INT;
  new_xp INT;
  result_json JSONB;
  XP_CORRECT CONSTANT INT := 10;
  XP_INCORRECT CONSTANT INT := 2;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_session_token IS NULL THEN
    RAISE EXCEPTION 'session_token required';
  END IF;

  IF p_answers IS NULL OR jsonb_typeof(p_answers) <> 'array' THEN
    RAISE EXCEPTION 'answers must be a JSON array';
  END IF;

  SELECT * INTO existing
  FROM public.casual_session_commits
  WHERE session_token = p_session_token;

  IF FOUND THEN
    IF existing.user_id <> uid THEN
      RAISE EXCEPTION 'session_token belongs to another user';
    END IF;
    RETURN existing.result || jsonb_build_object('already_committed', true);
  END IF;

  FOR ans IN SELECT * FROM jsonb_array_elements(p_answers)
  LOOP
    qid := NULLIF(ans->>'question_id', '')::uuid;
    IF qid IS NULL THEN
      RAISE EXCEPTION 'answer missing question_id';
    END IF;

    skipped := COALESCE((ans->>'skipped')::boolean, false);

    SELECT * INTO qrec
    FROM public.questions
    WHERE id = qid AND status = 'live' AND event_id = p_event_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'invalid or out-of-scope question %', qid;
    END IF;

    IF p_topic_id IS NOT NULL AND p_topic_id <> '' AND p_topic_id <> 'all' THEN
      IF qrec.topic_id IS DISTINCT FROM p_topic_id THEN
        RAISE EXCEPTION 'question % not in topic %', qid, p_topic_id;
      END IF;
    END IF;

    IF skipped THEN
      skipped_n := skipped_n + 1;
      CONTINUE;
    END IF;

    is_correct := COALESCE((ans->>'is_correct')::boolean, false);
    answered := answered + 1;
    IF is_correct THEN
      correct_n := correct_n + 1;
      xp_gain := xp_gain + XP_CORRECT;
    ELSE
      xp_gain := xp_gain + XP_INCORRECT;
    END IF;

    INSERT INTO public.user_history (user_id, question_id, answered_at, is_correct)
    VALUES (uid, qid, now(), is_correct);

    IF qrec.concept_id IS NOT NULL THEN
      INSERT INTO public.user_weakness_map (user_id, concept_id, total_attempts, correct_attempts)
      VALUES (
        uid,
        qrec.concept_id,
        1,
        CASE WHEN is_correct THEN 1 ELSE 0 END
      )
      ON CONFLICT (user_id, concept_id) DO UPDATE SET
        total_attempts = public.user_weakness_map.total_attempts + 1,
        correct_attempts = public.user_weakness_map.correct_attempts
          + CASE WHEN is_correct THEN 1 ELSE 0 END;

      IF NOT is_correct THEN
        INSERT INTO public.reinjection_queue (user_id, question_id, unlock_at, resolved)
        VALUES (uid, qid, now() + interval '1 day', false);
      END IF;
    END IF;
  END LOOP;

  SELECT * INTO prof FROM public.profiles WHERE id = uid FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'profile missing';
  END IF;

  new_xp := prof.xp + xp_gain;

  IF answered > 0 THEN
    IF prof.last_activity_on IS NULL THEN
      new_streak := 1;
    ELSIF prof.last_activity_on = today THEN
      new_streak := GREATEST(prof.current_streak, 0);
    ELSIF prof.last_activity_on = today - 1 THEN
      new_streak := GREATEST(prof.current_streak, 0) + 1;
    ELSE
      new_streak := 1;
    END IF;

    UPDATE public.profiles SET
      xp = new_xp,
      rank_title = public.rank_title_from_xp(new_xp),
      current_streak = new_streak,
      last_activity_on = today,
      questions_answered = prof.questions_answered + answered
    WHERE id = uid;
  ELSE
    new_streak := prof.current_streak;
    -- all skipped: still record commit, no XP/streak change
    UPDATE public.profiles SET
      rank_title = public.rank_title_from_xp(prof.xp)
    WHERE id = uid;
    new_xp := prof.xp;
  END IF;

  result_json := jsonb_build_object(
    'already_committed', false,
    'xp_awarded', xp_gain,
    'xp_total', new_xp,
    'streak', new_streak,
    'answered', answered,
    'correct', correct_n,
    'skipped', skipped_n
  );

  INSERT INTO public.casual_session_commits (
    session_token, user_id, event_id, topic_id,
    xp_awarded, answered_count, correct_count, skipped_count, result
  ) VALUES (
    p_session_token, uid, p_event_id,
    NULLIF(NULLIF(p_topic_id, ''), 'all'),
    xp_gain, answered, correct_n, skipped_n, result_json
  );

  RETURN result_json;
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_casual_session(UUID, TEXT, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rank_title_from_xp(INT) TO authenticated;
-- <<< END 20260804_session_commit.sql <<<


-- >>> BEGIN 20260804_clinic_guides.sql >>>
-- ============================================================================
-- scioly.app — Plan 11 clinic guides + DO XP
-- PASTE-CHECK: SCIOLY-0804-CLINIC
-- Prerequisites: 20260803 taxonomy, Plan 04 question concepts exist
-- ============================================================================

ALTER TABLE public.concept_guides
  ADD COLUMN IF NOT EXISTS do_prompt TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS do_options JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS do_correct_key VARCHAR(1);

CREATE TABLE IF NOT EXISTS public.clinic_do_awards (
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  concept_id TEXT NOT NULL REFERENCES public.taxonomy_concepts(id) ON DELETE CASCADE,
  session_token UUID NOT NULL,
  xp_awarded INT NOT NULL DEFAULT 5,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, concept_id, session_token)
);

CREATE INDEX IF NOT EXISTS idx_clinic_awards_user
  ON public.clinic_do_awards(user_id, created_at DESC);

ALTER TABLE public.clinic_do_awards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS clinic_awards_own ON public.clinic_do_awards;
CREATE POLICY clinic_awards_own ON public.clinic_do_awards
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

GRANT SELECT ON public.clinic_do_awards TO authenticated;

CREATE OR REPLACE FUNCTION public.complete_clinic_do(
  p_concept_id TEXT,
  p_session_token UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  existing public.clinic_do_awards%ROWTYPE;
  prof public.profiles%ROWTYPE;
  xp_gain INT := 5;
  new_xp INT;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF p_concept_id IS NULL OR p_session_token IS NULL THEN
    RAISE EXCEPTION 'concept_id and session_token required';
  END IF;

  SELECT * INTO existing
  FROM public.clinic_do_awards
  WHERE user_id = uid AND concept_id = p_concept_id AND session_token = p_session_token;

  IF FOUND THEN
    SELECT * INTO prof FROM public.profiles WHERE id = uid;
    RETURN jsonb_build_object(
      'already_awarded', true,
      'xp_awarded', 0,
      'xp_total', prof.xp,
      'concept_id', p_concept_id
    );
  END IF;

  SELECT * INTO prof FROM public.profiles WHERE id = uid FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'profile missing';
  END IF;

  new_xp := prof.xp + xp_gain;
  UPDATE public.profiles SET
    xp = new_xp,
    rank_title = public.rank_title_from_xp(new_xp)
  WHERE id = uid;

  INSERT INTO public.clinic_do_awards (user_id, concept_id, session_token, xp_awarded)
  VALUES (uid, p_concept_id, p_session_token, xp_gain);

  RETURN jsonb_build_object(
    'already_awarded', false,
    'xp_awarded', xp_gain,
    'xp_total', new_xp,
    'concept_id', p_concept_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_clinic_do(TEXT, UUID) TO authenticated;

DELETE FROM public.concept_guides
WHERE concept_id IN (
  $g$chem_lab_boyles_law$g$,
  $g$chem_lab_ideal_gas_law_equation$g$,
  $g$chem_lab_universal_gas_constant_R$g$,
  $g$chem_lab_km_postulates$g$,
  $g$chem_lab_temperature_and_average_kinetic_energy$g$,
  $g$chem_lab_reaction_rate_definition$g$,
  $g$chem_lab_rate_law_and_reaction_order$g$,
  $g$chem_lab_collision_theory$g$,
  $g$chem_lab_activation_energy_and_energy_profiles$g$,
  $g$chem_lab_manometer_and_barometer_operation$g$,
  $g$chem_lab_gas_volume_measurement_techniques$g$,
  $g$anatomy_upper_respiratory_anatomy$g$,
  $g$anatomy_ficks_law_diffusion$g$,
  $g$anatomy_oral_cavity_salivary_glands$g$,
  $g$anatomy_absorption_pathways$g$,
  $g$anatomy_primary_lymphoid_organs$g$,
  $g$anatomy_primary_secondary_response$g$,
  $g$water_quality_estuary_definition_and_classification$g$,
  $g$water_quality_seawater_salinity_composition$g$,
  $g$water_quality_plankton_classification$g$,
  $g$water_quality_trophic_levels_food_chain$g$,
  $g$water_quality_key_water_quality_parameters$g$,
  $g$water_quality_nutrient_pollution_eutrophication$g$
);

INSERT INTO public.concept_guides (
  concept_id, read_body, see_html, status, do_prompt, do_options, do_correct_key, updated_at
) VALUES
  (
    $g$chem_lab_boyles_law$g$,
    $g$Boyle's law: for a fixed amount of gas at constant temperature, pressure and volume are inversely related (P1V1 = P2V2). Halving volume doubles pressure because collisions with the walls become more frequent per unit area.$g$,
    $g$<div class="clinic-see"><p><strong>Picture:</strong> a sealed syringe. Push the plunger in (V down) and feel resistance rise (P up).</p><p>P ? V stays constant when n and T are fixed.</p></div>$g$,
    'live',
    $g$At constant n and T, if volume is doubled, pressure:$g$,
    jsonb_build_object('A', $g$Stays the same$g$, 'B', $g$Halves$g$, 'C', $g$Doubles$g$),
    $g$B$g$,
    now()
  ),
  (
    $g$chem_lab_ideal_gas_law_equation$g$,
    $g$The ideal gas law PV = nRT ties pressure, volume, moles, and absolute temperature. Use kelvin for T. R must match your pressure and volume units.$g$,
    $g$<div class="clinic-see"><p><strong>Map:</strong> P and V on the left, n, R, T on the right. If T rises at fixed n,V, P rises.</p></div>$g$,
    'live',
    $g$Which equation is the ideal gas law?$g$,
    jsonb_build_object('A', $g$P1V1 = P2V2$g$, 'B', $g$V1/T1 = V2/T2$g$, 'C', $g$PV = nRT$g$),
    $g$C$g$,
    now()
  ),
  (
    $g$chem_lab_universal_gas_constant_R$g$,
    $g$R is the universal gas constant. Common value: 0.0821 L?atm/(mol?K) when P is in atm and V in liters. Energy units use 8.314 J/(mol?K).$g$,
    $g$<div class="clinic-see"><p><strong>Unit check:</strong> match R to P and V units before computing n or T.</p></div>$g$,
    'live',
    $g$For P in atm and V in L, which R fits PV = nRT?$g$,
    jsonb_build_object('A', $g$0.0821 L?atm/(mol?K)$g$, 'B', $g$Only 8.314 J/(mol?K)$g$, 'C', $g$1 atm exactly$g$),
    $g$A$g$,
    now()
  ),
  (
    $g$chem_lab_km_postulates$g$,
    $g$Kinetic molecular theory models ideal gases as particles in constant random motion with negligible volume, elastic collisions, no attractions, and average KE proportional to absolute temperature.$g$,
    $g$<div class="clinic-see"><p><strong>Sketch:</strong> dots bouncing in a box, hitting walls elastically, no sticking together.</p></div>$g$,
    'live',
    $g$Ideal-gas collisions in KMT are:$g$,
    jsonb_build_object('A', $g$Forbidden$g$, 'B', $g$Elastic$g$, 'C', $g$Always inelastic$g$),
    $g$B$g$,
    now()
  ),
  (
    $g$chem_lab_temperature_and_average_kinetic_energy$g$,
    $g$Absolute temperature measures average translational kinetic energy of particles. Higher T means faster average speeds for a given gas.$g$,
    $g$<div class="clinic-see"><p><strong>Link:</strong> T up ? average KE up ? more forceful wall collisions ? pressure up at fixed V.</p></div>$g$,
    'live',
    $g$Absolute temperature is proportional to:$g$,
    jsonb_build_object('A', $g$Particle rest mass only$g$, 'B', $g$Container color$g$, 'C', $g$Average kinetic energy of particles$g$),
    $g$C$g$,
    now()
  ),
  (
    $g$chem_lab_reaction_rate_definition$g$,
    $g$Reaction rate describes how fast concentration changes. Average rate often uses -Delta[A]/Deltat for a reactant so the reported rate is positive as [A] falls.$g$,
    $g$<div class="clinic-see"><p><strong>Sign tip:</strong> reactants decrease (negative Delta), so a minus sign makes rate positive.</p></div>$g$,
    'live',
    $g$Why use -Delta[A]/Deltat for a reactant?$g$,
    jsonb_build_object('A', $g$To report a positive rate as [A] decreases$g$, 'B', $g$Rates are defined as negative$g$, 'C', $g$To cancel moles$g$),
    $g$A$g$,
    now()
  ),
  (
    $g$chem_lab_rate_law_and_reaction_order$g$,
    $g$A rate law like rate = k[A]^m[B]^n is determined experimentally. Overall order is m + n. Orders are not taken from stoichiometry alone.$g$,
    $g$<div class="clinic-see"><p><strong>Example:</strong> rate = k[A]^2[B] has overall order 3.</p></div>$g$,
    'live',
    $g$For rate = k[A]^2[B], overall order is:$g$,
    jsonb_build_object('A', $g$1$g$, 'B', $g$3$g$, 'C', $g$2$g$),
    $g$B$g$,
    now()
  ),
  (
    $g$chem_lab_collision_theory$g$,
    $g$Reactions require collisions with enough energy (at least Ea) and proper orientation. More frequent effective collisions ? faster rate.$g$,
    $g$<div class="clinic-see"><p><strong>Two filters:</strong> energy barrier + geometry. Wrong angle = bounce, not product.</p></div>$g$,
    'live',
    $g$Besides enough energy, collisions need:$g$,
    jsonb_build_object('A', $g$Identical molar masses$g$, 'B', $g$Zero Ea$g$, 'C', $g$Proper orientation$g$),
    $g$C$g$,
    now()
  ),
  (
    $g$chem_lab_activation_energy_and_energy_profiles$g$,
    $g$Activation energy Ea is the energy climb from reactants to the transition state. Catalysts lower Ea. DeltaH is reactant-to-product energy difference, not Ea.$g$,
    $g$<div class="clinic-see"><p><strong>Profile:</strong> hill height from reactants to peak = Ea(forward). Peak = transition state.</p></div>$g$,
    'live',
    $g$Ea(forward) is the energy from:$g$,
    jsonb_build_object('A', $g$Reactants to the transition state$g$, 'B', $g$Reactants to products only$g$, 'C', $g$Products to infinity$g$),
    $g$A$g$,
    now()
  ),
  (
    $g$chem_lab_manometer_and_barometer_operation$g$,
    $g$A mercury barometer measures atmospheric pressure via column height. Manometers compare gas pressure to a reference (often Patm) using liquid level differences.$g$,
    $g$<div class="clinic-see"><p><strong>Barometer:</strong> closed tube of Hg, height proportional to Patm.</p></div>$g$,
    'live',
    $g$A mercury barometer measures:$g$,
    jsonb_build_object('A', $g$Humidity only$g$, 'B', $g$Atmospheric pressure$g$, 'C', $g$Only sample temperature$g$),
    $g$B$g$,
    now()
  ),
  (
    $g$chem_lab_gas_volume_measurement_techniques$g$,
    $g$Gas volumes are often measured by water displacement with an inverted graduated cylinder or eudiometer, or with a gas syringe.$g$,
    $g$<div class="clinic-see"><p><strong>Setup:</strong> inverted cylinder full of water, gas bubbles in, read volume at equalized levels.</p></div>$g$,
    'live',
    $g$Water-displacement volume is commonly read with:$g$,
    jsonb_build_object('A', $g$Only a thermometer$g$, 'B', $g$A dry volumetric flask sealed empty$g$, 'C', $g$An inverted graduated cylinder or eudiometer$g$),
    $g$C$g$,
    now()
  ),
  (
    $g$anatomy_upper_respiratory_anatomy$g$,
    $g$Upper respiratory tract includes the nose/nasal cavity, pharynx, and larynx. It filters, warms, and humidifies air before the trachea and lungs (lower tract).$g$,
    $g$<div class="clinic-see"><p><strong>Path:</strong> nose ? pharynx ? larynx ? (then) trachea.</p></div>$g$,
    'live',
    $g$Which is part of the upper respiratory tract?$g$,
    jsonb_build_object('A', $g$Larynx$g$, 'B', $g$Alveoli$g$, 'C', $g$Visceral pleura only$g$),
    $g$A$g$,
    now()
  ),
  (
    $g$anatomy_ficks_law_diffusion$g$,
    $g$Fick's law: diffusion rate rises with surface area and partial-pressure gradient, and falls as membrane thickness increases. Emphysema or edema can hurt exchange.$g$,
    $g$<div class="clinic-see"><p><strong>Levers:</strong> bigger area / steeper gradient ? faster diffusion, thicker barrier ? slower.</p></div>$g$,
    'live',
    $g$Gas exchange increases when:$g$,
    jsonb_build_object('A', $g$Gradient is zero$g$, 'B', $g$Area up and thickness down$g$, 'C', $g$Area down and thickness up$g$),
    $g$B$g$,
    now()
  ),
  (
    $g$anatomy_oral_cavity_salivary_glands$g$,
    $g$Salivary glands secrete saliva with amylase that begins starch digestion in the mouth, plus mucus for lubrication and protection.$g$,
    $g$<div class="clinic-see"><p><strong>First cut:</strong> chewing (mechanical) + amylase (chemical) on carbs.</p></div>$g$,
    'live',
    $g$Salivary amylase starts digesting:$g$,
    jsonb_build_object('A', $g$Proteins$g$, 'B', $g$Lipids only$g$, 'C', $g$Starches$g$),
    $g$C$g$,
    now()
  ),
  (
    $g$anatomy_absorption_pathways$g$,
    $g$Most nutrient absorption occurs in the small intestine across enterocytes. Surface area is amplified by folds, villi, and microvilli.$g$,
    $g$<div class="clinic-see"><p><strong>Hub:</strong> small intestine villi - primary absorptive surface.</p></div>$g$,
    'live',
    $g$Most nutrient absorption occurs in the:$g$,
    jsonb_build_object('A', $g$Small intestine$g$, 'B', $g$Esophagus$g$, 'C', $g$Gallbladder lumen$g$),
    $g$A$g$,
    now()
  ),
  (
    $g$anatomy_primary_lymphoid_organs$g$,
    $g$Primary lymphoid organs are bone marrow and thymus - sites where lymphocytes develop and mature. Secondary organs (nodes, spleen, MALT) are where they meet antigen.$g$,
    $g$<div class="clinic-see"><p><strong>Split:</strong> primary = development, secondary = activation/response.</p></div>$g$,
    'live',
    $g$Primary lymphoid organs are:$g$,
    jsonb_build_object('A', $g$Tonsils only$g$, 'B', $g$Bone marrow and thymus$g$, 'C', $g$Spleen and nodes only$g$),
    $g$B$g$,
    now()
  ),
  (
    $g$anatomy_primary_secondary_response$g$,
    $g$Primary immune response is slower with lower antibody titers. Secondary (memory) response is faster and stronger after re-exposure or vaccination.$g$,
    $g$<div class="clinic-see"><p><strong>Curve:</strong> first peak delayed/small, second peak quick/high.</p></div>$g$,
    'live',
    $g$A secondary response is typically:$g$,
    jsonb_build_object('A', $g$Slower and weaker$g$, 'B', $g$Identical to primary$g$, 'C', $g$Faster with higher titers$g$),
    $g$C$g$,
    now()
  ),
  (
    $g$water_quality_estuary_definition_and_classification$g$,
    $g$An estuary is a semi-enclosed coastal water body where freshwater mixes with seawater, creating gradients in salinity and often high productivity.$g$,
    $g$<div class="clinic-see"><p><strong>Mix zone:</strong> river meet ocean - brackish water, tides matter.</p></div>$g$,
    'live',
    $g$An estuary is best described as:$g$,
    jsonb_build_object('A', $g$Where freshwater mixes with seawater$g$, 'B', $g$Open ocean beyond the shelf$g$, 'C', $g$A freshwater lake with no tide$g$),
    $g$A$g$,
    now()
  ),
  (
    $g$water_quality_seawater_salinity_composition$g$,
    $g$Salinity is dissolved salt content. Average open-ocean salinity is about 35 ppt (psu). Major ions include Na+ and Cl-.$g$,
    $g$<div class="clinic-see"><p><strong>Anchor number:</strong> ~35 ppt for typical seawater.</p></div>$g$,
    'live',
    $g$Average open-ocean salinity is closest to:$g$,
    jsonb_build_object('A', $g$350 ppt$g$, 'B', $g$35 ppt$g$, 'C', $g$3.5 ppt$g$),
    $g$B$g$,
    now()
  ),
  (
    $g$water_quality_plankton_classification$g$,
    $g$Plankton drift with currents. Phytoplankton are photosynthetic producers, zooplankton are consumers. Size classes matter for food webs and sampling.$g$,
    $g$<div class="clinic-see"><p><strong>Base:</strong> phytoplankton fix carbon, feed much of the marine food web.</p></div>$g$,
    'live',
    $g$Phytoplankton are:$g$,
    jsonb_build_object('A', $g$Only bottom filter feeders$g$, 'B', $g$Air-breathing mammals$g$, 'C', $g$Photosynthetic drifting producers$g$),
    $g$C$g$,
    now()
  ),
  (
    $g$water_quality_trophic_levels_food_chain$g$,
    $g$Trophic levels organize who eats whom. Primary producers are level 1, primary consumers level 2, and so on. Energy transfer between levels is inefficient.$g$,
    $g$<div class="clinic-see"><p><strong>Chain:</strong> phytoplankton (1) ? zooplankton (2) ? small fish (3) ? ...</p></div>$g$,
    'live',
    $g$Primary producers occupy which trophic level?$g$,
    jsonb_build_object('A', $g$First$g$, 'B', $g$Second$g$, 'C', $g$Third$g$),
    $g$A$g$,
    now()
  ),
  (
    $g$water_quality_key_water_quality_parameters$g$,
    $g$Core marine/estuarine parameters include temperature, salinity, dissolved oxygen, pH, turbidity, and nutrients (N and P). Together they diagnose ecosystem health.$g$,
    $g$<div class="clinic-see"><p><strong>Kit mental model:</strong> T, S, DO, pH, nutrients - read as a set, not one number.</p></div>$g$,
    'live',
    $g$A common WQ parameter set includes:$g$,
    jsonb_build_object('A', $g$Only fish taxonomy$g$, 'B', $g$Temperature, salinity, DO, pH, nutrients$g$, 'C', $g$Only wind speed$g$),
    $g$B$g$,
    now()
  ),
  (
    $g$water_quality_nutrient_pollution_eutrophication$g$,
    $g$Excess nitrogen and phosphorus from runoff can drive algal blooms, then decay that consumes oxygen - eutrophication and possible hypoxia/dead zones.$g$,
    $g$<div class="clinic-see"><p><strong>Cascade:</strong> nutrients ? bloom ? die-off ? bacterial O2 use ? hypoxia.</p></div>$g$,
    'live',
    $g$Coastal eutrophication is most directly driven by excess:$g$,
    jsonb_build_object('A', $g$Only DO supersaturation$g$, 'B', $g$Volcanic ash alone$g$, 'C', $g$Nitrogen and phosphorus$g$),
    $g$C$g$,
    now()
  );

-- Verify:
-- SELECT count(*) FROM concept_guides WHERE status = 'live';  -- expect 23
-- <<< END 20260804_clinic_guides.sql <<<


-- >>> BEGIN 20260804_timed_commit.sql >>>
-- ============================================================================
-- scioly.app — Plan 14 timed session commit
-- PASTE-CHECK: SCIOLY-0804-TIMED
-- Prerequisites: 20260804_session_commit.sql (rank_title_from_xp)
-- XP: timed correct +12 / incorrect +2 (mirrors progression.ts)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.timed_session_commits (
  session_token UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  event_id TEXT NOT NULL REFERENCES public.taxonomy_events(id),
  topic_id TEXT,
  xp_awarded INT NOT NULL DEFAULT 0,
  answered_count INT NOT NULL DEFAULT 0,
  correct_count INT NOT NULL DEFAULT 0,
  skipped_count INT NOT NULL DEFAULT 0,
  result JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_timed_commits_user
  ON public.timed_session_commits(user_id, created_at DESC);

ALTER TABLE public.timed_session_commits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS timed_commits_own ON public.timed_session_commits;
CREATE POLICY timed_commits_own ON public.timed_session_commits
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

GRANT SELECT ON public.timed_session_commits TO authenticated;

CREATE OR REPLACE FUNCTION public.submit_timed_session(
  p_session_token UUID,
  p_event_id TEXT,
  p_topic_id TEXT,
  p_answers JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  existing public.timed_session_commits%ROWTYPE;
  ans JSONB;
  qid UUID;
  skipped BOOLEAN;
  is_correct BOOLEAN;
  qrec public.questions%ROWTYPE;
  xp_gain INT := 0;
  answered INT := 0;
  correct_n INT := 0;
  skipped_n INT := 0;
  prof public.profiles%ROWTYPE;
  today DATE := (timezone('utc', now()))::date;
  new_streak INT;
  new_xp INT;
  result_json JSONB;
  XP_CORRECT CONSTANT INT := 12;
  XP_INCORRECT CONSTANT INT := 2;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_session_token IS NULL THEN
    RAISE EXCEPTION 'session_token required';
  END IF;

  IF p_answers IS NULL OR jsonb_typeof(p_answers) <> 'array' THEN
    RAISE EXCEPTION 'answers must be a JSON array';
  END IF;

  SELECT * INTO existing
  FROM public.timed_session_commits
  WHERE session_token = p_session_token;

  IF FOUND THEN
    IF existing.user_id <> uid THEN
      RAISE EXCEPTION 'session_token belongs to another user';
    END IF;
    RETURN existing.result || jsonb_build_object('already_committed', true);
  END IF;

  FOR ans IN SELECT * FROM jsonb_array_elements(p_answers)
  LOOP
    qid := NULLIF(ans->>'question_id', '')::uuid;
    IF qid IS NULL THEN
      RAISE EXCEPTION 'answer missing question_id';
    END IF;

    skipped := COALESCE((ans->>'skipped')::boolean, false);

    SELECT * INTO qrec
    FROM public.questions
    WHERE id = qid AND status = 'live' AND event_id = p_event_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'invalid or out-of-scope question %', qid;
    END IF;

    IF p_topic_id IS NOT NULL AND p_topic_id <> '' AND p_topic_id <> 'all' THEN
      IF qrec.topic_id IS DISTINCT FROM p_topic_id THEN
        RAISE EXCEPTION 'question % not in topic %', qid, p_topic_id;
      END IF;
    END IF;

    IF skipped THEN
      skipped_n := skipped_n + 1;
      CONTINUE;
    END IF;

    is_correct := COALESCE((ans->>'is_correct')::boolean, false);
    answered := answered + 1;
    IF is_correct THEN
      correct_n := correct_n + 1;
      xp_gain := xp_gain + XP_CORRECT;
    ELSE
      xp_gain := xp_gain + XP_INCORRECT;
    END IF;

    INSERT INTO public.user_history (user_id, question_id, answered_at, is_correct)
    VALUES (uid, qid, now(), is_correct);

    IF qrec.concept_id IS NOT NULL THEN
      INSERT INTO public.user_weakness_map (user_id, concept_id, total_attempts, correct_attempts)
      VALUES (
        uid,
        qrec.concept_id,
        1,
        CASE WHEN is_correct THEN 1 ELSE 0 END
      )
      ON CONFLICT (user_id, concept_id) DO UPDATE SET
        total_attempts = public.user_weakness_map.total_attempts + 1,
        correct_attempts = public.user_weakness_map.correct_attempts
          + CASE WHEN is_correct THEN 1 ELSE 0 END;

      IF NOT is_correct THEN
        INSERT INTO public.reinjection_queue (user_id, question_id, unlock_at, resolved)
        VALUES (uid, qid, now() + interval '1 day', false);
      END IF;
    END IF;
  END LOOP;

  SELECT * INTO prof FROM public.profiles WHERE id = uid FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'profile missing';
  END IF;

  new_xp := prof.xp + xp_gain;

  IF answered > 0 THEN
    IF prof.last_activity_on IS NULL THEN
      new_streak := 1;
    ELSIF prof.last_activity_on = today THEN
      new_streak := GREATEST(prof.current_streak, 0);
    ELSIF prof.last_activity_on = today - 1 THEN
      new_streak := GREATEST(prof.current_streak, 0) + 1;
    ELSE
      new_streak := 1;
    END IF;

    UPDATE public.profiles SET
      xp = new_xp,
      rank_title = public.rank_title_from_xp(new_xp),
      current_streak = new_streak,
      last_activity_on = today,
      questions_answered = prof.questions_answered + answered
    WHERE id = uid;
  ELSE
    new_streak := prof.current_streak;
    UPDATE public.profiles SET
      rank_title = public.rank_title_from_xp(prof.xp)
    WHERE id = uid;
    new_xp := prof.xp;
  END IF;

  result_json := jsonb_build_object(
    'already_committed', false,
    'xp_awarded', xp_gain,
    'xp_total', new_xp,
    'streak', new_streak,
    'answered', answered,
    'correct', correct_n,
    'skipped', skipped_n
  );

  INSERT INTO public.timed_session_commits (
    session_token, user_id, event_id, topic_id,
    xp_awarded, answered_count, correct_count, skipped_count, result
  ) VALUES (
    p_session_token, uid, p_event_id,
    NULLIF(NULLIF(p_topic_id, ''), 'all'),
    xp_gain, answered, correct_n, skipped_n, result_json
  );

  RETURN result_json;
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_timed_session(UUID, TEXT, TEXT, JSONB) TO authenticated;
-- <<< END 20260804_timed_commit.sql <<<


-- >>> BEGIN 20260804_missions.sql >>>
-- ============================================================================
-- scioly.app — Plan 15 missions write + sync
-- PASTE-CHECK: SCIOLY-0804-MISSIONS
-- Prerequisites: 20260803 + session commit (rank_title_from_xp)
-- ============================================================================

ALTER TABLE public.team_missions
  DROP CONSTRAINT IF EXISTS team_missions_goal_type_check;

ALTER TABLE public.team_missions
  ADD CONSTRAINT team_missions_goal_type_check
  CHECK (goal_type IN ('answered', 'correct'));

CREATE TABLE IF NOT EXISTS public.mission_complete_awards (
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  mission_id UUID NOT NULL REFERENCES public.team_missions(id) ON DELETE CASCADE,
  xp_awarded INT NOT NULL DEFAULT 50,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, mission_id)
);

ALTER TABLE public.mission_complete_awards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS mission_awards_own ON public.mission_complete_awards;
CREATE POLICY mission_awards_own ON public.mission_complete_awards
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

GRANT SELECT ON public.mission_complete_awards TO authenticated;

DROP POLICY IF EXISTS missions_team_write ON public.team_missions;
CREATE POLICY missions_team_write ON public.team_missions
  FOR ALL TO authenticated
  USING (public.team_role_at_least(team_id, 'officer'))
  WITH CHECK (public.team_role_at_least(team_id, 'officer'));

GRANT INSERT, UPDATE, DELETE ON public.team_missions TO authenticated;

CREATE OR REPLACE FUNCTION public.create_team_mission(
  p_title TEXT,
  p_target_event_id TEXT,
  p_goal_type TEXT,
  p_target_value INT,
  p_deadline TIMESTAMPTZ
)
RETURNS public.team_missions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  tid UUID;
  mission public.team_missions;
  member RECORD;
  event_id TEXT;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT team_id INTO tid FROM public.profiles WHERE id = uid;
  IF tid IS NULL THEN
    RAISE EXCEPTION 'Not on a team';
  END IF;

  IF NOT public.team_role_at_least(tid, 'officer') THEN
    RAISE EXCEPTION 'Officer role or higher required';
  END IF;

  IF p_title IS NULL OR length(trim(p_title)) < 2 THEN
    RAISE EXCEPTION 'Title required';
  END IF;

  IF p_goal_type NOT IN ('answered', 'correct') THEN
    RAISE EXCEPTION 'goal_type must be answered or correct';
  END IF;

  IF p_target_value IS NULL OR p_target_value < 1 THEN
    RAISE EXCEPTION 'target_value must be >= 1';
  END IF;

  IF p_deadline IS NULL OR p_deadline <= now() THEN
    RAISE EXCEPTION 'deadline must be in the future';
  END IF;

  event_id := NULLIF(trim(COALESCE(p_target_event_id, '')), '');
  IF event_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.taxonomy_events WHERE id = event_id) THEN
      RAISE EXCEPTION 'Unknown event';
    END IF;
  END IF;

  INSERT INTO public.team_missions (
    team_id, created_by, title, target_event_id, goal_type, target_value, deadline
  ) VALUES (
    tid, uid, trim(p_title), event_id, p_goal_type, p_target_value, p_deadline
  )
  RETURNING * INTO mission;

  FOR member IN
    SELECT user_id FROM public.team_roster WHERE team_id = tid
  LOOP
    INSERT INTO public.user_mission_progress (mission_id, user_id, current_value, completed)
    VALUES (mission.id, member.user_id, 0, false)
    ON CONFLICT DO NOTHING;
  END LOOP;

  RETURN mission;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_my_mission_progress()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  tid UUID;
  m RECORD;
  prog INT;
  done BOOLEAN;
  inserted INT;
  newly INT := 0;
  xp_gain INT := 0;
  XP_MISSION CONSTANT INT := 50;
  prof public.profiles%ROWTYPE;
  new_xp INT;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT team_id INTO tid FROM public.profiles WHERE id = uid;
  IF tid IS NULL THEN
    RETURN jsonb_build_object('synced', 0, 'newly_completed', 0, 'xp_awarded', 0);
  END IF;

  FOR m IN
    SELECT * FROM public.team_missions
    WHERE team_id = tid
    ORDER BY deadline ASC
  LOOP
    IF m.goal_type = 'correct' THEN
      SELECT count(*)::int INTO prog
      FROM public.user_history h
      JOIN public.questions q ON q.id = h.question_id
      WHERE h.user_id = uid
        AND h.is_correct = true
        AND h.answered_at >= m.created_at
        AND (m.target_event_id IS NULL OR q.event_id = m.target_event_id);
    ELSE
      SELECT count(*)::int INTO prog
      FROM public.user_history h
      JOIN public.questions q ON q.id = h.question_id
      WHERE h.user_id = uid
        AND h.answered_at >= m.created_at
        AND (m.target_event_id IS NULL OR q.event_id = m.target_event_id);
    END IF;

    done := prog >= m.target_value;

    INSERT INTO public.user_mission_progress (mission_id, user_id, current_value, completed)
    VALUES (m.id, uid, prog, done)
    ON CONFLICT (mission_id, user_id) DO UPDATE SET
      current_value = EXCLUDED.current_value,
      completed = EXCLUDED.completed;

    IF done THEN
      INSERT INTO public.mission_complete_awards (user_id, mission_id, xp_awarded)
      VALUES (uid, m.id, XP_MISSION)
      ON CONFLICT DO NOTHING;
      GET DIAGNOSTICS inserted = ROW_COUNT;
      IF inserted > 0 THEN
        newly := newly + 1;
        xp_gain := xp_gain + XP_MISSION;
      END IF;
    END IF;
  END LOOP;

  IF xp_gain > 0 THEN
    SELECT * INTO prof FROM public.profiles WHERE id = uid FOR UPDATE;
    new_xp := prof.xp + xp_gain;
    UPDATE public.profiles SET
      xp = new_xp,
      rank_title = public.rank_title_from_xp(new_xp)
    WHERE id = uid;
  END IF;

  RETURN jsonb_build_object(
    'synced', 1,
    'newly_completed', newly,
    'xp_awarded', xp_gain
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_team_mission(TEXT, TEXT, TEXT, INT, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sync_my_mission_progress() TO authenticated;
-- <<< END 20260804_missions.sql <<<


-- >>> BEGIN 20260804_vault_loadout.sql >>>
-- ============================================================================
-- scioly.app — Plan 16 vault loadout + category lock
-- PASTE-CHECK: SCIOLY-0804-VAULT
-- Prerequisites: 20260803_initial (team_vault_resources + vault RLS)
-- ============================================================================

ALTER TABLE public.team_vault_resources
  DROP CONSTRAINT IF EXISTS team_vault_resources_category_check;

ALTER TABLE public.team_vault_resources
  ADD CONSTRAINT team_vault_resources_category_check
  CHECK (category IN ('doc', 'video', 'link'));

CREATE TABLE IF NOT EXISTS public.user_vault_loadout (
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  resource_id UUID NOT NULL REFERENCES public.team_vault_resources(id) ON DELETE CASCADE,
  pinned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, resource_id)
);

CREATE INDEX IF NOT EXISTS idx_vault_loadout_user
  ON public.user_vault_loadout(user_id);

ALTER TABLE public.user_vault_loadout ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS vault_loadout_own ON public.user_vault_loadout;
CREATE POLICY vault_loadout_own ON public.user_vault_loadout
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.team_vault_resources r
      WHERE r.id = resource_id
        AND public.is_team_member(r.team_id)
    )
  );

GRANT SELECT, INSERT, DELETE ON public.user_vault_loadout TO authenticated;
-- <<< END 20260804_vault_loadout.sql <<<


-- >>> BEGIN 20260804_comms_posts.sql >>>
-- ============================================================================
-- scioly.app — Plan 17 team posts pin/update/delete
-- PASTE-CHECK: SCIOLY-0804-COMMS
-- Prerequisites: 20260803_initial (team_posts + officer insert RLS)
-- ============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON public.team_posts TO authenticated;

DROP POLICY IF EXISTS posts_team_write ON public.team_posts;
DROP POLICY IF EXISTS posts_team_update ON public.team_posts;
DROP POLICY IF EXISTS posts_team_delete ON public.team_posts;

CREATE POLICY posts_team_update ON public.team_posts
  FOR UPDATE TO authenticated
  USING (public.team_role_at_least(team_id, 'officer'))
  WITH CHECK (public.team_role_at_least(team_id, 'officer'));

CREATE POLICY posts_team_delete ON public.team_posts
  FOR DELETE TO authenticated
  USING (public.team_role_at_least(team_id, 'officer'));
-- <<< END 20260804_comms_posts.sql <<<

