-- ================================================
-- Adiciona a coluna pontos_bonus à tabela perfis
-- Execute no Supabase -> SQL Editor
-- ================================================

ALTER TABLE public.perfis ADD COLUMN IF NOT EXISTS pontos_bonus INTEGER DEFAULT 0;
