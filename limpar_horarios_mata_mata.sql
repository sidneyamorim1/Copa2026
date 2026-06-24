-- Primeiro, removemos a trava de obrigatoriedade do banco de dados 
-- para permitir que um jogo fique com o horário em branco
ALTER TABLE public.jogos ALTER COLUMN hora DROP NOT NULL;

-- Agora deixamos o horário (hora) em branco (NULL) para todos os jogos do mata-mata
UPDATE public.jogos 
SET hora = NULL 
WHERE id >= 73;
