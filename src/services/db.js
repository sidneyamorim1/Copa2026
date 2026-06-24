import { getSupabaseClient, isSupabaseConfigured } from '../supabaseClient';
import seedGames from '../seed.json';
import seedPalpites from '../palpites_seed.json';

// Versão do seed - incrementar quando os dados mudarem para forçar reload
const SEED_VERSION = '1003';

// Chaves do localStorage
const LOCAL_JOGOS_KEY = 'bolao_jogos_local';
const LOCAL_PALPITES_KEY = 'bolao_palpites_local';
const LOCAL_SEED_VERSION_KEY = 'bolao_seed_version';

// Inicializa dados no localStorage se necessário
const inicializarLocalStorage = () => {
  const versaoAtual = localStorage.getItem(LOCAL_SEED_VERSION_KEY);
  
  // Se a versão mudou ou não existe, recarrega tudo do seed
  if (versaoAtual !== SEED_VERSION) {
    console.log(`Seed atualizado (v${versaoAtual} -> v${SEED_VERSION}). Recarregando dados...`);
    localStorage.setItem(LOCAL_JOGOS_KEY, JSON.stringify(seedGames));
    localStorage.setItem(LOCAL_PALPITES_KEY, JSON.stringify(
      seedPalpites.map(p => ({
        ...p,
        created_at: new Date().toISOString()
      }))
    ));
    localStorage.setItem(LOCAL_SEED_VERSION_KEY, SEED_VERSION);
  }
};

inicializarLocalStorage();

export const dbService = {
  // Obter todos os jogos
  async obterJogos() {
    if (isSupabaseConfigured()) {
      const supabase = getSupabaseClient();
      try {
        let { data: jogos, error } = await supabase
          .from('jogos')
          .select('*')
          .order('id', { ascending: true });
          
        if (error) throw error;
        
        // Se a tabela estiver vazia, faz o seed inicial automático
        if (!jogos || jogos.length === 0) {
          console.log('Tabela jogos está vazia no Supabase. Realizando carga inicial (seed)...');
          // Mapeia os dados do seed.json removendo o campo id para deixar o Supabase gerar,
          // ou enviando o id explicitamente se as constraints permitirem
          const jogosParaInserir = seedGames.map(j => ({
            id: j.id,
            data: formatarDataParaSQL(j.data),
            hora: j.hora.length === 5 ? `${j.hora}:00` : j.hora,
            time_casa: j.time_casa,
            time_fora: j.time_fora,
            gols_casa_real: j.gols_casa_real,
            gols_fora_real: j.gols_fora_real,
            grupo: j.grupo
          }));
          
          const { data: insertedData, error: insertError } = await supabase
            .from('jogos')
            .insert(jogosParaInserir)
            .select();
            
          if (insertError) throw insertError;
          return insertedData.sort((a, b) => a.id - b.id);
        }
        
        // Formata os campos retornados do banco de dados para coincidir com o formato esperado
        return jogos.map(j => ({
          id: j.id,
          data: formatarDataParaBR(j.data),
          hora: j.hora.slice(0, 5),
          time_casa: j.time_casa,
          time_fora: j.time_fora,
          gols_casa_real: j.gols_casa_real,
          gols_fora_real: j.gols_fora_real,
          grupo: j.grupo
        }));
      } catch (err) {
        console.error('Erro ao ler jogos do Supabase, utilizando fallback local:', err);
        return JSON.parse(localStorage.getItem(LOCAL_JOGOS_KEY));
      }
    } else {
      // Modo local
      return JSON.parse(localStorage.getItem(LOCAL_JOGOS_KEY));
    }
  },

  // Obter todos os palpites
  async obterPalpites() {
    if (isSupabaseConfigured()) {
      const supabase = getSupabaseClient();
      try {
        let { data: palpites, error } = await supabase
          .from('palpites')
          .select('*');
          
        if (error) throw error;
        return palpites || [];
      } catch (err) {
        console.error('Erro ao ler palpites do Supabase, utilizando fallback local:', err);
        return JSON.parse(localStorage.getItem(LOCAL_PALPITES_KEY));
      }
    } else {
      return JSON.parse(localStorage.getItem(LOCAL_PALPITES_KEY));
    }
  },

  // Salvar ou atualizar palpite
  async salvarPalpite(jogoId, jogadorNome, palpiteCasa, palpiteFora) {
    const nomeLimpo = jogadorNome.trim();
    if (!nomeLimpo) throw new Error('Nome do jogador é obrigatório');
    
    if (isSupabaseConfigured()) {
      const supabase = getSupabaseClient();
      try {
        // Tenta ver se já existe palpite para esse jogador nesse jogo
        const { data: existente } = await supabase
          .from('palpites')
          .select('id')
          .eq('jogo_id', jogoId)
          .ilike('jogador_nome', nomeLimpo)
          .maybeSingle();
          
        if (existente) {
          // Atualiza
          const { data, error } = await supabase
            .from('palpites')
            .update({
              palpite_casa: palpiteCasa,
              palpite_fora: palpiteFora
            })
            .eq('id', existente.id)
            .select();
            
          if (error) throw error;
          return data[0];
        } else {
          // Insere novo
          const { data, error } = await supabase
            .from('palpites')
            .insert({
              jogo_id: jogoId,
              jogador_nome: nomeLimpo,
              palpite_casa: palpiteCasa,
              palpite_fora: palpiteFora
            })
            .select();
            
          if (error) throw error;
          return data[0];
        }
      } catch (err) {
        console.error('Erro ao salvar palpite no Supabase, utilizando fallback local:', err);
        return this.salvarPalpiteLocal(jogoId, nomeLimpo, palpiteCasa, palpiteFora);
      }
    } else {
      return this.salvarPalpiteLocal(jogoId, nomeLimpo, palpiteCasa, palpiteFora);
    }
  },

  salvarPalpiteLocal(jogoId, jogadorNome, palpiteCasa, palpiteFora) {
    const palpites = JSON.parse(localStorage.getItem(LOCAL_PALPITES_KEY)) || [];
    const idx = palpites.findIndex(p => p.jogo_id === jogoId && p.jogador_nome.toLowerCase() === jogadorNome.toLowerCase());
    
    const novoPalpite = {
      id: idx >= 0 ? palpites[idx].id : crypto.randomUUID(),
      jogo_id: jogoId,
      jogador_nome: jogadorNome,
      palpite_casa: palpiteCasa,
      palpite_fora: palpiteFora,
      created_at: new Date().toISOString()
    };
    
    if (idx >= 0) {
      palpites[idx] = novoPalpite;
    } else {
      palpites.push(novoPalpite);
    }
    
    localStorage.setItem(LOCAL_PALPITES_KEY, JSON.stringify(palpites));
    return novoPalpite;
  },

  // Atualizar resultado oficial de um jogo
  async atualizarResultadoJogo(jogoId, golsCasa, golsFora, vencedorPenaltis = null) {
    if (isSupabaseConfigured()) {
      const supabase = getSupabaseClient();
      try {
        const { data, error } = await supabase
          .from('jogos')
          .update({
            gols_casa_real: golsCasa,
            gols_fora_real: golsFora,
            vencedor_penaltis: vencedorPenaltis
          })
          .eq('id', jogoId)
          .select();
          
        if (error) throw error;
        return data[0];
      } catch (err) {
        console.error('Erro ao atualizar resultado no Supabase, utilizando fallback local:', err);
        return this.atualizarResultadoLocal(jogoId, golsCasa, golsFora, vencedorPenaltis);
      }
    } else {
      return this.atualizarResultadoLocal(jogoId, golsCasa, golsFora, vencedorPenaltis);
    }
  },

  // Atualizar vários jogos de uma vez (para upload de CSV)
  async atualizarResultadosEmLote(atualizacoes) {
    if (isSupabaseConfigured()) {
      const supabase = getSupabaseClient();
      try {
        // Como o Supabase não suporta upsert fácil sem PK completo nesse caso simples,
        // vamos fazer um update para cada jogo ou Promise.all
        const promises = atualizacoes.map(upd => 
          supabase
            .from('jogos')
            .update({
              gols_casa_real: upd.golsCasa,
              gols_fora_real: upd.golsFora
            })
            .eq('id', upd.jogoId)
        );
        await Promise.all(promises);
        
        // Atualiza localStorage também para consistência rápida
        return this.atualizarResultadosEmLoteLocal(atualizacoes);
      } catch (err) {
        console.error('Erro no update em lote do Supabase, usando local:', err);
        return this.atualizarResultadosEmLoteLocal(atualizacoes);
      }
    } else {
      return this.atualizarResultadosEmLoteLocal(atualizacoes);
    }
  },

  atualizarResultadosEmLoteLocal(atualizacoes) {
    const jogos = JSON.parse(localStorage.getItem(LOCAL_JOGOS_KEY)) || [];
    
    atualizacoes.forEach(upd => {
      const idx = jogos.findIndex(j => j.id === upd.jogoId);
      if (idx >= 0) {
        jogos[idx].gols_casa_real = upd.golsCasa;
        jogos[idx].gols_fora_real = upd.golsFora;
      }
    });
    
    localStorage.setItem(LOCAL_JOGOS_KEY, JSON.stringify(jogos));
    return jogos;
  },

  // Importar apostas em lote (do CSV)
  async atualizarPalpitesEmLote(novosPalpites) {
    if (isSupabaseConfigured()) {
      const supabase = getSupabaseClient();
      try {
        // Upsert no Supabase usando a constraint (jogo_id, jogador_nome)
        const { error } = await supabase
          .from('palpites')
          .upsert(novosPalpites, { onConflict: 'jogo_id,jogador_nome' });
          
        if (error) throw error;
        
        // Puxa os dados consolidados da nuvem
        const { data: todosPalpites } = await supabase.from('palpites').select('*');
        if (todosPalpites) return todosPalpites;
        
      } catch (err) {
        console.error('Erro no supabase ao importar palpites em lote:', err);
      }
    }
    
    // Fallback/Principal local
    let palpitesAtuais = JSON.parse(localStorage.getItem(LOCAL_PALPITES_KEY)) || [];
    
    novosPalpites.forEach(np => {
      const idx = palpitesAtuais.findIndex(p => p.jogo_id === np.jogo_id && p.jogador_nome === np.jogador_nome);
      if (idx >= 0) {
        palpitesAtuais[idx] = np;
      } else {
        palpitesAtuais.push(np);
      }
    });
    
    localStorage.setItem(LOCAL_PALPITES_KEY, JSON.stringify(palpitesAtuais));
    return palpitesAtuais;
  },

  atualizarResultadoLocal(jogoId, golsCasa, golsFora, vencedorPenaltis = null) {
    let jogos = JSON.parse(localStorage.getItem(LOCAL_JOGOS_KEY) || '[]');
    let jogoAtualizado = null;
    
    jogos = jogos.map(j => {
      if (j.id === jogoId) {
        jogoAtualizado = { ...j, gols_casa_real: golsCasa, gols_fora_real: golsFora, vencedor_penaltis: vencedorPenaltis };
        return jogoAtualizado;
      }
      return j;
    });

    if (jogoAtualizado) {
      localStorage.setItem(LOCAL_JOGOS_KEY, JSON.stringify(jogos));
      return jogoAtualizado;
    }
    throw new Error('Jogo não encontrado no banco de dados local');
  },
  
  // Limpar configurações do Supabase locais
  limparConfiguracoesLocais() {
    localStorage.removeItem('bolao_supabase_url');
    localStorage.removeItem('bolao_supabase_anon_key');
    localStorage.removeItem(LOCAL_JOGOS_KEY);
    localStorage.removeItem(LOCAL_PALPITES_KEY);
    window.location.reload();
  },

  // Forçar sincronização do seed local (72 jogos) com o Supabase
  async forcarSincronizacaoSupabase() {
    if (!isSupabaseConfigured()) return false;
    
    const supabase = getSupabaseClient();
    try {
      // Deletar palpites primeiro devido à chave estrangeira
      await supabase.from('palpites').delete().neq('id', '00000000-0000-0000-0000-000000000000'); // hack para deletar todos
      await supabase.from('jogos').delete().neq('id', -1);
      
      // Inserir jogos
      const jogosParaInserir = seedGames.map(j => ({
        id: j.id,
        data: formatarDataParaSQL(j.data),
        hora: j.hora.length === 5 ? `${j.hora}:00` : j.hora,
        time_casa: j.time_casa,
        time_fora: j.time_fora,
        gols_casa_real: j.gols_casa_real,
        gols_fora_real: j.gols_fora_real,
        grupo: j.grupo
      }));
      
      const { error: insertJogosErr } = await supabase.from('jogos').insert(jogosParaInserir);
      if (insertJogosErr) throw insertJogosErr;
      
      return true;
    } catch (err) {
      console.error('Erro ao forçar sincronização com Supabase:', err);
      throw err;
    }
  },

  async apagarTudo() {
    if (!isSupabaseConfigured()) return false;
    const supabase = getSupabaseClient();
    try {
      await supabase.from('palpites').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('jogos').delete().neq('id', -1);
      return true;
    } catch (err) {
      console.error('Erro ao apagar tudo:', err);
      throw err;
    }
  }
};

// Funções utilitárias de data
function formatarDataParaSQL(dataBR) {
  // Converte DD/MM/YYYY para YYYY-MM-DD
  const partes = dataBR.split('/');
  if (partes.length === 3) {
    return `${partes[2]}-${partes[1]}-${partes[0]}`;
  }
  return dataBR;
}

function formatarDataParaBR(dataSQL) {
  // Converte YYYY-MM-DD para DD/MM/YYYY
  const partes = dataSQL.split('-');
  if (partes.length === 3) {
    return `${partes[2]}/${partes[1]}/${partes[0]}`;
  }
  return dataSQL;
}
