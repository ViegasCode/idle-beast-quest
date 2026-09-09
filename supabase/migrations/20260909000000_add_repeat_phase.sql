-- Add columns to support repeating a phase for farming
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS repetir_fase boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS fase_repetir integer NULL;
