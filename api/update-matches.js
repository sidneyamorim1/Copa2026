import { createClient } from '@supabase/supabase-js';

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

function translateTeam(name) {
  if (!name) return "";
  const matchW = name.match(/^W(\d+)$/);
  if (matchW) return `Venc. Jogo ${matchW[1]}`;
  const matchL = name.match(/^L(\d+)$/);
  if (matchL) return `Perdedor Jogo ${matchL[1]}`;
  return nameTranslation[name] || name;
}

function convertToBrazilTime(dateStr, timeStr) {
  if (!timeStr) return { data: dateStr, hora: null };
  const timeParts = timeStr.split(' ');
  const baseTime = timeParts[0];
  const offsetPart = timeParts[1] || '';
  const offsetMatch = offsetPart.match(/UTC([+-]\d+)/);
  const offset = offsetMatch ? parseInt(offsetMatch[1], 10) : 0;
  const [hours, minutes] = baseTime.split(':').map(Number);
  const [year, month, day] = dateStr.split('-').map(Number);
  const utcDate = new Date(Date.UTC(year, month - 1, day, hours - offset, minutes));
  const brDate = new Date(utcDate.getTime() - 3 * 60 * 60 * 1000);
  const brDay = String(brDate.getUTCDate()).padStart(2, '0');
  const brMonth = String(brDate.getUTCMonth() + 1).padStart(2, '0');
  const brYear = brDate.getUTCFullYear();
  const brHours = String(brDate.getUTCHours()).padStart(2, '0');
  const brMinutes = String(brDate.getUTCMinutes()).padStart(2, '0');
  return {
    data: `${brYear}-${brMonth}-${brDay}`,
    hora: `${brHours}:${brMinutes}:00`
  };
}

export default async function handler(req, res) {
  // Proteção básica para impedir chamadas públicas aleatórias (O Vercel envia um header especial via Cron)
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

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  let data;
  try {
    const res = await fetch('https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json');
    data = await res.json();
  } catch (err) {
    console.error('Erro ao buscar API externa', err);
    return res.status(500).json({ error: 'Falha ao conectar com API de esportes' });
  }

  const apiMatches = data.matches;

  try {
    const atualizacoes = [];

    // Loop pelos jogos recebidos da API
    for (const match of apiMatches) {
      const homeTranslated = translateTeam(match.team1);
      const awayTranslated = translateTeam(match.team2);

      // Converte data e hora para fuso BR (em formato SQL YYYY-MM-DD e HH:MM:00)
      const brTime = convertToBrazilTime(match.date, match.time);

      let dbMatch = null;
      if (match.num) {
        // Busca diretamente pelo ID para evitar erros de tradução e inversão de times no mata-mata
        const { data: jogoById, error: errById } = await supabase
          .from('jogos')
          .select('id, time_casa, time_fora')
          .eq('id', match.num)
          .maybeSingle();
        
        if (errById) {
          console.error(`Erro ao buscar jogo por ID ${match.num}:`, errById);
        } else {
          dbMatch = jogoById;
        }
      } else {
        // Busca por times para a fase de grupos (onde match.num não existe no JSON da API)
        const { data: jogos, error: errByName } = await supabase
          .from('jogos')
          .select('id, time_casa, time_fora')
          .ilike('time_casa', homeTranslated)
          .ilike('time_fora', awayTranslated);
        
        if (errByName) {
          console.error('Erro ao buscar jogo por nome:', errByName);
        } else if (jogos && jogos.length > 0) {
          dbMatch = jogos[0];
        }
      }

      if (dbMatch) {
        // Encontrou o jogo! Vamos preparar os campos para gravar
        const updateData = {
          time_casa: homeTranslated,
          time_fora: awayTranslated,
          data: brTime.data
        };
        
        if (brTime.hora) {
          updateData.hora = brTime.hora;
        }

        // Resultados (apenas se o placar oficial já existe)
        let golsCasaReal = null;
        let golsForaReal = null;
        let vencedorPenaltis = null;
        let temPlacar = false;

        if (match.score && match.score.ft) {
          golsCasaReal = match.score.ft[0];
          golsForaReal = match.score.ft[1];
          temPlacar = true;
          
          updateData.gols_casa_real = golsCasaReal;
          updateData.gols_fora_real = golsForaReal;

          if (golsCasaReal === golsForaReal && (match.score.p || match.score.ps)) {
            const penScore = match.score.p || match.score.ps;
            vencedorPenaltis = penScore[0] > penScore[1] ? 'casa' : 'fora';
            updateData.vencedor_penaltis = vencedorPenaltis;
          } else {
            updateData.vencedor_penaltis = null;
          }
        }

        const { error: updateError } = await supabase
          .from('jogos')
          .update(updateData)
          .eq('id', dbMatch.id);

        if (updateError) {
          console.error(`Erro ao atualizar jogo ${dbMatch.id}:`, updateError);
        } else {
          atualizacoes.push({ 
            id: dbMatch.id, 
            home: homeTranslated, 
            away: awayTranslated, 
            gols_casa: golsCasaReal, 
            gols_fora: golsForaReal,
            vencedor_penaltis: vencedorPenaltis,
            data: brTime.data,
            hora: brTime.hora,
            temPlacar
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
