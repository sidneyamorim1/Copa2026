-- ================================================
-- Script SQL para o Supabase - Bolão Copa 2026
-- Execute no editor SQL do Supabase
-- ================================================

-- 1. Tabela de Jogos
CREATE TABLE IF NOT EXISTS public.jogos (
    id INTEGER PRIMARY KEY,
    data DATE NOT NULL,
    hora TIME NOT NULL,
    time_casa VARCHAR(100) NOT NULL,
    time_fora VARCHAR(100) NOT NULL,
    gols_casa_real INTEGER,
    gols_fora_real INTEGER,
    grupo VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Tabela de Palpites
CREATE TABLE IF NOT EXISTS public.palpites (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    jogo_id INTEGER REFERENCES public.jogos(id) ON DELETE CASCADE,
    jogador_nome VARCHAR(100) NOT NULL,
    palpite_casa INTEGER NOT NULL,
    palpite_fora INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT unique_jogador_jogo UNIQUE (jogo_id, jogador_nome)
);

-- 3. Habilitar Row Level Security
ALTER TABLE public.jogos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.palpites ENABLE ROW LEVEL SECURITY;

-- 4. Políticas de acesso público (bolão sem autenticação)
CREATE POLICY "Leitura pública de jogos"
    ON public.jogos FOR SELECT USING (true);

CREATE POLICY "Escrita pública em jogos"
    ON public.jogos FOR ALL USING (true);

CREATE POLICY "Leitura pública de palpites"
    ON public.palpites FOR SELECT USING (true);

CREATE POLICY "Escrita pública em palpites"
    ON public.palpites FOR ALL USING (true);

-- ================================================
-- SEED: Carga inicial dos 72 jogos
-- (A aplicação também faz seed automático via JS,
--  mas aqui está a versão SQL completa)
-- ================================================

INSERT INTO public.jogos (id, data, hora, time_casa, time_fora, gols_casa_real, gols_fora_real, grupo) VALUES
-- Bloco 1 (Rodada 1)
(1,  '2026-06-12', '16:00:00', 'México',      'South Africa',   2, 0, 'Bloco 1'),
(2,  '2026-06-12', '16:00:00', 'Canadá',      'Bósnia',         1, 1, 'Bloco 1'),
(3,  '2026-06-13', '19:00:00', 'Brasil',      'Marrocos',       1, 1, 'Bloco 1'),
(4,  '2026-06-12', '22:00:00', 'EUA',         'Paraguai',       4, 1, 'Bloco 1'),
(5,  '2026-06-14', '14:00:00', 'Alemanha',    'Curaçao',        7, 1, 'Bloco 1'),
(6,  '2026-06-14', '17:00:00', 'Holanda',     'Japão',          2, 2, 'Bloco 1'),
(7,  '2026-06-15', '16:00:00', 'Bélgica',     'Egito',          1, 1, 'Bloco 1'),
(8,  '2026-06-15', '13:00:00', 'Espanha',     'Cabo Verde',     0, 0, 'Bloco 1'),
(9,  '2026-06-16', '16:00:00', 'França',      'Senegal',        3, 1, 'Bloco 1'),
(10, '2026-06-16', '22:00:00', 'Argentina',   'Argélia',        3, 0, 'Bloco 1'),
(11, '2026-06-17', '14:00:00', 'Portugal',    'RD Congo',       0, 0, 'Bloco 1'),
(12, '2026-06-17', '20:00:00', 'Gana',        'Panamá',         0, 0, 'Bloco 1'),
-- Bloco 2 (Rodada 2 - Jogos alternativos)
(13, '2026-06-13', '16:00:00', 'Coréa',       'Tchéquia',       2, 1, 'Bloco 2'),
(14, '2026-06-13', '16:00:00', 'Catar',       'Suíça',          1, 1, 'Bloco 2'),
(15, '2026-06-13', '22:00:00', 'Haití',       'Escócia',        0, 1, 'Bloco 2'),
(16, '2026-06-14', '01:00:00', 'South Africa','Turquia',        2, 0, 'Bloco 2'),
(17, '2026-06-14', '20:00:00', 'Cost Marfim', 'Equador',        1, 0, 'Bloco 2'),
(18, '2026-06-14', '23:00:00', 'Suécia',      'Tunisia',        5, 1, 'Bloco 2'),
(19, '2026-06-15', '22:00:00', 'Irã',         'Nova Zelandia',  2, 2, 'Bloco 2'),
(20, '2026-06-15', '19:00:00', 'Arab Saudita','Uruguai',        1, 1, 'Bloco 2'),
(21, '2026-06-16', '19:00:00', 'Iraque',      'Noruega',        1, 4, 'Bloco 2'),
(22, '2026-06-17', '01:00:00', 'Austria',     'Jordania',       3, 1, 'Bloco 2'),
(23, '2026-06-17', '23:00:00', 'Colômbia',    'Uzbequistão',    0, 0, 'Bloco 2'),
(24, '2026-06-17', '17:00:00', 'Inglaterra',  'Croácia',        0, 0, 'Bloco 2'),
-- Bloco 3 (Rodada 3 - Segunda rodada de cada seleção)
(25, '2026-06-18', '19:00:00', 'Tchéquia',    'South Africa',   NULL, NULL, 'Bloco 3'),
(26, '2026-06-18', '19:00:00', 'Canadá',      'Catar',          NULL, NULL, 'Bloco 3'),
(27, '2026-06-19', '21:30:00', 'Brasil',      'Haití',          NULL, NULL, 'Bloco 3'),
(28, '2026-06-19', '16:00:00', 'EUA',         'Austrália',      NULL, NULL, 'Bloco 3'),
(29, '2026-06-20', '17:00:00', 'Alemanha',    'Cost Marfim',    NULL, NULL, 'Bloco 3'),
(30, '2026-06-20', '14:00:00', 'Holanda',     'Suécia',         NULL, NULL, 'Bloco 3'),
(31, '2026-06-21', '16:00:00', 'Bélgica',     'Irã',            NULL, NULL, 'Bloco 3'),
(32, '2026-06-21', '13:00:00', 'Espanha',     'Arábia',         NULL, NULL, 'Bloco 3'),
(33, '2026-06-22', '18:00:00', 'França',      'Iraque',         NULL, NULL, 'Bloco 3'),
(34, '2026-06-22', '14:00:00', 'Argentina',   'Aústria',        NULL, NULL, 'Bloco 3'),
(35, '2026-06-23', '14:00:00', 'Portugal',    'Uzbequistão',    NULL, NULL, 'Bloco 3'),
(36, '2026-06-23', '20:00:00', 'Panamá',      'Croácia',        NULL, NULL, 'Bloco 3'),
-- Bloco 4 (Rodada 4 - Jogos paralelos da 2ª rodada)
(37, '2026-06-18', '16:00:00', 'México',      'Coréa',          NULL, NULL, 'Bloco 4'),
(38, '2026-06-18', '16:00:00', 'Suíça',       'Bósnia',         NULL, NULL, 'Bloco 4'),
(39, '2026-06-19', '19:00:00', 'Escócia',     'Marrocos',       NULL, NULL, 'Bloco 4'),
(40, '2026-06-20', '01:00:00', 'Turquia',     'Paraguai',       NULL, NULL, 'Bloco 4'),
(41, '2026-06-20', '21:00:00', 'Equador',     'Curaçao',        NULL, NULL, 'Bloco 4'),
(42, '2026-06-21', '01:00:00', 'Tunisia',     'Japão',          NULL, NULL, 'Bloco 4'),
(43, '2026-06-21', '22:00:00', 'Nova Zelandia','Egito',         NULL, NULL, 'Bloco 4'),
(44, '2026-06-21', '19:00:00', 'Uruguai',     'Cabo verde',     NULL, NULL, 'Bloco 4'),
(45, '2026-06-22', '21:00:00', 'Noroega',     'Senegal',        NULL, NULL, 'Bloco 4'),
(46, '2026-06-23', '00:00:00', 'Jordania',    'Argélia',        NULL, NULL, 'Bloco 4'),
(47, '2026-06-23', '23:00:00', 'Colômbia',    'RD Congo',       NULL, NULL, 'Bloco 4'),
(48, '2026-06-23', '17:00:00', 'Inglaterra',  'Gana',           NULL, NULL, 'Bloco 4'),
-- Bloco 5 (Rodada 5 - Terceira rodada de cada seleção)
(49, '2026-06-24', '16:00:00', 'Tchéquia',    'México',         NULL, NULL, 'Bloco 5'),
(50, '2026-06-24', '16:00:00', 'Suíça',       'Canadá',         NULL, NULL, 'Bloco 5'),
(51, '2026-06-24', '19:00:00', 'Marrocos',    'Haití',          NULL, NULL, 'Bloco 5'),
(52, '2026-06-25', '23:00:00', 'Turquia',     'EUA',            NULL, NULL, 'Bloco 5'),
(53, '2026-06-25', '17:00:00', 'Curaçao',     'Cost Marfim',    NULL, NULL, 'Bloco 5'),
(54, '2026-06-25', '20:00:00', 'Japão',       'Suécia',         NULL, NULL, 'Bloco 5'),
(55, '2026-06-27', '00:00:00', 'Egito',       'Irã',            NULL, NULL, 'Bloco 5'),
(56, '2026-06-26', '21:00:00', 'Uruguai',     'Espanha',        NULL, NULL, 'Bloco 5'),
(57, '2026-06-26', '16:00:00', 'Noroega',     'França',         NULL, NULL, 'Bloco 5'),
(58, '2026-06-27', '23:00:00', 'Argélia',     'Aústria',        NULL, NULL, 'Bloco 5'),
(59, '2026-06-27', '20:30:00', 'Colômbia',    'Portugal',       NULL, NULL, 'Bloco 5'),
(60, '2026-06-27', '18:00:00', 'Croácia',     'Gana',           NULL, NULL, 'Bloco 5'),
-- Bloco 6 (Rodada 6 - Terceira rodada paralela)
(61, '2026-06-24', '16:00:00', 'South Africa','Corea',          NULL, NULL, 'Bloco 6'),
(62, '2026-06-24', '16:00:00', 'Bósnia',      'Catar',          NULL, NULL, 'Bloco 6'),
(63, '2026-06-24', '19:00:00', 'Escócia',     'Brasil',         NULL, NULL, 'Bloco 6'),
(64, '2026-06-25', '23:00:00', 'Paraguai',    'Austrália',      NULL, NULL, 'Bloco 6'),
(65, '2026-06-25', '17:00:00', 'Equador',     'Alemanha',       NULL, NULL, 'Bloco 6'),
(66, '2026-06-25', '20:00:00', 'Tunisia',     'Holanda',        NULL, NULL, 'Bloco 6'),
(67, '2026-06-27', '00:00:00', 'Bélgica',     'Nova Zelandia',  NULL, NULL, 'Bloco 6'),
(68, '2026-06-26', '21:00:00', 'Cabo',        'Arábia',         NULL, NULL, 'Bloco 6'),
(69, '2026-06-26', '16:00:00', 'Senegal',     'Iraque',         NULL, NULL, 'Bloco 6'),
(70, '2026-06-27', '23:00:00', 'Jordania',    'Argentina',      NULL, NULL, 'Bloco 6'),
(71, '2026-06-27', '20:30:00', 'RD Congo',    'Uzbequistão',    NULL, NULL, 'Bloco 6'),
(72, '2026-06-27', '18:00:00', 'Panamá',      'Inglaterra',     3,    0,    'Bloco 6')
ON CONFLICT (id) DO NOTHING;
