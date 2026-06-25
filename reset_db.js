import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Load Supabase URL and Key from .env
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase URL or Key in .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log("Apagando palpites...");
  const { error: err1 } = await supabase.from('palpites').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  if (err1) console.error("Error deleting palpites:", err1);

  console.log("Apagando jogos...");
  const { error: err2 } = await supabase.from('jogos').delete().neq('id', -1);
  if (err2) console.error("Error deleting jogos:", err2);

  console.log("Inserindo 104 jogos...");
  const seedFile = fs.readFileSync('src/seed.json', 'utf8');
  const seedGames = JSON.parse(seedFile);

  const jogosParaInserir = seedGames.map(j => {
      // Converte DD/MM/YYYY para YYYY-MM-DD
      const partes = j.data.split('/');
      const dataSQL = partes.length === 3 ? `${partes[2]}-${partes[1]}-${partes[0]}` : j.data;
      return {
        id: j.id,
        data: dataSQL,
        hora: j.hora.length === 5 ? `${j.hora}:00` : j.hora,
        time_casa: j.time_casa,
        time_fora: j.time_fora,
        gols_casa_real: j.gols_casa_real,
        gols_fora_real: j.gols_fora_real,
        grupo: j.grupo
      };
  });

  const { error: err3 } = await supabase.from('jogos').insert(jogosParaInserir);
  if (err3) {
      console.error("Error inserting jogos:", err3);
  } else {
      console.log("Jogos inseridos com sucesso!");
  }
}

run();
