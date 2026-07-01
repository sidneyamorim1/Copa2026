import React, { useState, useEffect, useRef } from 'react';
import { dbService } from './services/db';
import { isSupabaseConfigured, configSupabaseLocal, authService, getSupabaseClient } from './supabaseClient';
import LoginScreen from './components/LoginScreen';
import logo from './assets/logo.jpg';
import { resolverNomeParticipante, isNomeParticipanteValido } from './utils/nomeUtils';

// Função para calcular pontos de um palpite
export function calcularPontos(palpiteCasa, palpiteFora, jogo) {
  const realCasa = jogo.gols_casa_real;
  const realFora = jogo.gols_fora_real;

  if (realCasa === null || realFora === null) return 0;
  if (palpiteCasa === null || palpiteFora === null) return 0;
  
  // Conversão segura para inteiros para evitar erros entre "2" (texto) e 2 (número)
  const pc = parseInt(palpiteCasa, 10);
  const pf = parseInt(palpiteFora, 10);
  const rc = parseInt(realCasa, 10);
  const rf = parseInt(realFora, 10);
  
  // 1. Placar Exato: +5 pontos
  if (pc === rc && pf === rf) {
    return 5;
  }
  
  // 2. Placar Invertido Exato: -3 pontos (ex: real 2x0, palpite 0x2)
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

// Função para formatar a data/hora de envio de forma compacta (ex: 29/06 09:25)
export function formatarDataEnvio(dateStr) {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    const dia = String(d.getDate()).padStart(2, '0');
    const mes = String(d.getMonth() + 1).padStart(2, '0');
    const horas = String(d.getHours()).padStart(2, '0');
    const minutos = String(d.getMinutes()).padStart(2, '0');
    return `${dia}/${mes} ${horas}:${minutos}`;
  } catch (e) {
    return '-';
  }
}

// Retorna a data de hoje no formato DD/MM/YYYY
function obterDataHoje() {
  const hoje = new Date();
  const dia = String(hoje.getDate()).padStart(2, '0');
  const mes = String(hoje.getMonth() + 1).padStart(2, '0');
  const ano = hoje.getFullYear();
  return `${dia}/${mes}/${ano}`;
}

// Converte DD/MM/YYYY para um Date comparável
function parseDateBR(dataStr) {
  const [dia, mes, ano] = dataStr.split('/').map(Number);
  return new Date(ano, mes - 1, dia);
}

// Componente leve para animação de confetes em CSS/React
const Confetes = () => {
  const pieces = Array.from({ length: 80 });
  return (
    <div className="confetti-container">
      {pieces.map((_, idx) => {
        const left = Math.random() * 100; // %
        const delay = Math.random() * 5; // s
        const duration = Math.random() * 3 + 2.5; // s
        const color = ['#ffd700', '#ff8c00', '#00e5ff', '#ff007f', '#39ff14', '#ffffff'][Math.floor(Math.random() * 6)];
        const width = Math.random() * 6 + 6; // px
        const height = Math.random() * 10 + 12; // px
        return (
          <div 
            key={idx}
            className="confetti-piece"
            style={{
              left: `${left}%`,
              animationDelay: `${delay}s`,
              animationDuration: `${duration}s`,
              backgroundColor: color,
              width: `${width}px`,
              height: `${height}px`
            }}
          />
        );
      })}
    </div>
  );
};

const PONTOS_BASE_OITAVAS = {
  'Aline': 175,
  'Matheus': 144,
  'Sidney': 140,
  'Daniel': 142,
  'Eduardo': 141,
  'Silvio': 111
};

function App() {
  // Dados do banco
  const [jogos, setJogos] = useState([]);
  const [palpites, setPalpites] = useState([]);
  const [perfis, setPerfis] = useState([]);
  
  // Auth
  const [usuario, setUsuario] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [authChecked, setAuthChecked] = useState(!isSupabaseConfigured()); // se não tem supabase, já está "checado"

  // Estados da UI
  const [loading, setLoading] = useState(true);
  const [dataSelecionada, setDataSelecionada] = useState('');
  const [idxNaData, setIdxNaData] = useState(0); // Index global do jogo ativado (0 a N-1)
  
  // Calendário visual
  const hoje = new Date();
  const [calMes, setCalMes] = useState(hoje.getMonth()); // 0-11
  const [calAno, setCalAno] = useState(hoje.getFullYear());
  
  // Comemoração final da copa
  const [forcarComemora, setForcarComemora] = useState(false);
  const [modalComemoraFechado, setModalComemoraFechado] = useState(false);
  const [audioMutado, setAudioMutado] = useState(false);
  const audioRef = useRef(null);
  
  // Formulário de palpites
  const [nomeJogador, setNomeJogador] = useState(localStorage.getItem('bolao_nome_jogador') || '');
  const [palpiteCasa, setPalpiteCasa] = useState('');
  const [palpiteFora, setPalpiteFora] = useState('');
  
  // Formulário de administração de resultados oficiais
  const [jogoSelecionadoAdmin, setJogoSelecionadoAdmin] = useState('');
  const [adminGolsCasa, setAdminGolsCasa] = useState('');
  const [adminGolsFora, setAdminGolsFora] = useState('');
  const [adminVencedorPenaltis, setAdminVencedorPenaltis] = useState('');

  // Visualização de palpites de outros integrantes (Admin)
  const [jogoSelecionadoPalpitesAdmin, setJogoSelecionadoPalpitesAdmin] = useState('');
  const [participanteSelecionadoPalpitesAdmin, setParticipanteSelecionadoPalpitesAdmin] = useState('');
  const [tabPalpitesAdmin, setTabPalpitesAdmin] = useState('jogo'); // 'jogo' ou 'participante'
  const [rankingFase, setRankingFase] = useState('oitavas'); // 'oitavas' ou 'geral'
  
  // Modal de configurações do Supabase
  const [modalConfigAberto, setModalConfigAberto] = useState(false);
  const [inputUrl, setInputUrl] = useState(localStorage.getItem('bolao_supabase_url') || '');
  const [inputKey, setInputKey] = useState(localStorage.getItem('bolao_supabase_anon_key') || '');
  
  // Carrega jogos e palpites iniciais
  const carregarDados = async () => {
    setLoading(true);
    try {
      const dataJogos = await dbService.obterJogos();
      const dataPalpites = await dbService.obterPalpites();
      setJogos(dataJogos);
      setPalpites(dataPalpites);
      
      // Carregar perfis (com pontos_bonus)
      let dataPerfis = [];
      if (isSupabaseConfigured()) {
        const supabase = getSupabaseClient();
        const { data: dbPerfis } = await supabase
          .from('perfis')
          .select('id, nome, email, is_admin, pontos_bonus')
          .order('nome', { ascending: true });
        dataPerfis = dbPerfis || [];
      } else {
        const localPerfis = localStorage.getItem('bolao_perfis_local');
        if (localPerfis) {
          dataPerfis = JSON.parse(localPerfis);
        } else {
          dataPerfis = [
            { id: '1', nome: 'Aline', pontos_bonus: 0 },
            { id: '2', nome: 'Sidney', pontos_bonus: 0, is_admin: true },
            { id: '3', nome: 'Eduardo', pontos_bonus: 0 },
            { id: '4', nome: 'Silvio', pontos_bonus: 0 },
            { id: '5', nome: 'Matheus', pontos_bonus: 0 },
            { id: '6', nome: 'Daniel', pontos_bonus: 0 }
          ];
          localStorage.setItem('bolao_perfis_local', JSON.stringify(dataPerfis));
        }
      }
      setPerfis(dataPerfis);
      
      const dataJogosOitavas = dataJogos.filter(j => j.id >= 80);
      if (dataJogosOitavas.length > 0) {
        const hoje = obterDataHoje();
        
        // 1. Tenta achar jogo de HOJE
        let dataHoje = dataJogosOitavas.find(j => j.data === hoje)?.data;
        
        if (dataHoje) {
          setDataSelecionada(dataHoje);
          setIdxNaData(0);
        } else {
          // 2. Não tem jogo hoje — busca a data futura mais próxima
          const hojeDate = parseDateBR(hoje);
          const datasUnicas = Array.from(new Set(dataJogosOitavas.map(j => j.data)));
          
          let diaMaisProximo = null;
          let menorDiff = Infinity;
          
          for (const d of datasUnicas) {
            const diff = parseDateBR(d) - hojeDate;
            if (diff >= 0 && diff < menorDiff) {
              menorDiff = diff;
              diaMaisProximo = d;
            }
          }
          
          if (!diaMaisProximo) {
            datasUnicas.sort((a, b) => parseDateBR(b) - parseDateBR(a));
            diaMaisProximo = datasUnicas[0];
          }
          
          // Encontra um dia válido se possível
          const melhorData = dataHoje || diaMaisProximo || (dataJogosOitavas.length > 0 ? dataJogosOitavas[0].data : '');
          setDataSelecionada(melhorData);
          setIdxNaData(0);
        }
        
        // Inicializa o jogo do admin e de palpites
        setJogoSelecionadoAdmin(dataJogosOitavas[0].id.toString());
        setJogoSelecionadoPalpitesAdmin(dataJogosOitavas[0].id.toString());
      }
    } catch (e) {
      console.error("Erro ao carregar os dados:", e);
    } finally {
      setLoading(false);
    }
  };

  // Inicializa o participante selecionado quando a lista de perfis carregar
  useEffect(() => {
    if (perfis.length > 0 && !participanteSelecionadoPalpitesAdmin) {
      setParticipanteSelecionadoPalpitesAdmin(perfis[0].nome);
    }
  }, [perfis, participanteSelecionadoPalpitesAdmin]);

  // Busca o nome do jogador da tabela perfis (fonte de verdade para bater com os palpites)
  const buscarNomeDoPerfil = async (user) => {
    try {
      const supabase = getSupabaseClient();
      const { data: perfil } = await supabase
        .from('perfis')
        .select('nome')
        .eq('id', user.id)
        .maybeSingle();
      if (perfil?.nome) return perfil.nome;
    } catch (_) {}
    // Fallback: user_metadata ou email
    return user.user_metadata?.nome_display || user.email;
  };

  // Escuta mudanças de autenticação
  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setAuthChecked(true);
      carregarDados();
      return;
    }

    // Verifica sessão inicial — libera o app IMEDIATAMENTE ao confirmar o usuário
    authService.getUser().then((user) => {
      if (user) setUsuario(user);
      // Marca authChecked já: não espera isAdmin nem nome do perfil para carregar o app
      setAuthChecked(true);

      // Busca isAdmin e nome em paralelo, sem bloquear o carregamento principal
      if (user) {
        Promise.all([
          authService.isAdmin(user.id),
          buscarNomeDoPerfil(user)
        ]).then(([admin, nome]) => {
          setIsAdmin(admin);
          setNomeJogador(nome);
        });
      }
    });

    // Escuta login/logout
    const { data: { subscription } } = authService.onAuthStateChange((event, session) => {
      const user = session?.user || null;
      setUsuario(user);
      if (user) {
        Promise.all([
          authService.isAdmin(user.id),
          buscarNomeDoPerfil(user)
        ]).then(([admin, nome]) => {
          setIsAdmin(admin);
          setNomeJogador(nome);
        });
      } else {
        setIsAdmin(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (authChecked && (!isSupabaseConfigured() || usuario)) {
      carregarDados();
    }
  }, [authChecked, usuario]);

  // Sincroniza o mês e ano do calendário com a data selecionada para evitar dessincronização visual
  useEffect(() => {
    if (dataSelecionada) {
      const [dia, mes, ano] = dataSelecionada.split('/').map(Number);
      if (mes && ano) {
        setCalMes(mes - 1);
        setCalAno(ano);
      }
    }
  }, [dataSelecionada]);

  // Realtime + polling: mantém todos os usuários sincronizados automaticamente
  useEffect(() => {
    if (!authChecked) return;
    if (isSupabaseConfigured() && !usuario) return;

    let realtimeChannel = null;
    let pollingInterval = null;

    const recarregarSilencioso = async () => {
      try {
        const [dataJogos, dataPalpites] = await Promise.all([
          dbService.obterJogos(),
          dbService.obterPalpites()
        ]);
        setJogos(dataJogos);
        setPalpites(dataPalpites);
      } catch (err) {
        console.warn('Erro na atualização silenciosa:', err);
      }
    };

    if (isSupabaseConfigured()) {
      const supabase = getSupabaseClient();
      if (supabase) {
        realtimeChannel = supabase
          .channel('bolao-mudancas-globais')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'jogos' }, () => {
            recarregarSilencioso();
          })
          .on('postgres_changes', { event: '*', schema: 'public', table: 'palpites' }, () => {
            recarregarSilencioso();
          })
          .subscribe();
      }
    }

    // Polling a cada 60 segundos como fallback (funciona em modo local e no Supabase)
    pollingInterval = setInterval(recarregarSilencioso, 60000);

    return () => {
      if (realtimeChannel) {
        const supabase = getSupabaseClient();
        if (supabase) supabase.removeChannel(realtimeChannel);
      }
      if (pollingInterval) clearInterval(pollingInterval);
    };
  }, [authChecked, usuario]);

  const dataSelecionadaStr = dataSelecionada || '';
  const jogosDaData = jogos.filter(j => j.id >= 80 && j.data === dataSelecionadaStr);
  const jogoAtivo = jogosDaData[idxNaData] || null;

  // Atualiza os palpites exibidos nos inputs quando o jogo ativo ou o nome do jogador mudar
  useEffect(() => {
    if (jogoAtivo && nomeJogador.trim()) {
      const palpiteExistente = palpites.find(
        p => p.jogo_id === jogoAtivo.id && p.jogador_nome.toLowerCase() === nomeJogador.trim().toLowerCase()
      );
      if (palpiteExistente) {
        setPalpiteCasa(palpiteExistente.palpite_casa.toString());
        setPalpiteFora(palpiteExistente.palpite_fora.toString());
      } else {
        setPalpiteCasa('');
        setPalpiteFora('');
      }
    } else {
      setPalpiteCasa('');
      setPalpiteFora('');
    }
  }, [idxNaData, dataSelecionada, nomeJogador, palpites]);

  // Atualiza o formulário de administração quando o jogo do admin mudar
  useEffect(() => {
    if (jogoSelecionadoAdmin) {
      const jogo = jogos.find(j => j.id.toString() === jogoSelecionadoAdmin);
      if (jogo) {
        setAdminGolsCasa(jogo.gols_casa_real !== null ? jogo.gols_casa_real.toString() : '');
        setAdminGolsFora(jogo.gols_fora_real !== null ? jogo.gols_fora_real.toString() : '');
      }
    }
  }, [jogoSelecionadoAdmin, jogos]);

  // Salvar palpite do usuário
  const handleEnviarPalpite = async (e) => {
    e.preventDefault();
    if (!nomeJogador.trim()) {
      alert("Por favor, preencha o seu nome.");
      return;
    }
    if (palpiteCasa === '' || palpiteFora === '') {
      alert("Por favor, preencha o placar do seu palpite.");
      return;
    }
    if (!jogoAtivo) return;
    
    if (jogoAtivo.fase === 'Mata-Mata' && parseInt(palpiteCasa) === parseInt(palpiteFora)) {
      alert("Nas fases de mata-mata, não é permitido apostar em empate!");
      return;
    }
    
    // Persiste o nome do jogador localmente
    localStorage.setItem('bolao_nome_jogador', nomeJogador.trim());
    
    try {
      setLoading(true);
      const novoPalpite = await dbService.salvarPalpite(
        jogoAtivo.id,
        nomeJogador.trim(),
        parseInt(palpiteCasa),
        parseInt(palpiteFora)
      );
      
      // Atualiza palpites em memória
      const novosPalpites = [...palpites];
      const idx = novosPalpites.findIndex(p => p.jogo_id === jogoAtivo.id && p.jogador_nome.toLowerCase() === nomeJogador.trim().toLowerCase());
      if (idx >= 0) {
        novosPalpites[idx] = novoPalpite;
      } else {
        novosPalpites.push(novoPalpite);
      }
      setPalpites(novosPalpites);
      alert("Palpite salvo com sucesso!");
    } catch (err) {
      console.error(err);
      alert("Erro ao salvar palpite.");
    } finally {
      setLoading(false);
    }
  };

  // Atualizar resultado oficial (Admin)
  const handleAtualizarResultado = async (e) => {
    e.preventDefault();
    if (!jogoSelecionadoAdmin) return;
    if (adminGolsCasa === '' || adminGolsFora === '') {
      alert("Por favor, digite o placar oficial.");
      return;
    }
    
    const jogoId = parseInt(jogoSelecionadoAdmin);
    const jogoSelecionado = jogos.find(j => j.id === jogoId);
    
    if (jogoSelecionado && jogoSelecionado.fase === 'Mata-Mata' && parseInt(adminGolsCasa) === parseInt(adminGolsFora) && !adminVencedorPenaltis) {
      alert("Para jogos do mata-mata empatados, é obrigatório informar quem venceu nos pênaltis!");
      return;
    }
    
    try {
      setLoading(true);
      const jogoAtualizado = await dbService.atualizarResultadoJogo(
        jogoId,
        parseInt(adminGolsCasa),
        parseInt(adminGolsFora),
        adminVencedorPenaltis || null
      );
      
      // Atualiza jogos em memória
      setJogos(jogos.map(j => j.id === jogoId ? {
        ...j,
        gols_casa_real: jogoAtualizado.gols_casa_real,
        gols_fora_real: jogoAtualizado.gols_fora_real,
        vencedor_penaltis: jogoAtualizado.vencedor_penaltis
      } : j));
      
      alert("Resultado oficial atualizado!");
      setAdminVencedorPenaltis('');
    } catch (err) {
      console.error(err);
      alert("Erro ao atualizar o resultado.");
    } finally {
      setLoading(false);
    }
  };

  const handleRemoverResultado = async (jogoId) => {
    if (!confirm("Remover este resultado oficial? A classificação será recalculada.")) return;
    try {
      setLoading(true);
      await dbService.atualizarResultadoJogo(jogoId, null, null);
      
      setJogos(jogos.map(j => j.id === jogoId ? {
        ...j,
        gols_casa_real: null,
        gols_fora_real: null
      } : j));
    } catch (err) {
      console.error(err);
      alert("Erro ao remover o resultado.");
    } finally {
      setLoading(false);
    }
  };

  const handleSalvarBonus = async (perfilId, nomeJogador, novoBonus) => {
    try {
      setLoading(true);
      const bonusInt = parseInt(novoBonus, 10) || 0;
      
      if (isSupabaseConfigured()) {
        const supabase = getSupabaseClient();
        const { error } = await supabase
          .from('perfis')
          .update({ pontos_bonus: bonusInt })
          .eq('id', perfilId);
          
        if (error) throw error;
      } else {
        // Fallback local
        const localPerfis = JSON.parse(localStorage.getItem('bolao_perfis_local') || '[]');
        const updatedPerfis = localPerfis.map(p => 
          p.id === perfilId ? { ...p, pontos_bonus: bonusInt } : p
        );
        localStorage.setItem('bolao_perfis_local', JSON.stringify(updatedPerfis));
      }
      
      // Atualiza o estado na memória
      setPerfis(prev => prev.map(p => 
        p.id === perfilId ? { ...p, pontos_bonus: bonusInt } : p
      ));
      
      alert(`Bônus de ${nomeJogador} atualizado para +${bonusInt} pontos!`);
    } catch (err) {
      console.error(err);
      alert("Erro ao salvar bônus: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUploadCSV = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        setLoading(true);
        const text = event.target.result;
        const linhas = text.split(/\r?\n|\r/);
        
        let atualizacoes = [];
        let novosPalpites = [];

        const removeAccents = (str) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

        const encontrarNomeParticipante = (partes) => {
          for (const parte of partes) {
            const nomeResolvido = resolverNomeParticipante(parte);
            if (isNomeParticipanteValido(nomeResolvido)) {
              return nomeResolvido;
            }
          }
          return null;
        };

        const encontrarJogo = (partes) => {
          for (const jogo of jogos) {
            const casa = removeAccents(jogo.time_casa);
            const fora = removeAccents(jogo.time_fora);
            const casaPresente = partes.some(p => removeAccents(p) === casa);
            const foraPresente = partes.some(p => removeAccents(p) === fora);
            if (casaPresente && foraPresente) return jogo;
          }
          return null;
        };

        const encontrarPlacares = (partes) => {
          const candidatos = partes
            .map(p => p.trim())
            .filter(p => /^\d{1,2}$/.test(p))
            .map(p => parseInt(p, 10));

          if (candidatos.length >= 2) {
            return [candidatos[0], candidatos[1]];
          }
          return null;
        };

        for (let i = 0; i < linhas.length; i++) {
          const linha = linhas[i];
          if (!linha || !linha.trim()) continue;
          
          const partes = linha.split(/[,;]/).map(p => p.trim().replace(/^"|"$/g, ''));
          if (partes.length < 3) continue;

          const nome = encontrarNomeParticipante(partes);
          const jogo = encontrarJogo(partes);
          const placares = encontrarPlacares(partes);

          if (!nome || !jogo || !placares) continue;

          const [golsCasa, golsFora] = placares;
          const nomeNormalizado = resolverNomeParticipante(nome);

          if (nomeNormalizado.toLowerCase() === 'oficial') {
            atualizacoes.push({
              jogoId: jogo.id,
              golsCasa,
              golsFora
            });
          } else if (isNomeParticipanteValido(nomeNormalizado)) {
            novosPalpites.push({
              jogo_id: jogo.id,
              jogador_nome: nomeNormalizado,
              palpite_casa: golsCasa,
              palpite_fora: golsFora
            });
          }
        }
        
        if (novosPalpites.length > 0) {
          const palpitesAtualizados = await dbService.atualizarPalpitesEmLote(novosPalpites);
          setPalpites(palpitesAtualizados);
        }

        if (atualizacoes.length > 0) {
          await dbService.atualizarResultadosEmLote(atualizacoes);
          
          const jogosAtualizadosMap = {};
          atualizacoes.forEach(a => {
            jogosAtualizadosMap[a.jogoId] = a;
          });
          
          setJogos(jogos.map(j => {
            if (jogosAtualizadosMap[j.id]) {
              return {
                ...j,
                gols_casa_real: jogosAtualizadosMap[j.id].golsCasa,
                gols_fora_real: jogosAtualizadosMap[j.id].golsFora
              };
            }
            return j;
          }));
        }

        if (novosPalpites.length > 0 || atualizacoes.length > 0) {
          alert(`Importação concluída! ${atualizacoes.length} placares oficiais e ${novosPalpites.length} palpites atualizados do CSV.`);
        } else {
          alert('Nenhum dado importado. O arquivo pode não ser um CSV válido, estar sem placares/apostas numéricas, ou os nomes dos times contêm caracteres estranhos (Lembre-se de salvar como CSV UTF-8).');
        }
      } catch (err) {
        console.error(err);
        alert('Erro ao importar o CSV.');
      } finally {
        setLoading(false);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleDownloadTemplate = () => {
    let csvContent = "Nome;Time Casa;Gols Casa;Time Fora;Gols Fora\n";
    
    // Para cada jogo das oitavas em diante, vamos gerar uma linha de 'Oficial' em branco
    jogos.filter(j => j.id >= 80).forEach(jogo => {
      csvContent += `Oficial;${jogo.time_casa};;${jogo.time_fora};\n`;
    });
    
    // Adicionar um bloco extra em branco no final de exemplo para palpites
    csvContent += `\n`;
    csvContent += `Sidney;Brasil;3;Marrocos;0\n`;
    csvContent += `Eduardo;Brasil;2;Marrocos;1\n`;

    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "Template_Bolao_Resultados.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Trata a seleção de uma data (via calendário)
  const selecionarData = (data) => {
    setDataSelecionada(data);
    setIdxNaData(0);
  };

  // Navegar mês do calendário
  const navegarCalendario = (direcao) => {
    let novoMes = calMes + direcao;
    let novoAno = calAno;
    if (novoMes < 0) { novoMes = 11; novoAno--; }
    if (novoMes > 11) { novoMes = 0; novoAno++; }
    
    // Bloqueia navegação para Junho de 2026 ou anterior (mês 5 ou menor no ano 2026)
    if (novoAno < 2026 || (novoAno === 2026 && novoMes < 6)) {
      return;
    }
    // Também bloqueia ir além de Julho de 2026 para manter a experiência focada nos jogos finais
    if (novoAno > 2026 || (novoAno === 2026 && novoMes > 6)) {
      return;
    }
    
    setCalMes(novoMes);
    setCalAno(novoAno);
  };

  // Gera grid do calendário para o mês/ano atual
  const gerarGridCalendario = () => {
    const primeiroDia = new Date(calAno, calMes, 1);
    const ultimoDia = new Date(calAno, calMes + 1, 0);
    const diasNoMes = ultimoDia.getDate();
    const diaSemanaInicio = primeiroDia.getDay(); // 0=Dom, 1=Seg...

    const cells = [];
    // Células vazias antes do 1º dia
    for (let i = 0; i < diaSemanaInicio; i++) {
      cells.push({ dia: null });
    }
    // Dias do mês
    for (let d = 1; d <= diasNoMes; d++) {
      const dataStr = `${String(d).padStart(2, '0')}/${String(calMes + 1).padStart(2, '0')}/${calAno}`;
      const temJogo = jogos.some(j => j.id >= 80 && j.data === dataStr);
      const qtdJogos = jogos.filter(j => j.id >= 80 && j.data === dataStr).length;
      const ehHoje = d === hoje.getDate() && calMes === hoje.getMonth() && calAno === hoje.getFullYear();
      const ehSelecionado = dataStr === dataSelecionada;
      cells.push({ dia: d, dataStr, temJogo, qtdJogos, ehHoje, ehSelecionado });
    }
    return cells;
  };

  const nomeMeses = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  const diasSemana = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const gridCalendario = gerarGridCalendario();

  // Navegar entre jogos apenas do dia selecionado
  const navegarJogo = (direcao) => {
    let novoIdxNaData = idxNaData + direcao;
    if (novoIdxNaData >= 0 && novoIdxNaData < jogosDaData.length) {
      setIdxNaData(novoIdxNaData);
    }
  };

  // Salvar conexões do Supabase
  const handleSalvarSupabase = (e) => {
    e.preventDefault();
    configSupabaseLocal(inputUrl.trim(), inputKey.trim());
  };

  // Limpar chaves locais do Supabase
  const handleLimparSupabase = () => {
    if (confirm("Deseja realmente limpar as credenciais e reiniciar os dados locais?")) {
      dbService.limparConfiguracoesLocais();
    }
  };

  // Cálculos de Estatísticas e Classificação
  
  // 1. Participantes únicos
  const participantesUnicos = Array.from(new Set(palpites.map(p => p.jogador_nome.toLowerCase())))
    .map(nomeLower => {
      // Retorna o nome original com a grafia correta (primeira ocorrência)
      return palpites.find(p => p.jogador_nome.toLowerCase() === nomeLower).jogador_nome;
    });

  // Lista filtrada de participantes para o ranking baseado na fase selecionada
  const participantesUnicosRanking = rankingFase === 'oitavas'
    ? Object.keys(PONTOS_BASE_OITAVAS)
    : participantesUnicos;
    
  // 2. Jogos avaliados (que possuem resultado real preenchido)
  const jogosAvaliadosCount = rankingFase === 'oitavas'
    ? jogos.filter(j => j.id >= 80 && j.gols_casa_real !== null && j.gols_fora_real !== null).length
    : jogos.filter(j => j.gols_casa_real !== null && j.gols_fora_real !== null).length;
  
  const ranking = participantesUnicosRanking.map(nome => {
    let pontos = 0;
    let acertos = 0; // +5 ou +3
    let erros = 0; // 0 ou -3
    
    if (rankingFase === 'oitavas') {
      pontos = PONTOS_BASE_OITAVAS[nome] || 0;
    }
    
    const palpitesDoJogador = palpites.filter(p => p.jogador_nome.toLowerCase() === nome.toLowerCase());
    
    palpitesDoJogador.forEach(p => {
      const jogo = jogos.find(j => j.id === p.jogo_id);
      if (jogo && jogo.gols_casa_real !== null && jogo.gols_fora_real !== null) {
        if (rankingFase === 'oitavas' && jogo.id < 80) {
          return;
        }
        
        const pts = calcularPontos(p.palpite_casa, p.palpite_fora, jogo);
        pontos += pts;
        if (pts > 0) {
          acertos += 1;
        } else {
          erros += 1;
        }
      }
    });

    // Busca pontos de bônus do perfil do participante (apenas para ranking geral, para evitar duplicidade de bônus antigos)
    const perfilUser = perfis.find(pf => pf.nome.toLowerCase() === nome.toLowerCase());
    const bonus = (rankingFase === 'geral' && perfilUser) ? (perfilUser.pontos_bonus || 0) : 0;
    pontos += bonus;
    
    return {
      jogador: nome,
      pontos,
      acertos,
      erros,
      bonus
    };
  });
  
  // Ordena ranking: Pontos desc, depois Acertos desc, depois Erros asc, depois Nome asc
  ranking.sort((a, b) => {
    if (b.pontos !== a.pontos) return b.pontos - a.pontos;
    if (b.acertos !== a.acertos) return b.acertos - a.acertos;
    if (a.erros !== b.erros) return a.erros - b.erros;
    return a.jogador.localeCompare(b.jogador);
  });
  
  // 4. Pontos somados de todos
  const pontosSomadosTotal = ranking.reduce((acc, curr) => acc + curr.pontos, 0);

  // Verifica se a copa acabou (se o jogo da final de ID 104 tem placar oficial preenchido)
  const finalJogo = jogos.find(j => j.id === 104);
  const copaFinalizada = !!(finalJogo && finalJogo.gols_casa_real !== null && finalJogo.gols_fora_real !== null);
  const exibirComemora = !!((copaFinalizada || forcarComemora) && !modalComemoraFechado);

  // Controla a música "We Are the Champions" ao abrir/fechar o modal de comemoração
  useEffect(() => {
    if (exibirComemora) {
      if (!audioRef.current) {
        audioRef.current = new Audio('/we-are-the-Champions.mp3');
        audioRef.current.loop = true;
      }
      
      audioRef.current.muted = audioMutado;

      if (!audioMutado) {
        audioRef.current.play().catch(err => {
          console.warn("Autoplay da música de comemoração foi impedido pelo navegador ou arquivo ausente.", err);
        });
      } else {
        audioRef.current.pause();
      }
    } else {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
    }
  }, [exibirComemora, audioMutado]);

  // Palpites enviados pelo jogador ativo HOJE (na data selecionada)
  const palpitesHoje = jogoAtivo ? palpites.filter(p => {
    const jogo = jogos.find(j => j.id === p.jogo_id);
    return jogo && jogo.data === dataSelecionada && p.jogador_nome.toLowerCase() === nomeJogador.trim().toLowerCase();
  }) : [];

  // Obter alertas para palpites pendentes cuja data limite é em menos de 24 horas
  const obterAlertasPalpitesPendentes = () => {
    if (!nomeJogador.trim()) return [];
    
    const agora = new Date();
    const jogosPendentes = [];
    
    jogos.forEach(jogo => {
      // Parse da data/hora do jogo
      const [dia, mes, ano] = jogo.data.split('/');
      const horaStr = jogo.hora || '23:59:59';
      const dataFormatada = `${ano}-${mes}-${dia}T${horaStr.length === 5 ? `${horaStr}:00` : horaStr}`;
      const dataHoraJogo = new Date(dataFormatada);
      const limitePalpite = new Date(dataHoraJogo.getTime() - 3600000); // 1 hora antes
      
      // Se o limite ainda não passou, mas o jogo está próximo (ex: nas próximas 24 horas)
      if (agora < limitePalpite) {
        const diffMs = limitePalpite.getTime() - agora.getTime();
        const diffHoras = diffMs / 3600000;
        
        // Limite de 24 horas para o alerta
        if (diffHoras <= 24) {
          const jaTemPalpite = palpites.some(p => 
            p.jogo_id === jogo.id && 
            p.jogador_nome.toLowerCase() === nomeJogador.trim().toLowerCase()
          );
          
          if (!jaTemPalpite) {
            let tempoRestanteStr = '';
            if (diffHoras < 1) {
              const minutos = Math.round(diffMs / 60000);
              tempoRestanteStr = `${minutos} min`;
            } else {
              const horas = Math.floor(diffHoras);
              const minutos = Math.round((diffHoras - horas) * 60);
              tempoRestanteStr = `${horas}h ${minutos}min`;
            }
            
            jogosPendentes.push({
              jogo,
              tempoRestante: tempoRestanteStr
            });
          }
        }
      }
    });
    
    return jogosPendentes;
  };

  // Obter datas únicas para o seletor de data
  const datasUnicas = Array.from(new Set(jogos.map(j => j.data)));
  
  // Quantidade de jogos na data selecionada
  const jogosNaDataCount = jogos.filter(j => j.id >= 80 && j.data === dataSelecionada).length;

  // Gate de autenticação
  if (isSupabaseConfigured()) {
    if (!authChecked) {
      return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #064e3b, #047857)' }}>
          <div style={{ color: 'white', fontSize: '1.2rem', fontWeight: 600 }}>Carregando...</div>
        </div>
      );
    }
    if (!usuario) {
      return <LoginScreen onLogin={(user) => setUsuario(user)} />;
    }
  }

  return (
    <div>
      <header className="main-header">
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
          <img 
            src={logo} 
            alt="Logo Missão Hexa" 
            style={{ 
              width: '90px', 
              height: '90px', 
              borderRadius: '50%', 
              objectFit: 'cover', 
              border: '3px solid var(--color-accent)', 
              boxShadow: 'var(--shadow-md)',
              transition: 'transform 0.3s ease'
            }} 
            className="header-logo"
            onMouseEnter={(e) => e.target.style.transform = 'scale(1.05)'}
            onMouseLeave={(e) => e.target.style.transform = 'scale(1)'}
          />
          <div style={{ textAlign: 'center' }}>
            <h1 style={{ margin: 0 }}>Bolão Copa 2026</h1>
            <p style={{ margin: '4px auto 0', opacity: 0.9 }}>Competição interna entre amigos, sem pagamentos, prêmios ou monetização</p>
          </div>
        </div>
        
        <div className="header-actions" style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', justifyContent: 'center' }}>
          {(copaFinalizada || forcarComemora) && (
            <button
              onClick={() => setModalComemoraFechado(false)}
              className="config-trigger-btn"
              style={{ background: 'linear-gradient(135deg, #ffd700, #ff8c00)', color: '#000', borderColor: '#ffd700', fontWeight: 'bold' }}
            >
              🏆 Ver Pódio Final
            </button>
          )}
          {(isAdmin || !isSupabaseConfigured()) && (
            <>
              {isSupabaseConfigured() ? (
                <span className="config-badge configured">Supabase Conectado</span>
              ) : (
                <span className="config-badge not-configured">Modo Offline (Local)</span>
              )}
              <button 
                className="config-trigger-btn" 
                style={{ marginLeft: '8px' }} 
                onClick={() => setModalConfigAberto(true)}
              >
                Configurações
              </button>
            </>
          )}
          {isSupabaseConfigured() && usuario && (
            <>
              <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: '0.85rem' }}>
                ⚽ Olá, <strong>{usuario.user_metadata?.nome_display || usuario.email}</strong>
              </span>
              <button
                onClick={() => { authService.signOut(); setUsuario(null); setIsAdmin(false); }}
                className="config-trigger-btn"
                style={{ background: 'rgba(220,38,38,0.2)', borderColor: '#f87171' }}
              >
                Sair
              </button>
            </>
          )}
        </div>
      </header>

      <div className="app-container">
        {/* Alertas */}
        <div className="alerts-container">
          <div className="alert alert-warning">
            Regras: placar exato vale +5; acertar vencedor ou empate vale +3; placar invertido penaliza -3.
          </div>
          <div className="alert alert-info">
            Calendário alinhado com os blocos oficiais da FIFA para a Copa de 2026. Os confrontos deste projeto continuam sendo a base do bolão.
          </div>
          {obterAlertasPalpitesPendentes().map(({ jogo, tempoRestante }) => (
            <div key={`pended-${jogo.id}`} className="alert alert-danger" style={{ backgroundColor: '#fee2e2', border: '1px solid #fecaca', color: '#991b1b', fontWeight: 'bold' }}>
              ⚠️ Atenção, {nomeJogador}! Você ainda não enviou palpite para {jogo.time_casa} x {jogo.time_fora} (resta apenas {tempoRestante} para o limite de envio).
            </div>
          ))}
        </div>

        {loading && (
          <div style={{ textAlign: 'center', padding: '20px', fontWeight: 'bold', color: 'var(--color-primary)' }}>
            Carregando dados...
          </div>
        )}

        {/* Layout de duas colunas */}
        <div className="app-grid">
          {/* LADO ESQUERDO */}
          <div className="left-column">
            {/* Painel Calendário */}
            <div className="panel">
              <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', alignItems: 'center', justifyContent: 'space-between' }}>
                <h2 style={{ margin: 0 }}>Calendário</h2>
              </div>
              
              <div className="calendar-widget">
                {/* Cabeçalho do mês */}
                 <div className="calendar-header">
                  <button 
                    className="cal-nav-btn" 
                    onClick={() => navegarCalendario(-1)} 
                    title="Mês anterior"
                    disabled={calAno === 2026 && calMes <= 6}
                    style={(calAno === 2026 && calMes <= 6) ? { opacity: 0.3, cursor: 'not-allowed' } : {}}
                  >
                    ‹
                  </button>
                  <span className="cal-month-label">{nomeMeses[calMes]} {calAno}</span>
                  <button 
                    className="cal-nav-btn" 
                    onClick={() => navegarCalendario(1)} 
                    title="Próximo mês"
                    disabled={calAno === 2026 && calMes >= 6}
                    style={(calAno === 2026 && calMes >= 6) ? { opacity: 0.3, cursor: 'not-allowed' } : {}}
                  >
                    ›
                  </button>
                </div>
                
                {/* Dias da semana */}
                <div className="calendar-grid">
                  {diasSemana.map(ds => (
                    <div key={ds} className="cal-weekday">{ds}</div>
                  ))}
                  
                  {/* Dias do mês */}
                  {gridCalendario.map((cell, i) => (
                    cell.dia === null ? (
                      <div key={`empty-${i}`} className="cal-day cal-empty"></div>
                    ) : (
                      <button
                        key={cell.dia}
                        className={`cal-day${cell.temJogo ? ' has-game' : ''}${cell.ehHoje ? ' is-today' : ''}${cell.ehSelecionado ? ' is-selected' : ''}`}
                        onClick={() => cell.temJogo && selecionarData(cell.dataStr)}
                        disabled={!cell.temJogo}
                        title={cell.temJogo ? `${cell.qtdJogos} jogo${cell.qtdJogos > 1 ? 's' : ''}` : ''}
                      >
                        <span className="cal-day-num">{cell.dia}</span>
                        {cell.temJogo && <span className="cal-dot-indicator">{cell.qtdJogos}</span>}
                      </button>
                    )
                  ))}
                </div>
                
                <div className="calendar-legend">
                  <span><span className="legend-dot has-game-dot"></span> Dia com jogos</span>
                  <span><span className="legend-dot today-dot"></span> Hoje</span>
                </div>
                
                <div className="game-count-label">
                  {jogosNaDataCount} {jogosNaDataCount === 1 ? 'jogo' : 'jogos'} em {dataSelecionada}
                </div>
              </div>
              
              <hr style={{ border: 'none', borderTop: '1px solid var(--border-color)', margin: '16px 0' }} />

              {/* Card de Navegação e Confronto */}
              {jogoAtivo ? (
                <div>
                  <div className="match-card">
                    <div className="match-meta">
                      {jogoAtivo.grupo} - {jogoAtivo.data} às {jogoAtivo.hora ? jogoAtivo.hora.substring(0,5) : 'A definir'}
                    </div>
                    <div className="match-teams">
                      {jogoAtivo.time_casa} x {jogoAtivo.time_fora}
                    </div>
                    
                    {jogoAtivo.gols_casa_real !== null ? (
                      <div className="match-status-badge" style={{ backgroundColor: '#e2e8f0', color: '#475569' }}>
                        Placar oficial: {jogoAtivo.gols_casa_real} x {jogoAtivo.gols_fora_real}
                      </div>
                    ) : (() => {
                      const [dia, mes, ano] = jogoAtivo.data.split('/');
                      const dataFormatada = `${ano}-${mes}-${dia}T${jogoAtivo.hora || '23:59:59'}`;
                      const dataHoraJogo = new Date(dataFormatada);
                      const limitePalpite = new Date(dataHoraJogo.getTime() - 3600000);
                      return new Date() > limitePalpite;
                    })() ? (
                      <div className="match-status-badge" style={{ backgroundColor: '#fee2e2', color: '#991b1b' }}>
                        Palpites Encerrados
                      </div>
                    ) : (
                      <div className="match-status-badge">
                        Palpites ainda abertos
                      </div>
                    )}
                  </div>

                  {/* Controle de Navegação */}
                  <div className="navigation-controls">
                    <button 
                      className="nav-btn" 
                      onClick={() => navegarJogo(-1)}
                      disabled={idxNaData <= 0}
                      title="Jogo anterior"
                    >
                      &lsaquo;
                    </button>
                    <span className="nav-indicator">
                      {idxNaData + 1} de {jogosDaData.length}
                    </span>
                    <button 
                      className="nav-btn" 
                      onClick={() => navegarJogo(1)}
                      disabled={idxNaData >= jogosDaData.length - 1}
                      title="Próximo jogo"
                    >
                      &rsaquo;
                    </button>
                  </div>

                  {/* Formulário de Palpite */}
                  <form onSubmit={handleEnviarPalpite}>
                    <div className="form-group">
                      <label htmlFor="player-name">Seu nome</label>
                      <input 
                        type="text" 
                        id="player-name"
                        className="input-control"
                        placeholder="Ex: João"
                        value={nomeJogador}
                        onChange={(e) => setNomeJogador(e.target.value)}
                        required
                      />
                    </div>

                    {(() => {
                      const [dia, mes, ano] = jogoAtivo.data.split('/');
                      const dataFormatada = `${ano}-${mes}-${dia}T${jogoAtivo.hora || '23:59:59'}`;
                      const dataHoraJogo = new Date(dataFormatada);
                      const limitePalpite = new Date(dataHoraJogo.getTime() - 3600000); // 1 hora antes
                      const palpitesEncerrados = new Date() > limitePalpite;
                      const jaTemPalpite = jogoAtivo && nomeJogador.trim() && palpites.some(p => p.jogo_id === jogoAtivo.id && p.jogador_nome.toLowerCase() === nomeJogador.trim().toLowerCase());
                      const bloqueado = jaTemPalpite || palpitesEncerrados;
                      
                      return (
                        <>
                          <div className="form-group">
                            <label style={{ marginBottom: '12px' }}>Seu palpite</label>
                            <div className="scores-input-grid">
                              <input 
                                type="number"
                                className="score-input"
                                min="0"
                                max="99"
                                value={palpiteCasa}
                                onChange={(e) => setPalpiteCasa(e.target.value)}
                                disabled={bloqueado}
                                style={bloqueado ? { backgroundColor: 'var(--color-light)', cursor: 'not-allowed', color: 'var(--text-color)' } : {}}
                                required
                              />
                              <span className="score-divider">x</span>
                              <input 
                                type="number"
                                className="score-input"
                                min="0"
                                max="99"
                                value={palpiteFora}
                                onChange={(e) => setPalpiteFora(e.target.value)}
                                disabled={bloqueado}
                                style={bloqueado ? { backgroundColor: 'var(--color-light)', cursor: 'not-allowed', color: 'var(--text-color)' } : {}}
                                required
                              />
                            </div>
                          </div>

                          <button 
                            type="submit" 
                            className="btn-primary" 
                            style={{ width: '100%', marginTop: '12px', ...(bloqueado ? { backgroundColor: '#94a3b8', cursor: 'not-allowed' } : {}) }}
                            disabled={bloqueado}
                          >
                            {palpitesEncerrados ? 'Palpites Encerrados' : jaTemPalpite ? 'Palpite já enviado' : 'Enviar palpite'}
                          </button>
                        </>
                      )
                    })()}
                  </form>
                </div>
              ) : (
                <div className="empty-box-msg">Nenhum jogo cadastrado.</div>
              )}
            </div>

            {/* Painel Meus palpites de hoje */}
            <div className="panel">
              <h2>Meus palpites de hoje</h2>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '12px' }}>
                Palpites do dia selecionado, com o que você já enviou para cada jogo.
              </p>
              
              {!nomeJogador.trim() ? (
                <div className="empty-box-msg">
                  Digite seu nome no formulário para ver seus palpites.
                </div>
              ) : (
                <div className="user-palpites-list">
                  {jogos.filter(j => j.id >= 80 && j.data === dataSelecionada).map(jogo => {
                    const palpite = palpites.find(p => 
                      p.jogo_id === jogo.id && 
                      p.jogador_nome.toLowerCase() === nomeJogador.trim().toLowerCase()
                    );
                    
                    return (
                      <div key={jogo.id} className="user-palpite-item">
                        <span className="match">{jogo.time_casa} x {jogo.time_fora}</span>
                        {palpite ? (
                          <span className="score predicted">{palpite.palpite_casa} x {palpite.palpite_fora}</span>
                        ) : (
                          <span className="score missing">? x ?</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Painel Resultados Oficiais de hoje */}
            <div className="panel" style={{ marginTop: '20px' }}>
              <h2>Resultados Oficiais</h2>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '12px' }}>
                Placares finais dos jogos do dia {dataSelecionada}.
              </p>
              
              <div className="user-palpites-list">
                {jogos.filter(j => j.id >= 80 && j.data === dataSelecionada).map(jogo => {
                  const temResultado = jogo.gols_casa_real !== null && jogo.gols_fora_real !== null;
                  
                  return (
                    <div key={`res-${jogo.id}`} className="user-palpite-item">
                      <span className="match">{jogo.time_casa} x {jogo.time_fora}</span>
                      {temResultado ? (
                        <span className="score predicted" style={{ backgroundColor: 'var(--color-primary)', color: 'white', fontWeight: 'bold', minWidth: '60px', textAlign: 'center' }}>
                          {jogo.gols_casa_real} x {jogo.gols_fora_real}
                        </span>
                      ) : (
                        <span className="score missing" style={{ minWidth: '60px', textAlign: 'center' }}>- x -</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* LADO DIREITO */}
          <div className="right-column">
            {/* Painel Resumo */}
            <div className="panel">
              <h2>Resumo</h2>
              
              <div className="summary-widget-container">
                <div className="summary-widget">
                  <div className="value">{participantesUnicos.length}</div>
                  <div className="label">Participantes</div>
                </div>
                <div className="summary-widget">
                  <div className="value">{jogosAvaliadosCount}</div>
                  <div className="label">Jogos Avaliados</div>
                </div>
                <div className="summary-widget">
                  <div className="value">{pontosSomadosTotal}</div>
                  <div className="label">Pontos Somados</div>
                </div>
              </div>
              
              <div className="info-text-summary">
                A classificação sobe automaticamente quando os resultados oficiais forem registrados.
              </div>
            </div>

            {/* Painel Ranking de Usuários */}
            <div className="panel">
              <div className="ranking-header-container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <h2>Ranking do Bolão</h2>
                <div style={{ display: 'flex', gap: '4px', backgroundColor: 'var(--color-primary-light)', padding: '2px', borderRadius: '6px' }}>
                  <button
                    type="button"
                    style={{
                      padding: '4px 8px',
                      fontSize: '0.75rem',
                      backgroundColor: rankingFase === 'oitavas' ? 'var(--color-primary)' : 'transparent',
                      color: rankingFase === 'oitavas' ? '#fff' : 'var(--color-dark)',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontWeight: '600',
                      transition: 'all 0.2s ease',
                      margin: 0,
                      width: 'auto'
                    }}
                    onClick={() => setRankingFase('oitavas')}
                  >
                    Oitavas+
                  </button>
                  <button
                    type="button"
                    style={{
                      padding: '4px 8px',
                      fontSize: '0.75rem',
                      backgroundColor: rankingFase === 'geral' ? 'var(--color-primary)' : 'transparent',
                      color: rankingFase === 'geral' ? '#fff' : 'var(--color-dark)',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontWeight: '600',
                      transition: 'all 0.2s ease',
                      margin: 0,
                      width: 'auto'
                    }}
                    onClick={() => setRankingFase('geral')}
                  >
                    Geral
                  </button>
                </div>
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '12px' }}>
                {rankingFase === 'oitavas'
                  ? 'Ranking a partir de 01/07 (Oitavas e reta final). Pontos base herdados em 30/06.'
                  : 'Classificação geral considerando todos os jogos da Copa.'}
              </p>

              {ranking.length > 0 ? (
                <div className="table-wrapper">
                  <table className="ranking-table">
                    <thead>
                      <tr>
                        <th style={{ width: '50px' }}>#</th>
                        <th>Jogador</th>
                        <th>Pontos</th>
                        <th>Bônus</th>
                        <th>Acertos</th>
                        <th>Erros</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ranking.map((row, idx) => (
                        <tr 
                          key={row.jogador} 
                          className={nomeJogador.trim().toLowerCase() === row.jogador.toLowerCase() ? 'highlight' : ''}
                        >
                          <td className="pos">{idx + 1}</td>
                          <td className="player-name">{row.jogador}</td>
                          <td className="points">{row.pontos}</td>
                          <td style={{ color: '#d97706', fontWeight: '600' }}>+{row.bonus || 0}</td>
                          <td style={{ color: 'var(--color-primary)', fontWeight: '600' }}>{row.acertos}</td>
                          <td style={{ color: '#ef4444', fontWeight: '600' }}>{row.erros}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="empty-box-msg">
                  Nenhum usuário ranqueado ainda. Quando os resultados oficiais entrarem, a lista aparece aqui.
                </div>
              )}
            </div>

            {/* Painéis de admin - só para admin */}
            {(isAdmin || !isSupabaseConfigured()) && (
              <div style={{display: 'flex', flexDirection: 'column', gap: '16px'}}>

                {/* Painel: Visualizar Palpites dos Integrantes */}
                <div className="panel">
                  <h2>Palpites dos Integrantes</h2>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
                    Veja os palpites enviados pelos outros participantes do bolão. Esta visão é visível apenas para administradores.
                  </p>

                  {/* Abas para alternar a visualização */}
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
                    <button
                      type="button"
                      className="btn-submit"
                      style={{
                        padding: '6px 12px',
                        margin: 0,
                        width: 'auto',
                        fontSize: '0.85rem',
                        backgroundColor: tabPalpitesAdmin === 'jogo' ? 'var(--color-primary)' : 'var(--color-primary-light)',
                        color: tabPalpitesAdmin === 'jogo' ? '#fff' : 'var(--color-dark)',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontWeight: '600'
                      }}
                      onClick={() => setTabPalpitesAdmin('jogo')}
                    >
                      Ver por Jogo
                    </button>
                    <button
                      type="button"
                      className="btn-submit"
                      style={{
                        padding: '6px 12px',
                        margin: 0,
                        width: 'auto',
                        fontSize: '0.85rem',
                        backgroundColor: tabPalpitesAdmin === 'participante' ? 'var(--color-primary)' : 'var(--color-primary-light)',
                        color: tabPalpitesAdmin === 'participante' ? '#fff' : 'var(--color-dark)',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontWeight: '600'
                      }}
                      onClick={() => setTabPalpitesAdmin('participante')}
                    >
                      Ver por Participante
                    </button>
                  </div>

                  {tabPalpitesAdmin === 'jogo' ? (
                    <div>
                      <div className="form-group">
                        <label htmlFor="admin-select-game-palpites">Selecionar Jogo</label>
                        <select
                          id="admin-select-game-palpites"
                          className="input-control"
                          value={jogoSelecionadoPalpitesAdmin}
                          onChange={(e) => setJogoSelecionadoPalpitesAdmin(e.target.value)}
                        >
                          {jogos.filter(j => j.id >= 80).map(j => (
                            <option key={j.id} value={j.id.toString()}>
                              {j.time_casa} x {j.time_fora} - {j.data} às {j.hora ? j.hora.substring(0,5) : 'A definir'}
                            </option>
                          ))}
                        </select>
                      </div>

                      {(() => {
                        const jogoId = parseInt(jogoSelecionadoPalpitesAdmin);
                        const jogo = jogos.find(j => j.id === jogoId);
                        if (!jogo) return <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Nenhum jogo selecionado.</p>;

                        // Lista de todos os participantes únicos
                        const nomesUnicos = Array.from(new Set([
                          ...perfis.map(p => p.nome),
                          ...palpites.map(p => p.jogador_nome)
                        ])).filter(Boolean).sort((a, b) => a.localeCompare(b));

                        const palpitesDoJogo = palpites.filter(p => p.jogo_id === jogoId);

                        return (
                          <div className="table-wrapper">
                            <table className="ranking-table">
                              <thead>
                                <tr>
                                  <th style={{ textAlign: 'left' }}>Participante</th>
                                  <th style={{ textAlign: 'center' }}>Palpite</th>
                                  <th style={{ textAlign: 'center' }}>Pontos</th>
                                  <th style={{ textAlign: 'center' }}>Envio</th>
                                </tr>
                              </thead>
                              <tbody>
                                {nomesUnicos.map(nome => {
                                  const palpite = palpitesDoJogo.find(p => p.jogador_nome.toLowerCase() === nome.toLowerCase());
                                  let pts = '-';
                                  if (palpite && jogo.gols_casa_real !== null && jogo.gols_fora_real !== null) {
                                    pts = calcularPontos(palpite.palpite_casa, palpite.palpite_fora, jogo);
                                  }

                                  return (
                                    <tr key={nome}>
                                      <td className="player-name">{nome}</td>
                                      <td style={{ fontWeight: 'bold', textAlign: 'center' }}>
                                        {palpite ? (
                                          <span className="score predicted" style={{ fontSize: '0.85rem' }}>
                                            {palpite.palpite_casa} x {palpite.palpite_fora}
                                          </span>
                                        ) : (
                                          <span className="score missing" style={{ backgroundColor: '#f1f5f9', color: '#94a3b8', fontSize: '0.85rem' }}>
                                            Sem palpite
                                          </span>
                                        )}
                                      </td>
                                      <td style={{ fontWeight: 'bold', textAlign: 'center' }}>
                                        {pts !== '-' ? (
                                          <span style={{ 
                                            color: pts > 0 ? 'var(--color-primary)' : pts < 0 ? '#ef4444' : 'var(--color-dark)',
                                            backgroundColor: pts > 0 ? 'var(--color-primary-light)' : pts < 0 ? '#fee2e2' : '#f1f5f9',
                                            padding: '2px 8px',
                                            borderRadius: '4px',
                                            fontSize: '0.85rem'
                                          }}>
                                            {pts > 0 ? `+${pts}` : pts}
                                          </span>
                                        ) : (
                                          <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>-</span>
                                        )}
                                      </td>
                                      <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                                        {palpite && palpite.created_at ? formatarDataEnvio(palpite.created_at) : '-'}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        );
                      })()}
                    </div>
                  ) : (
                    <div>
                      <div className="form-group">
                        <label htmlFor="admin-select-participante-palpites">Selecionar Participante</label>
                        <select
                          id="admin-select-participante-palpites"
                          className="input-control"
                          value={participanteSelecionadoPalpitesAdmin}
                          onChange={(e) => setParticipanteSelecionadoPalpitesAdmin(e.target.value)}
                        >
                          {Array.from(new Set([
                            ...perfis.map(p => p.nome),
                            ...palpites.map(p => p.jogador_nome)
                          ])).filter(Boolean).sort((a, b) => a.localeCompare(b)).map(nome => (
                            <option key={nome} value={nome}>
                              {nome}
                            </option>
                          ))}
                        </select>
                      </div>

                      {(() => {
                        if (!participanteSelecionadoPalpitesAdmin) return <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Nenhum participante selecionado.</p>;

                        const palpitesDoJogador = palpites.filter(p => p.jogador_nome.toLowerCase() === participanteSelecionadoPalpitesAdmin.toLowerCase());

                        return (
                          <div className="table-wrapper" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                            <table className="ranking-table">
                              <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                                <tr>
                                  <th style={{ backgroundColor: '#0b1a2c', position: 'sticky', top: 0, zIndex: 1, textAlign: 'left' }}>Jogo</th>
                                  <th style={{ backgroundColor: '#0b1a2c', position: 'sticky', top: 0, zIndex: 1, textAlign: 'center' }}>Palpite</th>
                                  <th style={{ backgroundColor: '#0b1a2c', position: 'sticky', top: 0, zIndex: 1, textAlign: 'center' }}>Oficial</th>
                                  <th style={{ backgroundColor: '#0b1a2c', position: 'sticky', top: 0, zIndex: 1, textAlign: 'center' }}>Pontos</th>
                                </tr>
                              </thead>
                              <tbody>
                                {jogos.filter(jogo => jogo.id >= 80).map(jogo => {
                                  const palpite = palpitesDoJogador.find(p => p.jogo_id === jogo.id);
                                  const temResultado = jogo.gols_casa_real !== null && jogo.gols_fora_real !== null;
                                  let pts = '-';
                                  if (palpite && temResultado) {
                                    pts = calcularPontos(palpite.palpite_casa, palpite.palpite_fora, jogo);
                                  }

                                  return (
                                    <tr key={jogo.id}>
                                      <td style={{ fontSize: '0.85rem', textAlign: 'left' }}>
                                        <strong>{jogo.time_casa} x {jogo.time_fora}</strong>
                                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{jogo.data} às {jogo.hora ? jogo.hora.substring(0,5) : 'A definir'}</div>
                                      </td>
                                      <td style={{ fontWeight: 'bold', textAlign: 'center' }}>
                                        {palpite ? (
                                          <span className="score predicted" style={{ fontSize: '0.85rem' }}>
                                            {palpite.palpite_casa} x {palpite.palpite_fora}
                                          </span>
                                        ) : (
                                          <span className="score missing" style={{ backgroundColor: '#f1f5f9', color: '#94a3b8', fontSize: '0.85rem' }}>
                                            ? x ?
                                          </span>
                                        )}
                                      </td>
                                      <td style={{ fontWeight: 'bold', textAlign: 'center' }}>
                                        {temResultado ? (
                                          <span className="score predicted" style={{ backgroundColor: 'var(--color-primary)', color: 'white', fontSize: '0.85rem' }}>
                                            {jogo.gols_casa_real} x {jogo.gols_fora_real}
                                          </span>
                                        ) : (
                                          <span className="score missing" style={{ fontSize: '0.85rem' }}>- x -</span>
                                        )}
                                      </td>
                                      <td style={{ fontWeight: 'bold', textAlign: 'center' }}>
                                        {pts !== '-' ? (
                                          <span style={{ 
                                            color: pts > 0 ? 'var(--color-primary)' : pts < 0 ? '#ef4444' : 'var(--color-dark)',
                                            backgroundColor: pts > 0 ? 'var(--color-primary-light)' : pts < 0 ? '#fee2e2' : '#f1f5f9',
                                            padding: '2px 8px',
                                            borderRadius: '4px',
                                            fontSize: '0.85rem'
                                          }}>
                                            {pts > 0 ? `+${pts}` : pts}
                                          </span>
                                        ) : (
                                          <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                                            {palpite ? 'Aguardando' : '-'}
                                          </span>
                                        )}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>

                {/* Painel 1: Importar CSV */}
                <div className="panel">
                  <h3 style={{fontSize: '1rem', marginBottom: '8px'}}>Importar do Excel (CSV)</h3>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '12px' }}>
                    O arquivo deve ter 5 colunas: Nome; Time Casa; Gols Casa; Time Fora; Gols Fora.
                    Use o nome "Oficial" para os resultados reais dos jogos.
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                    <input 
                      type="file" 
                      accept=".csv" 
                      onChange={handleUploadCSV} 
                      className="input-control" 
                      style={{padding: '8px', flex: 1, margin: 0}}
                    />
                    <button 
                      onClick={handleDownloadTemplate}
                      className="btn-submit"
                      style={{ padding: '10px 16px', margin: 0, width: 'auto', backgroundColor: 'var(--color-accent)' }}
                    >
                      Baixar Template CSV
                    </button>
                  </div>

                  <hr style={{margin: '20px 0', border: 'none', borderTop: '1px solid var(--border-color)'}}/>

                  <div style={{ padding: '16px', backgroundColor: '#fff5f5', border: '1px solid #fed7d7', borderRadius: '8px' }}>
                    <h3 style={{ fontSize: '1rem', color: '#c53030', marginBottom: '8px' }}>Zona de Perigo</h3>
                    <p style={{ fontSize: '0.8rem', color: '#742a2a', marginBottom: '12px' }}>
                      Apagará todas as apostas e resultados. Apenas os 72 jogos em branco permanecerão.
                    </p>
                    <button 
                      onClick={async () => {
                        const resposta = prompt("ATENÇÃO MÁXIMA!\nIsso vai apagar todos os palpites de todos os usuários e todos os resultados oficiais.\nPara continuar, digite a palavra: APAGAR");
                        if (resposta !== "APAGAR") {
                          alert("Ação cancelada com segurança. Nada foi apagado.");
                          return;
                        }
                        
                        setLoading(true);
                        await dbService.apagarTudo();
                        window.location.reload();
                      }}
                      className="btn-secondary"
                      style={{ width: '100%', borderColor: '#f56565', color: '#c53030', margin: 0 }}
                    >
                      Zerar Todo o Banco de Dados
                    </button>
                  </div>
                </div>

                {/* Painel 2: Robô de Atualização Automática */}
                <div className="panel">
                  <h3 style={{fontSize: '1rem', marginBottom: '8px'}}>🤖 Acionar Robô de Resultados</h3>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '12px' }}>
                    Em vez de esperar a meia-noite, você pode clicar no botão abaixo para obrigar o site a bater na API oficial de esportes e atualizar todos os placares finalizados imediatamente!
                    <br/><strong style={{color: 'var(--color-danger)'}}>(Atenção: Essa função bate no servidor da Vercel, então só deve ser testada na versão online oficial do site).</strong>
                  </p>
                  <button 
                    onClick={async () => {
                      if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
                         alert("O robô roda no servidor de produção! Por favor, abra o site online publicado (e não o localhost) para usar esse botão.");
                         return;
                      }
                      try {
                        setLoading(true);
                        const res = await fetch('/api/update-matches');
                        const data = await res.json();
                        if (res.ok) {
                          alert(data.message + "\nQuantidade de jogos recém-atualizados: " + (data.jogosAtualizados ? data.jogosAtualizados.length : 0));
                          window.location.reload();
                        } else {
                          alert("Erro do robô: " + (data.error || "Desconhecido"));
                        }
                      } catch (err) {
                        alert("Erro de conexão ao chamar o robô. A API pode estar indisponível.");
                      } finally {
                        setLoading(false);
                      }
                    }}
                    className="btn-primary"
                    style={{ width: '100%', margin: 0, padding: '12px', backgroundColor: '#10b981', color: '#fff', fontWeight: 'bold' }}
                  >
                    🚀 Atualizar Placares com o Robô
                  </button>
                </div>

                {/* Painel: Comemoração Final */}
                <div className="panel">
                  <h3 style={{fontSize: '1rem', marginBottom: '8px'}}>🏆 Comemoração Final</h3>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '12px' }}>
                    Permite simular ou visualizar a tela de encerramento do bolão com o pódio dos 3 melhores e chuva de confetes.
                  </p>
                  <button 
                    onClick={() => {
                      setForcarComemora(prev => !prev);
                      setModalComemoraFechado(false);
                    }}
                    className="btn-primary"
                    style={{ width: '100%', margin: 0, padding: '12px', backgroundColor: forcarComemora ? '#ef4444' : '#f59e0b', color: '#fff', fontWeight: 'bold' }}
                  >
                    {forcarComemora ? '🛑 Parar Simulação de Campeão' : '🏆 Simular Tela de Campeão'}
                  </button>
                </div>

                {/* Painel 3: Atualizar Manualmente */}
                <div className="panel">
                  <h2 style={{fontSize: '1rem', marginBottom: '8px'}}>Atualizar Manualmente</h2>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '12px' }}>
                    Caso queira atualizar apenas um jogo manualmente sem usar a planilha.
                  </p>
                  <form onSubmit={handleAtualizarResultado}>
                    <div className="form-group">
                      <label htmlFor="admin-select-game">Jogo selecionado</label>
                      <select 
                        id="admin-select-game"
                        className="input-control"
                        value={jogoSelecionadoAdmin}
                        onChange={(e) => setJogoSelecionadoAdmin(e.target.value)}
                      >
                        {jogos.filter(j => j.id >= 80).map(j => (
                          <option key={j.id} value={j.id.toString()}>
                            {j.time_casa} x {j.time_fora} - {j.data} às {j.hora ? j.hora.substring(0,5) : 'A definir'}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Placar final</label>
                      <div className="scores-input-grid">
                        <input 
                          type="number"
                          className="score-input"
                          min="0"
                          max="99"
                          value={adminGolsCasa}
                          onChange={(e) => setAdminGolsCasa(e.target.value)}
                          required
                        />
                        <span className="score-divider">x</span>
                        <input 
                          type="number"
                          className="score-input"
                          min="0"
                          max="99"
                          value={adminGolsFora}
                          onChange={(e) => setAdminGolsFora(e.target.value)}
                          required
                        />
                      </div>
                    </div>
                    
                    {jogos.find(j => j.id === parseInt(jogoSelecionadoAdmin))?.fase === 'Mata-Mata' && parseInt(adminGolsCasa || 0) === parseInt(adminGolsFora || 0) && adminGolsCasa !== '' && (
                      <div className="form-group" style={{marginTop: '12px'}}>
                        <label>Vencedor nos Pênaltis</label>
                        <select 
                          className="input-control" 
                          value={adminVencedorPenaltis}
                          onChange={(e) => setAdminVencedorPenaltis(e.target.value)}
                          required
                        >
                          <option value="">Selecione o time que avançou</option>
                          <option value="casa">Time Casa ({jogos.find(j => j.id === parseInt(jogoSelecionadoAdmin))?.time_casa})</option>
                          <option value="fora">Time Fora ({jogos.find(j => j.id === parseInt(jogoSelecionadoAdmin))?.time_fora})</option>
                        </select>
                      </div>
                    )}
                    <button type="submit" className="btn-submit" style={{backgroundColor: 'var(--color-info)', color: 'var(--color-dark)'}}>
                      Atualizar jogo selecionado
                    </button>
                  </form>
                </div>



                {/* Painel 4: Gerenciar Bônus de Participantes */}
                <div className="panel">
                  <h2 style={{fontSize: '1rem', marginBottom: '8px'}}>Gerenciar Bônus de Participantes</h2>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '12px' }}>
                    Defina pontos adicionais manuais para cada participante (por acertos em cravadas de times, etc).
                  </p>
                  
                  <div className="table-wrapper">
                    <table className="ranking-table" style={{ marginTop: '8px' }}>
                      <thead>
                        <tr>
                          <th>Jogador</th>
                          <th>Bônus Atual</th>
                          <th>Ação</th>
                        </tr>
                      </thead>
                      <tbody>
                        {perfis.map(p => (
                          <tr key={p.id}>
                            <td className="player-name">{p.nome}</td>
                            <td>
                              <input 
                                type="number" 
                                className="input-control"
                                style={{ margin: 0, padding: '4px 8px', width: '80px', textAlign: 'center' }}
                                defaultValue={p.pontos_bonus || 0}
                                id={`bonus-input-${p.id}`}
                              />
                            </td>
                            <td>
                              <button 
                                onClick={async () => {
                                  const inputEl = document.getElementById(`bonus-input-${p.id}`);
                                  if (inputEl) {
                                    await handleSalvarBonus(p.id, p.nome, inputEl.value);
                                  }
                                }}
                                className="btn-submit"
                                style={{ padding: '6px 12px', margin: 0, width: 'auto', fontSize: '0.8rem' }}
                              >
                                Salvar
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal de Configuração do Supabase */}
      {modalConfigAberto && (
        <div className="modal-backdrop">
          <div className="modal-content">
            <div className="modal-header">Configurar Conexão do Supabase</div>
            
            <form onSubmit={handleSalvarSupabase}>
              <div className="form-group">
                <label htmlFor="sb-url">Supabase URL</label>
                <input 
                  type="url"
                  id="sb-url"
                  className="input-control"
                  placeholder="https://xxxxxx.supabase.co"
                  value={inputUrl}
                  onChange={(e) => setInputUrl(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label htmlFor="sb-key">Supabase Anon Key</label>
                <input 
                  type="password"
                  id="sb-key"
                  className="input-control"
                  placeholder="Chave secreta pública (anon key)"
                  value={inputKey}
                  onChange={(e) => setInputKey(e.target.value)}
                />
              </div>

              <div className="modal-actions">
                <button 
                  type="button" 
                  className="btn-secondary"
                  onClick={() => setModalConfigAberto(false)}
                >
                  Fechar
                </button>
                <button type="submit" className="btn-submit" style={{ flex: 1 }}>
                  Salvar Conexão
                </button>
              </div>

              <div style={{ marginTop: '20px', borderTop: '1px solid var(--border-color)', paddingTop: '15px' }}>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '10px' }}>
                  Se o aplicativo estiver travado em dados antigos (ex: faltando jogos na lista), clique abaixo para forçar a limpeza do cache.
                </p>
                <button 
                  type="button"
                  className="btn-secondary"
                  style={{ width: '100%', color: '#ef4444', borderColor: '#fecaca', marginBottom: '10px' }}
                  onClick={() => {
                    if (confirm("Deseja realmente forçar a limpeza dos dados e recarregar os 72 jogos corretos?")) {
                      localStorage.removeItem('bolao_jogos_local');
                      localStorage.removeItem('bolao_palpites_local');
                      localStorage.removeItem('bolao_seed_version');
                      window.location.reload();
                    }
                  }}
                >
                  Forçar Limpeza do Cache Local (Reset)
                </button>

                {isSupabaseConfigured() && (
                  <>
                    <button 
                      type="button"
                      className="btn-secondary"
                      style={{ width: '100%', color: '#ef4444', borderColor: '#fecaca', marginBottom: '10px' }}
                      onClick={handleLimparSupabase}
                    >
                      Desconectar Supabase
                    </button>


                  </>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Comemoração Final */}
      {exibirComemora && (
        <div className="celebration-overlay">
          <Confetes />
          <div className="celebration-container">
            {/* Controle de Áudio Flutuante */}
            <button 
              onClick={() => setAudioMutado(prev => !prev)}
              className="btn-audio-control"
              title={audioMutado ? "Tocar música" : "Mutar música"}
              aria-label="Controle de Áudio"
            >
              {audioMutado ? '🔇' : '🔊'}
            </button>

            <div className="celebration-header">
              <h1>🏆 Campeão da Copa 2026! 🏆</h1>
              <p>A Copa do Mundo de 2026 chegou ao fim e nosso bolão tem um vencedor!</p>
            </div>

            <div className="podium-wrapper">
              {/* Segundo Lugar */}
              {ranking[1] && (
                <div className="podium-place podium-second">
                  <span className="podium-player" title={ranking[1].jogador}>{ranking[1].jogador}</span>
                  <span className="podium-score">{ranking[1].pontos} pts</span>
                  <span className="podium-badge">🥈</span>
                  <div className="podium-column">2</div>
                </div>
              )}

              {/* Primeiro Lugar */}
              {ranking[0] && (
                <div className="podium-place podium-first">
                  <span className="podium-player" title={ranking[0].jogador}>{ranking[0].jogador}</span>
                  <span className="podium-score">{ranking[0].pontos} pts</span>
                  <span className="podium-badge">👑</span>
                  <div className="podium-column">1</div>
                </div>
              )}

              {/* Terceiro Lugar */}
              {ranking[2] && (
                <div className="podium-place podium-third">
                  <span className="podium-player" title={ranking[2].jogador}>{ranking[2].jogador}</span>
                  <span className="podium-score">{ranking[2].pontos} pts</span>
                  <span className="podium-badge">🥉</span>
                  <div className="podium-column">3</div>
                </div>
              )}
            </div>

            {ranking[0] && (
              <div className="champ-card">
                <span style={{ fontSize: '3rem' }}>🏆</span>
                <div className="champ-card-meta">
                  <h3>Parabéns, {ranking[0].jogador}!</h3>
                  <p>Você é o grande campeão do Bolão Copa 2026 com {ranking[0].pontos} pontos ({ranking[0].acertos} acertos)!</p>
                </div>
              </div>
            )}

            <div style={{ marginTop: '30px' }}>
              <button 
                onClick={() => setModalComemoraFechado(true)} 
                className="btn-submit"
                style={{ width: 'auto', padding: '12px 30px', fontSize: '1.05rem', background: 'linear-gradient(135deg, #10b981, #059669)', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}
              >
                Ver Detalhes do Ranking / Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
