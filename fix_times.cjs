const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const envText = fs.readFileSync('.env', 'utf8');
let supabaseUrl = '';
let supabaseKey = '';

envText.split('\n').forEach(line => {
  if (line.startsWith('VITE_SUPABASE_URL=')) supabaseUrl = line.split('=')[1].trim();
  if (line.startsWith('SUPABASE_SERVICE_ROLE_KEY=')) supabaseKey = line.split('=')[1].trim();
});

// Fallback to anon key if service role is not in .env locally
if (!supabaseKey) {
  envText.split('\n').forEach(line => {
    if (line.startsWith('VITE_SUPABASE_ANON_KEY=')) supabaseKey = line.split('=')[1].trim();
  });
}

const supabase = createClient(supabaseUrl, supabaseKey);

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

async function fixTimes() {
  console.log('Buscando dados oficiais da API do worldcup.json...');
  const res = await fetch('https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json');
  const data = await res.json();

  console.log('Buscando jogos no Supabase...');
  const { data: dbGames, error } = await supabase.from('jogos').select('*');
  if (error) {
    console.error('Erro ao ler DB:', error);
    return;
  }

  let updatedCount = 0;

  for (const match of data.matches) {
    // Exemplo: "time": "12:00 UTC-7"
    if (!match.time) continue;
    
    // Parse the time string
    const timeParts = match.time.split(' ');
    if (timeParts.length < 2) continue;

    const baseTime = timeParts[0]; // "12:00"
    const offsetStr = timeParts[1].replace('UTC', ''); // "-7" or "-4" or "-6"
    
    if (!offsetStr) continue;
    
    const [hoursStr, minutesStr] = baseTime.split(':');
    let hours = parseInt(hoursStr);
    const offset = parseInt(offsetStr); // e.g. -7
    
    // Convert to UTC-3 (Brazil)
    // base UTC = hours - offset
    // brazil UTC-3 = base UTC + (-3)
    // which means: brazilHours = hours - offset - 3
    
    let brazilHours = hours - offset - 3;
    
    if (brazilHours < 0) brazilHours += 24;
    if (brazilHours >= 24) brazilHours -= 24;
    
    const correctHora = `${brazilHours.toString().padStart(2, '0')}:${minutesStr}:00`;

    const homeTranslated = nameTranslation[match.team1] || match.team1;
    const awayTranslated = nameTranslation[match.team2] || match.team2;

    const dbMatch = dbGames.find(j => 
      (j.time_casa.toLowerCase() === homeTranslated.toLowerCase() && 
       j.time_fora.toLowerCase() === awayTranslated.toLowerCase())
    );

    if (dbMatch) {
      if (dbMatch.hora !== correctHora) {
        console.log(`Corrigindo ${dbMatch.time_casa} x ${dbMatch.time_fora}: de ${dbMatch.hora} para ${correctHora}`);
        await supabase.from('jogos').update({ hora: correctHora }).eq('id', dbMatch.id);
        updatedCount++;
      }
    }
  }

  console.log(`Finalizado! ${updatedCount} jogos foram corrigidos.`);
}

fixTimes();
