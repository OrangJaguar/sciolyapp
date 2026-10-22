-- Allow a signed-in user to set a standard avatar or an earned badge portrait.
CREATE OR REPLACE FUNCTION "public"."set_my_avatar"("p_avatar_id" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_badge_id text;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not authenticated');
  END IF;

  IF p_avatar_id IN (
    'default_atom',
    'default_brain',
    'default_dna',
    'default_flask',
    'default_microscope',
    'default_rocket'
  ) THEN
    UPDATE profiles SET avatar_id = p_avatar_id WHERE id = v_uid;
    RETURN jsonb_build_object('ok', true, 'avatar_id', p_avatar_id);
  END IF;

  IF p_avatar_id LIKE 'badge:%' THEN
    v_badge_id := substring(p_avatar_id from 7);
    IF v_badge_id IS NULL OR v_badge_id = '' THEN
      RETURN jsonb_build_object('ok', false, 'error', 'invalid badge avatar');
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM user_badges
      WHERE user_id = v_uid AND badge_id = v_badge_id
    ) THEN
      RETURN jsonb_build_object('ok', false, 'error', 'badge not earned');
    END IF;
    UPDATE profiles SET avatar_id = p_avatar_id WHERE id = v_uid;
    RETURN jsonb_build_object('ok', true, 'avatar_id', p_avatar_id);
  END IF;

  RETURN jsonb_build_object('ok', false, 'error', 'invalid avatar');
END;
$$;

ALTER FUNCTION "public"."set_my_avatar"("p_avatar_id" "text") OWNER TO "postgres";

GRANT ALL ON FUNCTION "public"."set_my_avatar"("p_avatar_id" "text") TO "authenticated";
