import { createClient } from '@supabase/supabase-js'

// Função de normalização para correspondência de times
const normalizarNome = (nome) => {
  if (!nome) return "";
  let n = nome.trim().toLowerCase();
  n = n.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  
  if (n === 'corea' || n === 'coreia' || n === 'corea do sul') return 'coreia do sul';
  if (n === 'bosnia') return 'bosnia e herz.';
  if (n === 'costa de marfim' || n === 'cost marfim') return 'costa do marfim';
  if (n === 'catar' || n === 'qatar') return 'catar';
  if (n === 'haiti') return 'haiti';
  if (n === 'panama') return 'panama';
  if (n === 'tunisia') return 'tunisia';
  if (n === 'nova zelandia') return 'nova zelandia';
  if (n === 'arabia' || n === 'arab saudita') return 'arabia saudita';
  if (n === 'austria' || n === 'austria') return 'austria';
  if (n === 'australia') return 'australia';
  if (n === 'noroega') return 'noruega';
  if (n === 'cabo') return 'cabo verde';
  
  return n;
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  const { jogos: jogosPlanilha, palpites: palpitesPlanilha } = req.body;

  if (!jogosPlanilha || !palpitesPlanilha) {
    return res.status(400).json({ error: 'Corpo da requisição inválido. Faltando jogos ou palpites.' });
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Chave de serviço que burla RLS

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Variáveis de ambiente do Supabase não configuradas no servidor Vercel.' });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // 1. Buscar jogos atuais do banco de dados para mapear IDs
    const { data: jogosDB, error: errJogosDB } = await supabase
      .from('jogos')
      .select('*');
      
    if (errJogosDB) {
      return res.status(500).json({ error: `Erro ao buscar jogos do DB: ${errJogosDB.message}` });
    }

    // Criar um mapa de busca de jogos no banco por times normalizados
    const mapaJogosDB = {};
    jogosDB.forEach(jogo => {
      const casaNorm = normalizarNome(jogo.time_casa);
      const foraNorm = normalizarNome(jogo.time_fora);
      const chave = `${casaNorm}_vs_${foraNorm}`;
      mapaJogosDB[chave] = jogo;
    });

    // 2. Atualizar os placares oficiais dos jogos se estiverem presentes na planilha
    let placaresAtualizadosCount = 0;
    const logsAtualizacoes = [];
    
    for (const jogoPlanilha of jogosPlanilha) {
      const casaNorm = normalizarNome(jogoPlanilha.time_casa);
      const foraNorm = normalizarNome(jogoPlanilha.time_fora);
      const chave = `${casaNorm}_vs_${foraNorm}`;
      const chaveInvertida = `${foraNorm}_vs_${casaNorm}`;
      
      let jogoDB = mapaJogosDB[chave];
      let inverter = false;
      
      if (!jogoDB) {
        jogoDB = mapaJogosDB[chaveInvertida];
        if (jogoDB) {
          inverter = true;
        }
      }
      
      if (!jogoDB) {
        logsAtualizacoes.push(`Aviso: Jogo não encontrado no banco: ${jogoPlanilha.time_casa} x ${jogoPlanilha.time_fora}`);
        continue;
      }
      
      if (jogoPlanilha.gols_casa_real !== null && jogoPlanilha.gols_fora_real !== null) {
        const gols_casa_real = inverter ? jogoPlanilha.gols_fora_real : jogoPlanilha.gols_casa_real;
        const gols_fora_real = inverter ? jogoPlanilha.gols_casa_real : jogoPlanilha.gols_fora_real;
        
        if (jogoDB.gols_casa_real !== gols_casa_real || jogoDB.gols_fora_real !== gols_fora_real) {
          const { error: errUpdate } = await supabase
            .from('jogos')
            .update({
              gols_casa_real,
              gols_fora_real
            })
            .eq('id', jogoDB.id);
            
          if (!errUpdate) {
            logsAtualizacoes.push(`Placar atualizado: ${jogoDB.time_casa} ${gols_casa_real} x ${gols_fora_real} ${jogoDB.time_fora} ${inverter ? '(mando invertido na planilha)' : ''}`);
            placaresAtualizadosCount++;
            jogoDB.gols_casa_real = gols_casa_real;
            jogoDB.gols_fora_real = gols_fora_real;
          }
        }
      }
    }

    // 3. Mapear palpites para os IDs reais
    const palpitesParaUpsert = [];
    let palpitesIgnorados = 0;
    const logsPalpitesIgnorados = [];
    
    for (const palpite of palpitesPlanilha) {
      const casaNorm = normalizarNome(palpite.time_casa);
      const foraNorm = normalizarNome(palpite.time_fora);
      const chave = `${casaNorm}_vs_${foraNorm}`;
      const chaveInvertida = `${foraNorm}_vs_${casaNorm}`;
      
      let jogoDB = mapaJogosDB[chave];
      let inverter = false;
      
      if (!jogoDB) {
        jogoDB = mapaJogosDB[chaveInvertida];
        if (jogoDB) {
          inverter = true;
        }
      }
      
      if (!jogoDB) {
        palpitesIgnorados++;
        const descJogo = `${palpite.time_casa} x ${palpite.time_fora}`;
        if (!logsPalpitesIgnorados.includes(descJogo)) {
          logsPalpitesIgnorados.push(descJogo);
        }
        continue;
      }
      
      const palpite_casa = inverter ? palpite.palpite_fora : palpite.palpite_casa;
      const palpite_fora = inverter ? palpite.palpite_casa : palpite.palpite_fora;
      
      palpitesParaUpsert.push({
        jogo_id: jogoDB.id,
        jogador_nome: palpite.jogador_nome,
        palpite_casa,
        palpite_fora
      });
    }

    // 4. Enviar palpites ao Supabase (fazendo upsert)
    if (palpitesParaUpsert.length > 0) {
      const { error: errUpsert } = await supabase
        .from('palpites')
        .upsert(palpitesParaUpsert, { onConflict: 'jogo_id,jogador_nome' });
        
      if (errUpsert) {
        return res.status(500).json({ error: `Erro ao enviar palpites via upsert: ${errUpsert.message}` });
      }
    }

    return res.status(200).json({
      success: true,
      placaresAtualizados: placaresAtualizadosCount,
      palpitesEnviados: palpitesParaUpsert.length,
      palpitesIgnorados,
      jogosNaoMapeados: logsPalpitesIgnorados,
      logs: logsAtualizacoes
    });

  } catch (error) {
    return res.status(500).json({ error: `Erro fatal no servidor: ${error.message}` });
  }
}
