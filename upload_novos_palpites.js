import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error("Erro: VITE_SUPABASE_URL ou VITE_SUPABASE_ANON_KEY não definidos no ambiente!")
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

// Função de normalização para correspondência de times tolerante a acentos e pequenas variações
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
  
  return n;
};

async function run() {
  try {
    // 1. Carregar jogos do JSON gerado
    const dataPath = '/Users/geniantis/.gemini/antigravity-ide/scratch/novos_palpites.json'
    if (!fs.existsSync(dataPath)) {
      console.error(`Erro: Arquivo ${dataPath} não encontrado! Execute o script python primeiro.`);
      process.exit(1);
    }
    
    const parsedData = JSON.parse(fs.readFileSync(dataPath, 'utf8'))
    const { jogos: jogosPlanilha, palpites: palpitesPlanilha } = parsedData
    
    console.log(`Carregados ${jogosPlanilha.length} jogos e ${palpitesPlanilha.length} palpites da planilha.`);

    // 2. Buscar jogos atuais do banco de dados para mapear IDs
    console.log("Buscando jogos cadastrados no Supabase...");
    const { data: jogosDB, error: errJogosDB } = await supabase
      .from('jogos')
      .select('*')
      
    if (errJogosDB) {
      throw new Error(`Erro ao buscar jogos do DB: ${errJogosDB.message}`);
    }
    
    console.log(`Encontrados ${jogosDB.length} jogos no banco de dados.`);

    // Criar um mapa de busca de jogos no banco por times normalizados
    const mapaJogosDB = {};
    jogosDB.forEach(jogo => {
      const casaNorm = normalizarNome(jogo.time_casa);
      const foraNorm = normalizarNome(jogo.time_fora);
      const chave = `${casaNorm}_vs_${foraNorm}`;
      mapaJogosDB[chave] = jogo;
    });

    // 3. Atualizar os placares oficiais dos jogos se estiverem presentes na planilha
    console.log("Atualizando placares oficiais dos jogos no Supabase...");
    let placaresAtualizadosCount = 0;
    
    for (const jogoPlanilha of jogosPlanilha) {
      const casaNorm = normalizarNome(jogoPlanilha.time_casa);
      const foraNorm = normalizarNome(jogoPlanilha.time_fora);
      const chave = `${casaNorm}_vs_${foraNorm}`;
      
      const jogoDB = mapaJogosDB[chave];
      if (!jogoDB) {
        console.warn(`Aviso: Jogo da planilha não encontrado no banco de dados: ${jogoPlanilha.time_casa} x ${jogoPlanilha.time_fora}`);
        continue;
      }
      
      // Se houver gols definidos (não nulos) na planilha
      if (jogoPlanilha.gols_casa_real !== null && jogoPlanilha.gols_fora_real !== null) {
        // Só atualiza se o placar for diferente no banco
        if (jogoDB.gols_casa_real !== jogoPlanilha.gols_casa_real || jogoDB.gols_fora_real !== jogoPlanilha.gols_fora_real) {
          const { error: errUpdate } = await supabase
            .from('jogos')
            .update({
              gols_casa_real: jogoPlanilha.gols_casa_real,
              gols_fora_real: jogoPlanilha.gols_fora_real,
              vencedor_penaltis: jogoPlanilha.vencedor_penaltis ?? jogoDB.vencedor_penaltis ?? null
            })
            .eq('id', jogoDB.id);
            
          if (errUpdate) {
            console.error(`Erro ao atualizar placar do jogo ${jogoDB.id} (${jogoDB.time_casa} x ${jogoDB.time_fora}):`, errUpdate.message);
          } else {
            console.log(`Placar atualizado no banco: ${jogoDB.time_casa} ${jogoPlanilha.gols_casa_real} x ${jogoPlanilha.gols_fora_real} ${jogoDB.time_fora}`);
            placaresAtualizadosCount++;
            // Atualiza no mapa local também
            jogoDB.gols_casa_real = jogoPlanilha.gols_casa_real;
            jogoDB.gols_fora_real = jogoPlanilha.gols_fora_real;
          }
        }
      }
    }
    console.log(`Total de placares atualizados: ${placaresAtualizadosCount}`);

    // 4. Mapear palpites para os IDs reais e fazer o upload
    console.log("Processando palpites...");
    const palpitesParaUpsert = [];
    let palpitesIgnorados = 0;
    
    for (const palpite of palpitesPlanilha) {
      const casaNorm = normalizarNome(palpite.time_casa);
      const foraNorm = normalizarNome(palpite.time_fora);
      const chave = `${casaNorm}_vs_${foraNorm}`;
      
      const jogoDB = mapaJogosDB[chave];
      if (!jogoDB) {
        palpitesIgnorados++;
        continue;
      }
      
      palpitesParaUpsert.push({
        jogo_id: jogoDB.id,
        jogador_nome: palpite.jogador_nome,
        palpite_casa: palpite.palpite_casa,
        palpite_fora: palpite.palpite_fora
      });
    }
    
    console.log(`Total de palpites válidos para envio: ${palpitesParaUpsert.length}`);
    if (palpitesIgnorados > 0) {
      console.warn(`Aviso: ${palpitesIgnorados} palpites foram ignorados devido a jogos não correspondidos no banco.`);
    }

    // Fazer upsert em lotes
    if (palpitesParaUpsert.length > 0) {
      console.log("Enviando palpites ao Supabase (fazendo upsert)...");
      const { error: errUpsert } = await supabase
        .from('palpites')
        .upsert(palpitesParaUpsert, { onConflict: 'jogo_id,jogador_nome' });
        
      if (errUpsert) {
        throw new Error(`Erro ao enviar palpites via upsert: ${errUpsert.message}`);
      }
      console.log("Todos os palpites foram enviados com sucesso!");
    } else {
      console.log("Nenhum palpite para enviar.");
    }

    console.log("Sincronização com o Supabase concluída com sucesso!");
  } catch (err) {
    console.error("Erro fatal durante a sincronização:", err.message);
    process.exit(1);
  }
}

run();
