import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  // Proteção básica para impedir chamadas públicas aleatórias (O Vercel envia um header especial via Cron)
  // No Vercel Cron, ele envia "Bearer process.env.CRON_SECRET" no Authorization header se configurado
  const authHeader = req.headers.authorization;
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized request' });
  }

  // Chaves do Supabase
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return res.status(500).json({ error: 'Faltando variáveis de ambiente do Supabase no Vercel (URL ou SERVICE_ROLE_KEY)' });
  }

  // ATENÇÃO: Aqui usamos o service_role key, que ignora as regras do RLS e tem permissão de escrita de admin!
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // MOCK DE DADOS DA API DE ESPORTES SUBSTITUIDO PELO OFICIAL
  // Fazemos o fetch do JSON público e em tempo real do OpenFootball (worldcup.json)
  let data;
  try {
    const res = await fetch('https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json');
    data = await res.json();
  } catch (err) {
    console.error('Erro ao buscar API externa', err);
    return res.status(500).json({ error: 'Falha ao conectar com API de esportes' });
  }

  const apiMatches = data.matches;

  // Dicionário de tradução dos nomes das Seleções (API em inglês -> Nosso Banco em PT-BR)
  const nameTranslation = {
    // Grupo A
    "Mexico": "México",
    "South Africa": "África do Sul",
    "South Korea": "Coreia do Sul",
    "Czech Republic": "Tchéquia",
    // Grupo B
    "Canada": "Canadá",
    "Bosnia & Herzegovina": "Bósnia e Herz.",
    "Qatar": "Catar",
    "Switzerland": "Suíça",
    // Grupo C
    "Brazil": "Brasil",
    "Morocco": "Marrocos",
    "Haiti": "Haiti",
    "Scotland": "Escócia",
    // Grupo D
    "USA": "EUA",
    "Paraguay": "Paraguai",
    "Australia": "Australia",
    "Turkey": "Turquia",
    // Grupo E
    "Germany": "Alemanha",
    "Curaçao": "Curaçao",
    "Ivory Coast": "Costa do Marfim",
    "Ecuador": "Equador",
    // Grupo F
    "Netherlands": "Holanda",
    "Japan": "Japão",
    "Sweden": "Suécia",
    "Tunisia": "Tunísia",
    // Grupo G
    "Belgium": "Bélgica",
    "Egypt": "Egito",
    "Iran": "Irã",
    "New Zealand": "Nova Zelândia",
    // Grupo H
    "Spain": "Espanha",
    "Cape Verde": "Cabo Verde",
    "Saudi Arabia": "Arábia Saudita",
    "Uruguay": "Uruguai",
    // Grupo I
    "France": "França",
    "Senegal": "Senegal",
    "Iraq": "Iraque",
    "Norway": "Noruega",
    // Grupo J
    "Argentina": "Argentina",
    "Algeria": "Argélia",
    "Austria": "Austria",
    "Jordan": "Jordânia",
    // Grupo K
    "Portugal": "Portugal",
    "DR Congo": "RD Congo",
    "Uzbekistan": "Uzbequistão",
    "Colombia": "Colômbia",
    // Grupo L
    "England": "Inglaterra",
    "Croatia": "Croácia",
    "Ghana": "Gana",
    "Panama": "Panama"
  };

  try {
    const atualizacoes = [];

    // Loop pelos jogos recebidos da API
    for (const match of apiMatches) {
      // O OpenFootball envia os placares apenas se o jogo aconteceu (score.ft existe)
      if (!match.score || !match.score.ft) continue;

      const goalsHome = match.score.ft[0];
      const goalsAway = match.score.ft[1];

      const homeTranslated = nameTranslation[match.team1] || match.team1;
      const awayTranslated = nameTranslation[match.team2] || match.team2;

      // Busca no banco um jogo com esses dois times
      // O Supabase tem .ilike() para ignorar maiúsculas/minúsculas
      const { data: jogos, error } = await supabase
        .from('jogos')
        .select('id, time_casa, time_fora')
        .ilike('time_casa', homeTranslated)
        .ilike('time_fora', awayTranslated);

      if (error) {
        console.error('Erro ao buscar jogo:', error);
        continue;
      }

      if (jogos && jogos.length > 0) {
        // Encontrou o jogo! Vamos gravar o placar oficial nele
        const dbMatch = jogos[0];
        const { error: updateError } = await supabase
          .from('jogos')
          .update({
            gols_casa_real: goalsHome,
            gols_fora_real: goalsAway
          })
          .eq('id', dbMatch.id);

        if (updateError) {
          console.error(`Erro ao atualizar jogo ${dbMatch.id}:`, updateError);
        } else {
          atualizacoes.push({ 
            id: dbMatch.id, 
            home: homeTranslated, 
            away: awayTranslated, 
            gols_casa: goalsHome, 
            gols_fora: goalsAway 
          });
        }
      }
    }

    return res.status(200).json({ 
      success: true, 
      message: 'Rotina de robô finalizada com sucesso.', 
      jogosAtualizados: atualizacoes 
    });

  } catch (error) {
    console.error('Erro interno no robô:', error);
    return res.status(500).json({ error: 'Erro interno no servidor' });
  }
}
