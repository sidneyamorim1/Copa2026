import { createClient } from '@supabase/supabase-js';

// Tenta obter as credenciais das variáveis de ambiente (Vite) ou do localStorage (para configuração dinâmica via UI)
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

const credentials = getCredentials();

export const isSupabaseConfigured = () => {
  const creds = getCredentials();
  return !!(creds.url && creds.key);
};

export const getSupabaseClient = () => {
  const creds = getCredentials();
  if (creds.url && creds.key) {
    return createClient(creds.url, creds.key);
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
