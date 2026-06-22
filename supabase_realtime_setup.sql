-- ================================================
-- Habilitar Supabase Realtime nas tabelas do Bolão
-- Execute este script UMA VEZ no editor SQL do Supabase
-- (Painél > SQL Editor)
-- ================================================

-- 1. Adiciona as tabelas à publication do Realtime
-- (necessário para que o .on('postgres_changes') funcione no frontend)
ALTER PUBLICATION supabase_realtime ADD TABLE public.jogos;
ALTER PUBLICATION supabase_realtime ADD TABLE public.palpites;

-- 2. OBRIGATÓRIO com RLS habilitado:
-- Sem REPLICA IDENTITY FULL, o Supabase não consegue verificar as políticas
-- de RLS para os eventos de UPDATE/DELETE e pode silenciosamente ignorar os eventos.
ALTER TABLE public.jogos REPLICA IDENTITY FULL;
ALTER TABLE public.palpites REPLICA IDENTITY FULL;

-- Verificação (opcional): lista as tabelas com Realtime ativo
-- SELECT schemaname, tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime';
