-- ============================================================================
-- WIPE public schema (run BEFORE 20260803_initial.sql if you already ran 0801)
-- WARNING: Deletes ALL public tables/data/functions/views in this project.
-- Does NOT delete Auth users (Authentication → Users). Delete those manually
-- if you want a clean signup test.
-- ============================================================================

DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO public;
GRANT USAGE ON SCHEMA public TO anon, authenticated;
