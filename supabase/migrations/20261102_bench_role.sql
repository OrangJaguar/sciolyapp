-- Bench sits below member. New enum values cannot be used in the same transaction.
ALTER TYPE public.team_role ADD VALUE IF NOT EXISTS 'bench' BEFORE 'member';
