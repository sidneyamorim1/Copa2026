import { createClient } from '@supabase/supabase-js';

// Tenta obter as credenciais das variáveis de ambiente (Vite) ou do localStorage
const getCredentials = () => {
  const urlEnv = import.meta.env.VITE_SUPABASE_URL;
  const keyEnv = import.meta.env.VITE_SUPABASE_ANON_KEY;
  const urlLocal = localStorage.getItem('bolao_supabase_url');
  const keyLocal = localStorage.getItem('bolao_supabase_anon_key');
  return {
    url: urlEnv || urlLocal || '',
    key: keyEnv || keyLocal || ''
  };
};

export const isSupabaseConfigured = () => {
  const creds = getCredentials();
  return !!(creds.url && creds.key);
};

// Cliente singleton para evitar múltiplas instâncias
let _client = null;
export const getSupabaseClient = () => {
  if (_client) return _client;
  const creds = getCredentials();
  if (creds.url && creds.key) {
    _client = createClient(creds.url, creds.key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    });
    return _client;
  }
  return null;
};

export const supabase = getSupabaseClient();

export const configSupabaseLocal = (url, key) => {
  if (url && key) {
    localStorage.setItem('bolao_supabase_url', url);
    localStorage.setItem('bolao_supabase_anon_key', key);
  } else {
    localStorage.removeItem('bolao_supabase_url');
    localStorage.removeItem('bolao_supabase_anon_key');
  }
  window.location.reload();
};

// ── Auth helpers ──────────────────────────────────────────────
export const authService = {
  /** Retorna o usuário logado atual (ou null) */
  async getUser() {
    const client = getSupabaseClient();
    if (!client) return null;
    const { data: { user } } = await client.auth.getUser();
    return user;
  },

  /** Retorna a sessão atual */
  async getSession() {
    const client = getSupabaseClient();
    if (!client) return null;
    const { data: { session } } = await client.auth.getSession();
    return session;
  },

  /** Faz logout */
  async signOut() {
    const client = getSupabaseClient();
    if (!client) return;
    await client.auth.signOut();
  },

  /** Escuta mudanças de autenticação (login/logout) */
  onAuthStateChange(callback) {
    const client = getSupabaseClient();
    if (!client) return { data: { subscription: { unsubscribe: () => {} } } };
    return client.auth.onAuthStateChange(callback);
  },

  /** Verifica se o usuário logado é admin consultando a tabela perfis */
  async isAdmin(userId) {
    const client = getSupabaseClient();
    if (!client || !userId) return false;
    const { data, error } = await client
      .from('perfis')
      .select('is_admin')
      .eq('id', userId)
      .maybeSingle();
    if (error || !data) return false;
    return data.is_admin === true;
  }
};
