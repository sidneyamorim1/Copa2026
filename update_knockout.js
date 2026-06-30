import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
  
  // Mapear Wxx ou Lxx placeholder para formato amigável no bolão
  const matchW = name.match(/^W(\d+)$/);
  if (matchW) {
    return `Venc. Jogo ${matchW[1]}`;
  }
  const matchL = name.match(/^L(\d+)$/);
  if (matchL) {
    return `Perdedor Jogo ${matchL[1]}`;
  }
  
  return nameTranslation[name] || name;
}

function convertToBrazilTime(dateStr, timeStr) {
  // dateStr is 'YYYY-MM-DD'
  // timeStr is e.g. '12:00 UTC-7' or '16:30 UTC-4'
  const timeParts = timeStr.split(' ');
  const baseTime = timeParts[0]; // '12:00'
  const offsetPart = timeParts[1] || ''; // 'UTC-7'
  const offsetMatch = offsetPart.match(/UTC([+-]\d+)/);
  const offset = offsetMatch ? parseInt(offsetMatch[1], 10) : 0; // -7

  const [hours, minutes] = baseTime.split(':').map(Number);
  
  // Construct a Date object in UTC
  const [year, month, day] = dateStr.split('-').map(Number);
  // Subtract the source offset to get UTC time
  const utcDate = new Date(Date.UTC(year, month - 1, day, hours - offset, minutes));
  
  // Now subtract 3 hours to get UTC-3 (Brazil time)
  const brDate = new Date(utcDate.getTime() - 3 * 60 * 60 * 1000);
  
  // Format to DD/MM/YYYY and HH:MM
  const brDay = String(brDate.getUTCDate()).padStart(2, '0');
  const brMonth = String(brDate.getUTCMonth() + 1).padStart(2, '0');
  const brYear = brDate.getUTCFullYear();
  const brHours = String(brDate.getUTCHours()).padStart(2, '0');
  const brMinutes = String(brDate.getUTCMinutes()).padStart(2, '0');
  
  return {
    data: `${brDay}/${brMonth}/${brYear}`,
    hora: `${brHours}:${brMinutes}`
  };
}

async function updateKnockout() {
  try {
    console.log("Buscando dados da API oficial do worldcup.json...");
    const res = await fetch('https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json');
    const data = await res.json();
    const apiMatches = data.matches;

    // Carregar o seed.json atual
    const seedPath = path.join(__dirname, 'src/seed.json');
    const seedGames = JSON.parse(fs.readFileSync(seedPath, 'utf8'));

    const knockoutMatchesFromApi = apiMatches.filter(m => m.num >= 73);
    console.log(`Encontrados ${knockoutMatchesFromApi.length} jogos do mata-mata na API.`);

    let sqlUpdates = [];

    // Loop para atualizar os jogos em seedGames
    knockoutMatchesFromApi.forEach(apiMatch => {
      const id = apiMatch.num;
      const teamCasa = translateTeam(apiMatch.team1);
      const teamFora = translateTeam(apiMatch.team2);

      // Converte data e hora para fuso horário de Brasília
      const brTime = convertToBrazilTime(apiMatch.date, apiMatch.time);

      // Resultados
      let golsCasaReal = null;
      let golsForaReal = null;
      let vencedorPenaltis = null;

      if (apiMatch.score && apiMatch.score.ft) {
        golsCasaReal = apiMatch.score.ft[0];
        golsForaReal = apiMatch.score.ft[1];

        // Se empatou no mata-mata, verificar disputa por pênaltis (pode vir como 'p' ou 'ps')
        if (golsCasaReal === golsForaReal && (apiMatch.score.p || apiMatch.score.ps)) {
          const penScore = apiMatch.score.p || apiMatch.score.ps;
          vencedorPenaltis = penScore[0] > penScore[1] ? 'casa' : 'fora';
        }
      }

      // Encontrar jogo no seed.json
      const idx = seedGames.findIndex(j => j.id === id);
      if (idx !== -1) {
        // Atualizar campos do jogo no local JSON
        seedGames[idx].time_casa = teamCasa;
        seedGames[idx].time_fora = teamFora;
        seedGames[idx].data = brTime.data;
        seedGames[idx].hora = brTime.hora;
        seedGames[idx].gols_casa_real = golsCasaReal;
        seedGames[idx].gols_fora_real = golsForaReal;
        seedGames[idx].vencedor_penaltis = vencedorPenaltis;
        seedGames[idx].fase = "Mata-Mata"; // garantir que está como Mata-Mata
      }

      // Montar instrução SQL correspondente (data no formato YYYY-MM-DD para o banco de dados)
      const sqlDate = apiMatch.date; // já é YYYY-MM-DD
      const sqlTime = `${brTime.hora}:00`;
      
      const valGolsCasa = golsCasaReal !== null ? golsCasaReal : 'NULL';
      const valGolsFora = golsForaReal !== null ? golsForaReal : 'NULL';
      const valVencPenaltis = vencedorPenaltis !== null ? `'${vencedorPenaltis}'` : 'NULL';

      sqlUpdates.push(
        `UPDATE public.jogos SET ` +
        `time_casa = '${teamCasa.replace(/'/g, "''")}', ` +
        `time_fora = '${teamFora.replace(/'/g, "''")}', ` +
        `data = '${sqlDate}', ` +
        `hora = '${sqlTime}', ` +
        `gols_casa_real = ${valGolsCasa}, ` +
        `gols_fora_real = ${valGolsFora}, ` +
        `vencedor_penaltis = ${valVencPenaltis}, ` +
        `fase = 'Mata-Mata' ` +
        `WHERE id = ${id};`
      );
    });

    // Salvar as alterações em src/seed.json
    fs.writeFileSync(seedPath, JSON.stringify(seedGames, null, 2), 'utf8');
    console.log("Arquivo src/seed.json atualizado com sucesso!");

    // Incrementar a versão do seed no db.js para forçar recarga no localStorage do cliente
    const dbPath = path.join(__dirname, 'src/services/db.js');
    let dbContent = fs.readFileSync(dbPath, 'utf8');
    
    // Procura por const SEED_VERSION = 'xxxx';
    const seedVersionMatch = dbContent.match(/const SEED_VERSION = '(\d+)';/);
    if (seedVersionMatch) {
      const oldVersion = seedVersionMatch[1];
      const newVersion = String(parseInt(oldVersion, 10) + 1);
      dbContent = dbContent.replace(
        `const SEED_VERSION = '${oldVersion}';`,
        `const SEED_VERSION = '${newVersion}';`
      );
      fs.writeFileSync(dbPath, dbContent, 'utf8');
      console.log(`Versão do seed em db.js incrementada de ${oldVersion} para ${newVersion}!`);
    }

    // Salvar o script SQL gerado
    const sqlPath = path.join(__dirname, 'update_mata_mata_oficial.sql');
    fs.writeFileSync(sqlPath, sqlUpdates.join('\n'), 'utf8');
    console.log("Script SQL gerado com sucesso em update_mata_mata_oficial.sql!");

    console.log("\n--- CONFRONTOS DO MATA-MATA ATUALIZADOS ---");
    seedGames.filter(j => j.id >= 73).forEach(j => {
      const placar = j.gols_casa_real !== null ? `(${j.gols_casa_real} x ${j.gols_fora_real}${j.vencedor_penaltis ? ' pen:' + j.vencedor_penaltis : ''})` : 'x';
      console.log(`Jogo ${j.id} (${j.grupo}): ${j.time_casa} ${placar} ${j.time_fora} - ${j.data} às ${j.hora} (Fuso BR)`);
    });

  } catch (err) {
    console.error("Erro ao atualizar o mata-mata:", err);
  }
}

updateKnockout();
