import React, { useState } from 'react';
import { getSupabaseClient } from '../supabaseClient';

export default function LoginScreen({ onLogin }) {
  const [modo, setModo] = useState('login'); // 'login' | 'cadastro'
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [nome, setNome] = useState('');
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setErro('');
    setLoading(true);
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase.auth.signInWithPassword({ email, password: senha });
      if (error) throw error;
      onLogin(data.user);
    } catch (err) {
      setErro(err.message === 'Invalid login credentials'
        ? 'Email ou senha incorretos.'
        : err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCadastro = async (e) => {
    e.preventDefault();
    setErro('');
    if (!nome.trim()) { setErro('Por favor, informe seu nome.'); return; }
    setLoading(true);
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase.auth.signUp({
        email,
        password: senha,
        options: { data: { nome_display: nome.trim() } }
      });
      if (error) throw error;
      setSucesso('Conta criada! Verifique seu email para confirmar o cadastro, depois faça login.');
      setModo('login');
    } catch (err) {
      setErro(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #064e3b 0%, #065f46 40%, #047857 100%)',
      padding: '20px'
    }}>
      <div style={{
        background: 'white',
        borderRadius: '20px',
        padding: '40px 36px',
        width: '100%',
        maxWidth: '400px',
        boxShadow: '0 25px 50px rgba(0,0,0,0.25)'
      }}>
        {/* Logo / Título */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '8px' }}>⚽</div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: '800', color: '#064e3b', margin: 0 }}>
            Bolão Copa 2026
          </h1>
          <p style={{ color: '#6b7280', fontSize: '0.9rem', marginTop: '6px' }}>
            Faça login para acessar seus palpites
          </p>
        </div>

        {/* Abas Login / Cadastro */}
        <div style={{
          display: 'flex',
          backgroundColor: '#f3f4f6',
          borderRadius: '10px',
          padding: '4px',
          marginBottom: '24px'
        }}>
          {['login', 'cadastro'].map(m => (
            <button
              key={m}
              onClick={() => { setModo(m); setErro(''); setSucesso(''); }}
              style={{
                flex: 1,
                padding: '10px',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: '600',
                fontSize: '0.9rem',
                transition: 'all 0.2s',
                backgroundColor: modo === m ? 'white' : 'transparent',
                color: modo === m ? '#064e3b' : '#6b7280',
                boxShadow: modo === m ? '0 2px 8px rgba(0,0,0,0.1)' : 'none'
              }}
            >
              {m === 'login' ? 'Entrar' : 'Criar conta'}
            </button>
          ))}
        </div>

        {/* Mensagens */}
        {erro && (
          <div style={{
            background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px',
            padding: '12px', marginBottom: '16px', color: '#dc2626', fontSize: '0.85rem'
          }}>
            {erro}
          </div>
        )}
        {sucesso && (
          <div style={{
            background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px',
            padding: '12px', marginBottom: '16px', color: '#15803d', fontSize: '0.85rem'
          }}>
            {sucesso}
          </div>
        )}

        {/* Formulário */}
        <form onSubmit={modo === 'login' ? handleLogin : handleCadastro}>
          {modo === 'cadastro' && (
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontWeight: '600', fontSize: '0.85rem', color: '#374151', marginBottom: '6px' }}>
                Seu nome
              </label>
              <input
                type="text"
                value={nome}
                onChange={e => setNome(e.target.value)}
                placeholder="Ex: Sidney"
                required
                style={{
                  width: '100%', padding: '12px 14px', border: '1.5px solid #d1d5db',
                  borderRadius: '10px', fontSize: '0.95rem', outline: 'none',
                  boxSizing: 'border-box', transition: 'border-color 0.2s'
                }}
                onFocus={e => e.target.style.borderColor = '#059669'}
                onBlur={e => e.target.style.borderColor = '#d1d5db'}
              />
            </div>
          )}

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontWeight: '600', fontSize: '0.85rem', color: '#374151', marginBottom: '6px' }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="seu@email.com"
              required
              style={{
                width: '100%', padding: '12px 14px', border: '1.5px solid #d1d5db',
                borderRadius: '10px', fontSize: '0.95rem', outline: 'none',
                boxSizing: 'border-box', transition: 'border-color 0.2s'
              }}
              onFocus={e => e.target.style.borderColor = '#059669'}
              onBlur={e => e.target.style.borderColor = '#d1d5db'}
            />
          </div>

          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'block', fontWeight: '600', fontSize: '0.85rem', color: '#374151', marginBottom: '6px' }}>
              Senha
            </label>
            <input
              type="password"
              value={senha}
              onChange={e => setSenha(e.target.value)}
              placeholder="Mínimo 6 caracteres"
              required
              minLength={6}
              style={{
                width: '100%', padding: '12px 14px', border: '1.5px solid #d1d5db',
                borderRadius: '10px', fontSize: '0.95rem', outline: 'none',
                boxSizing: 'border-box', transition: 'border-color 0.2s'
              }}
              onFocus={e => e.target.style.borderColor = '#059669'}
              onBlur={e => e.target.style.borderColor = '#d1d5db'}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%', padding: '14px',
              background: loading ? '#9ca3af' : 'linear-gradient(135deg, #059669, #047857)',
              color: 'white', border: 'none', borderRadius: '10px',
              fontWeight: '700', fontSize: '1rem', cursor: loading ? 'not-allowed' : 'pointer',
              boxShadow: '0 4px 12px rgba(5, 150, 105, 0.3)',
              transition: 'all 0.2s'
            }}
          >
            {loading ? 'Aguarde...' : (modo === 'login' ? 'Entrar' : 'Criar conta')}
          </button>
        </form>
      </div>
    </div>
  );
}
