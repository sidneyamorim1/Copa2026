import React, { useState, useEffect } from 'react';
import { dbService } from './services/db';
import { isSupabaseConfigured, configSupabaseLocal, authService, getSupabaseClient } from './supabaseClient';
import LoginScreen from './components/LoginScreen';

// Função para calcular pontos de um palpite
export function calcularPontos(palpiteCasa, palpiteFora, realCasa, realFora) {
  if (realCasa === null || realFora === null) return 0;
  if (palpiteCasa === null || palpiteFora === null) return 0;
  
  // 1. Placar Exato: +5 pontos
  if (palpiteCasa === realCasa && palpiteFora === realFora) {
    return 5;
  }
  
  // 2. Placar Invertido Exato: -3 pontos (ex: real 2x0, palpite 0x2)
  if (palpiteCasa === realFora && palpiteFora === realCasa && realCasa !== realFora) {
    return -3;
  }
  
  // 3. Acertou Vencedor ou Empate: +3 pontos
  const vencedorReal = realCasa > realFora ? 'casa' : (realCasa < realFora ? 'fora' : 'empate');
  const vencedorPalpite = palpiteCasa > palpiteFora ? 'casa' : (palpiteCasa < palpiteFora ? 'fora' : 'empate');
  
  if (vencedorReal === vencedorPalpite) {
    return 3;
  }
  
  return 0;
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

function App() {
  // Dados do banco
  const [jogos, setJogos] = useState([]);
  const [palpites, setPalpites] = useState([]);
  
  // Auth
  const [usuario, setUsuario] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [authChecked, setAuthChecked] = useState(!isSupabaseConfigured()); // se não tem supabase, já está "checado"

  // Estados da UI
  const [loading, setLoading] = useState(true);
  const [dataSelecionada, setDataSelecionada] = useState(obterDataHoje());
  const [jogoAtivoIdx, setJogoAtivoIdx] = useState(0); // Index global do jogo ativado (0 a N-1)
  
  // Calendário visual
  const hoje = new Date();
  const [calMes, setCalMes] = useState(hoje.getMonth()); // 0-11
  const [calAno, setCalAno] = useState(hoje.getFullYear());
  
  // Formulário de palpites
  const [nomeJogador, setNomeJogador] = useState(localStorage.getItem('bolao_nome_jogador') || '');
  const [palpiteCasa, setPalpiteCasa] = useState('');
  const [palpiteFora, setPalpiteFora] = useState('');
  
  // Formulário de administração de resultados oficiais
  const [jogoSelecionadoAdmin, setJogoSelecionadoAdmin] = useState('');
  const [adminGolsCasa, setAdminGolsCasa] = useState('');
  const [adminGolsFora, setAdminGolsFora] = useState('');
  
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
      
      if (dataJogos.length > 0) {
        const hoje = obterDataHoje();
        
        // 1. Tenta achar jogo de HOJE
        let idxEncontrado = dataJogos.findIndex(j => j.data === hoje);
        
        if (idxEncontrado >= 0) {
          // Encontrou jogo hoje
          setJogoAtivoIdx(idxEncontrado);
          setDataSelecionada(hoje);
        } else {
          // 2. Não tem jogo hoje — busca a data futura mais próxima
          const hojeDate = parseDateBR(hoje);
          const datasUnicas = Array.from(new Set(dataJogos.map(j => j.data)));
          
          let melhorData = null;
          let menorDiff = Infinity;
          
          for (const d of datasUnicas) {
            const diff = parseDateBR(d) - hojeDate;
            // Prioriza datas futuras (diff > 0), senão a mais recente passada
            if (diff >= 0 && diff < menorDiff) {
              menorDiff = diff;
              melhorData = d;
            }
          }
          
          // Se não achou nenhuma data futura, pega a última data passada
          if (!melhorData) {
            datasUnicas.sort((a, b) => parseDateBR(b) - parseDateBR(a));
            melhorData = datasUnicas[0];
          }
          
          idxEncontrado = dataJogos.findIndex(j => j.data === melhorData);
          setJogoAtivoIdx(idxEncontrado >= 0 ? idxEncontrado : 0);
          setDataSelecionada(melhorData || dataJogos[0].data);
        }
        
        // Inicializa o jogo do admin
        setJogoSelecionadoAdmin(dataJogos[idxEncontrado >= 0 ? idxEncontrado : 0].id.toString());
      }
    } catch (e) {
      console.error("Erro ao carregar os dados:", e);
    } finally {
      setLoading(false);
    }
  };

  // Escuta mudanças de autenticação
  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setAuthChecked(true);
      carregarDados();
      return;
    }

    // Verifica sessão inicial
    authService.getUser().then(async (user) => {
      if (user) {
        setUsuario(user);
        const admin = await authService.isAdmin(user.id);
        setIsAdmin(admin);
        setNomeJogador(user.user_metadata?.nome_display || user.email);
      }
      setAuthChecked(true);
    });

    // Escuta login/logout
    const { data: { subscription } } = authService.onAuthStateChange(async (event, session) => {
      const user = session?.user || null;
      setUsuario(user);
      if (user) {
        const admin = await authService.isAdmin(user.id);
        setIsAdmin(admin);
        setNomeJogador(user.user_metadata?.nome_display || user.email);
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

  const jogoAtivo = jogos[jogoAtivoIdx] || null;
  const jogosDaData = jogos.filter(j => j.data === dataSelecionada);
  const idxNaData = jogosDaData.findIndex(j => j?.id === jogoAtivo?.id);

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
  }, [jogoAtivoIdx, nomeJogador, palpites]);

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
    
    try {
      setLoading(true);
      const jogoId = parseInt(jogoSelecionadoAdmin);
      const jogoAtualizado = await dbService.atualizarResultadoJogo(
        jogoId,
        parseInt(adminGolsCasa),
        parseInt(adminGolsFora)
      );
      
      // Atualiza jogos em memória
      setJogos(jogos.map(j => j.id === jogoId ? {
        ...j,
        gols_casa_real: jogoAtualizado.gols_casa_real,
        gols_fora_real: jogoAtualizado.gols_fora_real
      } : j));
      
      alert("Resultado oficial atualizado!");
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
        const nomesValidos = ['Sidney', 'Eduardo', 'Aline', 'Matheus', 'Silvio', 'Daniel'];
        
        const removeAccents = (str) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

        for (let i = 0; i < linhas.length; i++) {
          const linha = linhas[i];
          if (!linha || !linha.trim()) continue;
          
          const partes = linha.split(/[,;]/).map(p => p.trim().replace(/^"|"$/g, ''));
          if (partes.length < 5) continue;
          
          const nome = partes[0];
          const timeCasa = partes[1];
          const golsCasa = partes[2];
          const timeFora = partes[3];
          const golsFora = partes[4];

          // Pular linha de cabeçalho
          if (nome.toLowerCase() === 'nome' || nome.toLowerCase() === 'apostador') continue;
          
          if (timeCasa && timeFora) {
            const jogo = jogos.find(j => 
              removeAccents(j.time_casa) === removeAccents(timeCasa) && 
              removeAccents(j.time_fora) === removeAccents(timeFora)
            );
            
            if (jogo) {
              if (golsCasa !== '' && golsFora !== '' && !isNaN(golsCasa) && !isNaN(golsFora)) {
                if (nome.toLowerCase() === 'oficial') {
                  // Placar oficial
                  atualizacoes.push({
                    jogoId: jogo.id,
                    golsCasa: parseInt(golsCasa, 10),
                    golsFora: parseInt(golsFora, 10)
                  });
                } else if (nomesValidos.includes(nome)) {
                  // Palpite
                  novosPalpites.push({
                    jogo_id: jogo.id,
                    jogador_nome: nome,
                    palpite_casa: parseInt(golsCasa, 10),
                    palpite_fora: parseInt(golsFora, 10)
                  });
                }
              }
            }
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
    
    // Para cada jogo, vamos gerar uma linha de 'Oficial' em branco
    jogos.forEach(jogo => {
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
    
    // Acha o primeiro jogo dessa data e navega até ele
    const idx = jogos.findIndex(j => j.data === data);
    if (idx >= 0) {
      setJogoAtivoIdx(idx);
    }
  };

  // Navegar mês do calendário
  const navegarCalendario = (direcao) => {
    let novoMes = calMes + direcao;
    let novoAno = calAno;
    if (novoMes < 0) { novoMes = 11; novoAno--; }
    if (novoMes > 11) { novoMes = 0; novoAno++; }
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
      const temJogo = jogos.some(j => j.data === dataStr);
      const qtdJogos = jogos.filter(j => j.data === dataStr).length;
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
      const novoJogoId = jogosDaData[novoIdxNaData].id;
      const globalIdx = jogos.findIndex(j => j.id === novoJogoId);
      setJogoAtivoIdx(globalIdx);
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
    
  // 2. Jogos avaliados (que possuem resultado real preenchido)
  const jogosAvaliadosCount = jogos.filter(j => j.gols_casa_real !== null && j.gols_fora_real !== null).length;
  
    const ranking = participantesUnicos.map(nome => {
      let pontos = 0;
      let acertos = 0; // +5 ou +3
      let erros = 0; // 0 ou -3
      
      const palpitesDoJogador = palpites.filter(p => p.jogador_nome.toLowerCase() === nome.toLowerCase());
      
      palpitesDoJogador.forEach(p => {
        const jogo = jogos.find(j => j.id === p.jogo_id);
        if (jogo && jogo.gols_casa_real !== null && jogo.gols_fora_real !== null) {
          const pts = calcularPontos(p.palpite_casa, p.palpite_fora, jogo.gols_casa_real, jogo.gols_fora_real);
          pontos += pts;
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
      erros
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

  // Palpites enviados pelo jogador ativo HOJE (na data selecionada)
  const palpitesHoje = jogoAtivo ? palpites.filter(p => {
    const jogo = jogos.find(j => j.id === p.jogo_id);
    return jogo && jogo.data === dataSelecionada && p.jogador_nome.toLowerCase() === nomeJogador.trim().toLowerCase();
  }) : [];

  // Obter datas únicas para o seletor de data
  const datasUnicas = Array.from(new Set(jogos.map(j => j.data)));
  
  // Quantidade de jogos na data selecionada
  const jogosNaDataCount = jogos.filter(j => j.data === dataSelecionada).length;

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
      {/* Header */}
      <header className="main-header">
        <h1>Bolão Copa 2026</h1>
        <p>Competição interna entre amigos, sem pagamentos, prêmios ou monetização</p>
        
        <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', justifyContent: 'center' }}>
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
              <h2>Calendário</h2>
              
              <div className="calendar-widget">
                {/* Cabeçalho do mês */}
                <div className="calendar-header">
                  <button className="cal-nav-btn" onClick={() => navegarCalendario(-1)} title="Mês anterior">‹</button>
                  <span className="cal-month-label">{nomeMeses[calMes]} {calAno}</span>
                  <button className="cal-nav-btn" onClick={() => navegarCalendario(1)} title="Próximo mês">›</button>
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
                      {jogoAtivo.grupo} - {jogoAtivo.data} às {jogoAtivo.hora}
                    </div>
                    <div className="match-teams">
                      {jogoAtivo.time_casa} x {jogoAtivo.time_fora}
                    </div>
                    
                    {jogoAtivo.gols_casa_real !== null ? (
                      <div className="match-status-badge" style={{ backgroundColor: '#e2e8f0', color: '#475569' }}>
                        Placar oficial: {jogoAtivo.gols_casa_real} x {jogoAtivo.gols_fora_real}
                      </div>
                    ) : new Date() > new Date(new Date(`${jogoAtivo.data}T${jogoAtivo.hora}`).getTime() - 3600000) ? (
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
                      const dataHoraJogo = new Date(`${jogoAtivo.data}T${jogoAtivo.hora}`);
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
                  {jogos.filter(j => j.data === dataSelecionada).map(jogo => {
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
              <h2>Usuários com ranking</h2>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '12px' }}>
                Lista resumida dos participantes, ordenada pelos pontos acumulados.
              </p>

              {ranking.length > 0 ? (
                <div className="table-wrapper">
                  <table className="ranking-table">
                    <thead>
                      <tr>
                        <th style={{ width: '50px' }}>#</th>
                        <th>Jogador</th>
                        <th>Pontos</th>
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
                        if (confirm("ATENÇÃO: Você tem certeza que deseja apagar TUDO (apostas e placares)? Isso não tem volta!")) {
                          setLoading(true);
                          await dbService.apagarTudo();
                          window.location.reload();
                        }
                      }}
                      className="btn-secondary"
                      style={{ width: '100%', borderColor: '#f56565', color: '#c53030', margin: 0 }}
                    >
                      Zerar Todo o Banco de Dados
                    </button>
                  </div>
                </div>

                {/* Painel 2: Atualizar Manualmente */}
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
                        {jogos.map(j => (
                          <option key={j.id} value={j.id.toString()}>
                            {j.time_casa} x {j.time_fora} - {j.data} às {j.hora}
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
                    <button type="submit" className="btn-submit" style={{backgroundColor: 'var(--color-info)', color: 'var(--color-dark)'}}>
                      Atualizar jogo selecionado
                    </button>
                  </form>
                </div>

                {/* Painel 3: Resultados Oficiais */}
                <div className="panel">
                  <h2 style={{fontSize: '1rem', marginBottom: '12px', color: 'var(--color-primary)'}}>
                    Resultados Oficiais Registrados
                  </h2>
                  <div style={{display: 'flex', flexWrap: 'wrap', gap: '8px'}}>
                    {jogos.filter(j => j.gols_casa_real !== null && j.gols_fora_real !== null).length === 0 ? (
                      <p style={{fontSize: '0.8rem', color: 'var(--text-muted)'}}>Nenhum resultado oficial registrado ainda.</p>
                    ) : (
                      jogos.filter(j => j.gols_casa_real !== null && j.gols_fora_real !== null).map(j => (
                        <div key={j.id} style={{
                          padding: '8px 14px',
                          backgroundColor: 'var(--color-light)',
                          border: '1px solid var(--border-color)',
                          borderRadius: '8px',
                          fontSize: '0.85rem',
                          minWidth: '180px'
                        }}>
                          <strong>{j.time_casa} {j.gols_casa_real} x {j.gols_fora_real} {j.time_fora}</strong>
                          <div style={{fontSize: '0.72rem', color: 'var(--text-muted)'}}>{j.data} às {j.hora}</div>
                        </div>
                      ))
                    )}
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

                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '10px', marginTop: '10px' }}>
                      Se a nuvem estiver faltando jogos, force a sincronização para enviar todos os 72 jogos.
                    </p>
                    <button 
                      type="button" 
                      className="btn-secondary" 
                      style={{ width: '100%', borderColor: '#f59e0b', color: '#b45309' }}
                      onClick={async (e) => {
                        const btn = e.target;
                        btn.textContent = 'Sincronizando... aguarde';
                        btn.disabled = true;
                        try {
                          await dbService.forcarSincronizacaoSupabase();
                          alert('Supabase atualizado com sucesso (72 jogos e 294 palpites sincronizados)!');
                          window.location.reload();
                        } catch (err) {
                          alert('Erro ao sincronizar: ' + err.message);
                          btn.textContent = 'Forçar Sincronização (Nuvem)';
                          btn.disabled = false;
                        }
                      }}
                    >
                      Forçar Sincronização (Nuvem)
                    </button>
                  </>
                )}
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
