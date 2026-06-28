import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env if it exists
let envUrl = '';
let envKey = '';
if (fs.existsSync(path.join(__dirname, '.env'))) {
  const envContent = fs.readFileSync(path.join(__dirname, '.env'), 'utf8');
  const lines = envContent.split('\n');
  for (const line of lines) {
    const matchUrl = line.match(/^\s*VITE_SUPABASE_URL\s*=\s*(.*)\s*$/);
    const matchKey = line.match(/^\s*VITE_SUPABASE_ANON_KEY\s*=\s*(.*)\s*$/);
    if (matchUrl) envUrl = matchUrl[1].replace(/['"]/g, '').trim();
    if (matchKey) envKey = matchKey[1].replace(/['"]/g, '').trim();
  }
}

// Re-implementation of calcularPontos
function calcularPontos(palpiteCasa, palpiteFora, jogo) {
  const realCasa = jogo.gols_casa_real;
  const realFora = jogo.gols_fora_real;

  if (realCasa === null || realFora === null) return 0;
  if (palpiteCasa === null || palpiteFora === null) return 0;
  
  const pc = parseInt(palpiteCasa, 10);
  const pf = parseInt(palpiteFora, 10);
  const rc = parseInt(realCasa, 10);
  const rf = parseInt(realFora, 10);
  
  // 1. Placar Exato: +5 pontos
  if (pc === rc && pf === rf) {
    return 5;
  }
  
  // 2. Placar Invertido Exato: -3 pontos
  if (pc === rf && pf === rc && rc !== rf) {
    return -3;
  }
  
  // 3. Acertou Vencedor ou Empate: +3 pontos
  let vencedorReal = rc > rf ? 'casa' : (rc < rf ? 'fora' : 'empate');
  if (jogo.fase === 'Mata-Mata' && vencedorReal === 'empate' && jogo.vencedor_penaltis) {
    vencedorReal = jogo.vencedor_penaltis;
  }
  const vencedorPalpite = pc > pf ? 'casa' : (pc < pf ? 'fora' : 'empate');
  
  if (vencedorReal === vencedorPalpite && vencedorReal !== 'empate') {
    return 3;
  }
  if (vencedorReal === 'empate' && vencedorPalpite === 'empate') {
    return 3;
  }
  
  return 0;
}

async function getRanking() {
  let jogos = [];
  let palpites = [];
  let source = 'local seed JSON files';

  if (envUrl && envKey) {
    console.log('Supabase credentials found in .env. Fetching from database...');
    try {
      const supabase = createClient(envUrl, envKey);
      const { data: dbJogos, error: errJogos } = await supabase.from('jogos').select('*');
      if (errJogos) throw errJogos;
      
      const { data: dbPalpites, error: errPalpites } = await supabase.from('palpites').select('*');
      if (errPalpites) throw errPalpites;

      // Normalise data format
      // In db.js:
      // data: formatarDataParaBR(j.data),
      // hora: j.hora ? j.hora.slice(0, 5) : null,
      jogos = dbJogos.map(j => ({
        id: j.id,
        data: j.data, // database format
        time_casa: j.time_casa,
        time_fora: j.time_fora,
        gols_casa_real: j.gols_casa_real,
        gols_fora_real: j.gols_fora_real,
        grupo: j.grupo,
        fase: j.fase,
        vencedor_penaltis: j.vencedor_penaltis
      }));

      palpites = dbPalpites;
      source = 'Supabase database';
    } catch (e) {
      console.warn('Failed to fetch from Supabase. Falling back to local seeds...', e.message);
      // Fallback
      jogos = JSON.parse(fs.readFileSync(path.join(__dirname, 'src/seed.json'), 'utf8'));
      palpites = JSON.parse(fs.readFileSync(path.join(__dirname, 'src/palpites_seed.json'), 'utf8'));
    }
  } else {
    console.log('No Supabase credentials found. Calculating from local seeds...');
    jogos = JSON.parse(fs.readFileSync(path.join(__dirname, 'src/seed.json'), 'utf8'));
    palpites = JSON.parse(fs.readFileSync(path.join(__dirname, 'src/palpites_seed.json'), 'utf8'));
  }

  console.log(`Loaded ${jogos.length} games and ${palpites.length} predictions from ${source}.`);

  const participantesUnicos = Array.from(new Set(palpites.map(p => p.jogador_nome.toLowerCase())))
    .map(nomeLower => {
      return palpites.find(p => p.jogador_nome.toLowerCase() === nomeLower).jogador_nome;
    });

  const ranking = participantesUnicos.map(nome => {
    let pontos = 0;
    let acertos = 0;
    let erros = 0;
    let qtdPalpites = 0;

    const palpitesDoJogador = palpites.filter(p => p.jogador_nome.toLowerCase() === nome.toLowerCase());

    palpitesDoJogador.forEach(p => {
      const jogo = jogos.find(j => j.id === p.jogo_id);
      if (jogo && jogo.gols_casa_real !== null && jogo.gols_fora_real !== null) {
        const pts = calcularPontos(p.palpite_casa, p.palpite_fora, jogo);
        pontos += pts;
        qtdPalpites++;
        if (pts > 0) {
          acertos += 1;
        } else {
          erros += 1;
        }
      }
    });

    return {
      jogador: nome,
      pontos,
      acertos,
      erros,
      total_palpites_calculados: qtdPalpites
    };
  });

  ranking.sort((a, b) => {
    if (b.pontos !== a.pontos) return b.pontos - a.pontos;
    if (b.acertos !== a.acertos) return b.acertos - a.acertos;
    if (a.erros !== b.erros) return a.erros - b.erros;
    return a.jogador.localeCompare(b.jogador);
  });

  console.log('\n--- RANKING GERAL ---');
  ranking.forEach((r, idx) => {
    console.log(`${idx + 1}. ${r.jogador}: ${r.pontos} pts (${r.acertos} acertos, ${r.erros} erros, de ${r.total_palpites_calculados} palpites computados)`);
  });
}

getRanking();
