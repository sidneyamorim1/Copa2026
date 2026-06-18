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

  // MOCK DE DADOS DA API DE ESPORTES (Simulação da Copa)
  // Futuramente isso será substituído por: const response = await fetch('https://api-football-v1.p.rapidapi.com/v3/fixtures?league=1&season=2026')
  const mockApiResults = [
    {
      teamHomeName: 'Czech Republic', // Nome que costuma vir em inglês
      teamAwayName: 'Senegal',
      goalsHome: 2,
      goalsAway: 1,
      status: 'Match Finished'
    },
    {
      teamHomeName: 'Argentina',
      teamAwayName: 'Cameroon',
      goalsHome: 3,
      goalsAway: 0,
      status: 'Match Finished'
    }
  ];

  // Dicionário de tradução dos nomes das Seleções (API em inglês -> Nosso Banco em PT-BR)
  const nameTranslation = {
    'Czech Republic': 'Tchéquia',
    'Senegal': 'Senegal',
    'Argentina': 'Argentina',
    'Cameroon': 'Camarões',
    'Brazil': 'Brasil',
    'Switzerland': 'Suíça',
    'Germany': 'Alemanha',
    'Spain': 'Espanha'
  };

  try {
    const atualizacoes = [];

    // Loop pelos jogos encerrados recebidos da API
    for (const match of mockApiResults) {
      if (match.status !== 'Match Finished') continue;

      const homeTranslated = nameTranslation[match.teamHomeName] || match.teamHomeName;
      const awayTranslated = nameTranslation[match.teamAwayName] || match.teamAwayName;

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
        const jogo = jogos[0];
        const { error: updateError } = await supabase
          .from('jogos')
          .update({
            gols_casa_real: match.goalsHome,
            gols_fora_real: match.goalsAway
          })
          .eq('id', jogo.id);

        if (updateError) {
          console.error(`Erro ao atualizar jogo ${jogo.id}:`, updateError);
        } else {
          atualizacoes.push({ 
            id: jogo.id, 
            home: homeTranslated, 
            away: awayTranslated, 
            gols_casa: match.goalsHome, 
            gols_fora: match.goalsAway 
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
