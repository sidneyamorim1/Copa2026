-- 1. Garante que a coluna 'hora' pode ficar em branco sem dar erro de constraint
ALTER TABLE public.jogos ALTER COLUMN hora DROP NOT NULL;

-- 2. Limpa qualquer resquício de jogos do mata-mata antigos que possam estar pela metade
DELETE FROM public.jogos WHERE id >= 73;

-- 3. Insere todos os 32 jogos do Mata-Mata oficiais (já com a hora em branco/NULL)
INSERT INTO public.jogos (id, data, hora, time_casa, time_fora, gols_casa_real, gols_fora_real, grupo, fase) VALUES
-- 16-avos de final (16 jogos)
(73, '2026-06-28', NULL, '1º Grupo A', '2º Grupo B', NULL, NULL, '16-avos', 'Mata-Mata'),
(74, '2026-06-28', NULL, '1º Grupo C', '2º Grupo D', NULL, NULL, '16-avos', 'Mata-Mata'),
(75, '2026-06-29', NULL, '1º Grupo E', '2º Grupo F', NULL, NULL, '16-avos', 'Mata-Mata'),
(76, '2026-06-29', NULL, '1º Grupo G', '2º Grupo H', NULL, NULL, '16-avos', 'Mata-Mata'),
(77, '2026-06-29', NULL, '1º Grupo I', '2º Grupo J', NULL, NULL, '16-avos', 'Mata-Mata'),
(78, '2026-06-30', NULL, '1º Grupo K', '2º Grupo L', NULL, NULL, '16-avos', 'Mata-Mata'),
(79, '2026-06-30', NULL, '2º Grupo A', 'Melhor 3º (1)', NULL, NULL, '16-avos', 'Mata-Mata'),
(80, '2026-06-30', NULL, '2º Grupo C', 'Melhor 3º (2)', NULL, NULL, '16-avos', 'Mata-Mata'),
(81, '2026-07-01', NULL, '2º Grupo E', 'Melhor 3º (3)', NULL, NULL, '16-avos', 'Mata-Mata'),
(82, '2026-07-01', NULL, '2º Grupo G', 'Melhor 3º (4)', NULL, NULL, '16-avos', 'Mata-Mata'),
(83, '2026-07-01', NULL, '2º Grupo I', 'Melhor 3º (5)', NULL, NULL, '16-avos', 'Mata-Mata'),
(84, '2026-07-02', NULL, '2º Grupo K', 'Melhor 3º (6)', NULL, NULL, '16-avos', 'Mata-Mata'),
(85, '2026-07-02', NULL, 'Venc. Grupo X1', 'Melhor 3º (7)', NULL, NULL, '16-avos', 'Mata-Mata'),
(86, '2026-07-02', NULL, 'Venc. Grupo X2', 'Melhor 3º (8)', NULL, NULL, '16-avos', 'Mata-Mata'),
(87, '2026-07-03', NULL, 'Venc. Grupo X3', 'Venc. Grupo Y1', NULL, NULL, '16-avos', 'Mata-Mata'),
(88, '2026-07-03', NULL, 'Venc. Grupo X4', 'Venc. Grupo Y2', NULL, NULL, '16-avos', 'Mata-Mata'),

-- Oitavas de final (8 jogos)
(89, '2026-07-04', NULL, 'Venc. Jogo 73', 'Venc. Jogo 74', NULL, NULL, 'Oitavas', 'Mata-Mata'),
(90, '2026-07-04', NULL, 'Venc. Jogo 75', 'Venc. Jogo 76', NULL, NULL, 'Oitavas', 'Mata-Mata'),
(91, '2026-07-05', NULL, 'Venc. Jogo 77', 'Venc. Jogo 78', NULL, NULL, 'Oitavas', 'Mata-Mata'),
(92, '2026-07-05', NULL, 'Venc. Jogo 79', 'Venc. Jogo 80', NULL, NULL, 'Oitavas', 'Mata-Mata'),
(93, '2026-07-06', NULL, 'Venc. Jogo 81', 'Venc. Jogo 82', NULL, NULL, 'Oitavas', 'Mata-Mata'),
(94, '2026-07-06', NULL, 'Venc. Jogo 83', 'Venc. Jogo 84', NULL, NULL, 'Oitavas', 'Mata-Mata'),
(95, '2026-07-07', NULL, 'Venc. Jogo 85', 'Venc. Jogo 86', NULL, NULL, 'Oitavas', 'Mata-Mata'),
(96, '2026-07-07', NULL, 'Venc. Jogo 87', 'Venc. Jogo 88', NULL, NULL, 'Oitavas', 'Mata-Mata'),

-- Quartas de final (4 jogos)
(97, '2026-07-10', NULL, 'Venc. Jogo 89', 'Venc. Jogo 90', NULL, NULL, 'Quartas', 'Mata-Mata'),
(98, '2026-07-10', NULL, 'Venc. Jogo 91', 'Venc. Jogo 92', NULL, NULL, 'Quartas', 'Mata-Mata'),
(99, '2026-07-11', NULL, 'Venc. Jogo 93', 'Venc. Jogo 94', NULL, NULL, 'Quartas', 'Mata-Mata'),
(100, '2026-07-11', NULL, 'Venc. Jogo 95', 'Venc. Jogo 96', NULL, NULL, 'Quartas', 'Mata-Mata'),

-- Semifinais (2 jogos)
(101, '2026-07-14', NULL, 'Venc. Jogo 97', 'Venc. Jogo 98', NULL, NULL, 'Semi', 'Mata-Mata'),
(102, '2026-07-15', NULL, 'Venc. Jogo 99', 'Venc. Jogo 100', NULL, NULL, 'Semi', 'Mata-Mata'),

-- Terceiro lugar (1 jogo)
(103, '2026-07-18', NULL, 'Perdedor Jogo 101', 'Perdedor Jogo 102', NULL, NULL, 'Terceiro Lugar', 'Mata-Mata'),

-- Final (1 jogo)
(104, '2026-07-19', NULL, 'Venc. Jogo 101', 'Venc. Jogo 102', NULL, NULL, 'Final', 'Mata-Mata');
