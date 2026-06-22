-- ================================================
-- Correção dos nomes dos perfis para bater com os palpites
-- Execute no Supabase → SQL Editor
-- ================================================

-- Sidney (admin) estava como "Administrador"
UPDATE public.perfis SET nome = 'Sidney' WHERE email = 'sid.amorim1@gmail.com';

-- Eduardo estava como "Edu"
UPDATE public.perfis SET nome = 'Eduardo' WHERE email = 'eduardo.s@geniantis.com';

-- Aline estava como "Aline Jahn"
UPDATE public.perfis SET nome = 'Aline' WHERE email = 'aline.s@geniantis.com';

-- Verificação: deve mostrar Sidney, Eduardo, Matheus, Daniel, Aline
SELECT nome, email, is_admin FROM public.perfis ORDER BY nome;
