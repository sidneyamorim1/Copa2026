/**
 * Resolve o nome do participante tratando variações e erros comuns de grafia
 * @param {string} nome Nome a ser resolvido
 * @returns {string} Nome normalizado ou string vazia
 */
export function resolverNomeParticipante(nome) {
  if (!nome) return '';
  const n = nome.trim().toLowerCase();
  
  if (n === 'sidney' || n === 'sid' || n === 'administrador') {
    return 'Sidney';
  }
  if (n === 'eduardo' || n === 'edu') {
    return 'Eduardo';
  }
  if (n === 'aline' || n === 'aline jahn') {
    return 'Aline';
  }
  if (n === 'matheus') {
    return 'Matheus';
  }
  if (n === 'silvio') {
    return 'Silvio';
  }
  if (n === 'daniel') {
    return 'Daniel';
  }
  if (n === 'oficial') {
    return 'Oficial';
  }
  
  // Retorna o nome com a primeira letra maiúscula e o resto minúsculo por padrão
  return nome.charAt(0).toUpperCase() + nome.slice(1).toLowerCase();
}

/**
 * Verifica se o nome do participante é válido para o bolão
 * @param {string} nome Nome normalizado do participante
 * @returns {boolean} True se for um participante válido
 */
export function isNomeParticipanteValido(nome) {
  if (!nome) return false;
  const n = nome.trim().toLowerCase();
  const participantesValidos = ['sidney', 'eduardo', 'aline', 'matheus', 'silvio', 'daniel', 'oficial'];
  return participantesValidos.includes(n);
}
