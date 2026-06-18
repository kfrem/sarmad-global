'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [envError, setEnvError] = useState(false);
  const { user, profile, loading, refreshAuth } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      setEnvError(true);
    }
  }, []);

  // If already logged in, redirect
  useEffect(() => {
    if (!loading && user && profile) {
      if (profile.role === 'admin') {
        router.push('/admin');
      } else {
        router.push('/dashboard');
      }
    }
  }, [user, profile, loading, router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSubmitting(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setErrorMsg(error.message);
        setSubmitting(false);
        return;
      }

      // Refresh auth context to fetch profile and company details
      await refreshAuth();
    } catch (err: any) {
      setErrorMsg(err.message || 'An unexpected error occurred.');
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="login-container">
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div className="login-container">
      <style dangerouslySetInnerHTML={{ __html: `
        .login-container {
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          background-color: #f1f5f9;
          font-family: 'Plus Jakarta Sans', sans-serif;
          padding: 20px;
        }
        .login-card {
          background: #ffffff;
          border-radius: 16px;
          box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.05);
          width: 100%;
          max-width: 440px;
          padding: 40px;
          border: 1px solid #e2e8f0;
          animation: slideUp 0.4s ease-out;
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .logo-placeholder {
          font-family: 'Outfit', sans-serif;
          font-size: 1.5rem;
          font-weight: 800;
          text-align: center;
          margin-bottom: 24px;
          color: #0f172a;
          letter-spacing: -0.03em;
        }
        .login-title {
          font-family: 'Outfit', sans-serif;
          font-size: 1.25rem;
          font-weight: 600;
          color: #0f172a;
          margin-bottom: 8px;
          text-align: center;
        }
        .login-subtitle {
          font-size: 0.875rem;
          color: #64748b;
          margin-bottom: 32px;
          text-align: center;
        }
        .env-warning-banner {
          background-color: #fffbeb;
          border: 1px solid #fef3c7;
          color: #b45309;
          padding: 16px;
          border-radius: 12px;
          font-size: 0.85rem;
          margin-bottom: 24px;
          text-align: left;
          line-height: 1.5;
        }
        .env-warning-banner code {
          background: #fef08a;
          padding: 2px 4px;
          border-radius: 4px;
          font-family: monospace;
          font-weight: 600;
        }
        .env-warning-banner pre {
          background: #fafaf9;
          padding: 10px;
          border-radius: 6px;
          font-size: 0.725rem;
          overflow-x: auto;
          border: 1px solid #e7e5e4;
          margin: 8px 0 0 0;
          color: #44403c;
          font-family: monospace;
        }
        .form-group {
          margin-bottom: 20px;
        }
        .label {
          display: block;
          font-size: 0.825rem;
          font-weight: 700;
          color: #475569;
          margin-bottom: 8px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .input {
          width: 100%;
          padding: 12px 16px;
          border: 1px solid #cbd5e1;
          border-radius: 8px;
          font-size: 0.95rem;
          font-family: inherit;
          color: #0f172a;
          transition: border-color 0.2s, box-shadow 0.2s;
        }
        .input:focus {
          outline: none;
          border-color: #2563eb;
          box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.15);
        }
        .btn-submit {
          width: 100%;
          background: #2563eb;
          color: #ffffff;
          border: none;
          padding: 14px;
          border-radius: 8px;
          font-family: 'Outfit', sans-serif;
          font-weight: 600;
          font-size: 1rem;
          cursor: pointer;
          transition: background 0.2s, transform 0.1s;
          margin-top: 10px;
        }
        .btn-submit:hover {
          background: #1d4ed8;
        }
        .btn-submit:active {
          transform: scale(0.98);
        }
        .error-banner {
          background-color: #fef2f2;
          border: 1px solid #fee2e2;
          color: #b91c1c;
          padding: 12px 16px;
          border-radius: 8px;
          font-size: 0.875rem;
          margin-bottom: 24px;
          text-align: left;
        }
        .spinner {
          width: 40px;
          height: 40px;
          border: 3px solid #cbd5e1;
          border-top-color: #2563eb;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}} />


      <div className="login-card">
        <div className="logo-placeholder">MTD PORTAL</div>
        
        {envError && (
          <div className="env-warning-banner">
            <strong>⚠️ Supabase Setup Required</strong>
            <div style={{ marginTop: '4px' }}>
              Create a <code>.env.local</code> file in your project root with your credentials to enable database connectivity:
            </div>
            <pre>
{`NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key`}
            </pre>
          </div>
        )}

        <h1 className="login-title">Sign in to your account</h1>
        <p className="login-subtitle">Enter your details to access your portal</p>

        {errorMsg && <div className="error-banner">{errorMsg}</div>}

        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label className="label">Email Address</label>
            <input
              type="email"
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. name@company.co.uk"
              required
            />
          </div>

          <div className="form-group">
            <label className="label">Password</label>
            <input
              type="password"
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>

          <button type="submit" className="btn-submit" disabled={submitting}>
            {submitting ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}
