'use client';

import React, { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/context/AuthContext';

export default function SettingsPageClient() {
  const { profile } = useAuth();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMsg('');
    setErrorMsg('');

    if (newPassword.length < 6) {
      setErrorMsg('Password must be at least 6 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMsg('Passwords do not match.');
      return;
    }

    setSubmitting(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        setErrorMsg(error.message);
      } else {
        setSuccessMsg('Your password has been successfully updated.');
        setNewPassword('');
        setConfirmPassword('');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'An unexpected error occurred.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="settings-container animate-fade-in">
      <style dangerouslySetInnerHTML={{ __html: `
        .settings-container {
          max-width: 600px;
          margin: 0 auto;
        }
        .header-section {
          margin-bottom: 32px;
        }
        .settings-title {
          font-size: 1.8rem;
          color: var(--text-main);
          margin-bottom: 8px;
        }
        .settings-subtitle {
          color: var(--text-muted);
          font-size: 0.95rem;
        }
        .success-banner {
          background-color: #ecfdf5;
          border: 1px solid #a7f3d0;
          color: #047857;
          padding: 16px;
          border-radius: var(--radius-md);
          font-size: 0.9rem;
          margin-bottom: 24px;
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .error-banner {
          background-color: #fef2f2;
          border: 1px solid #fecaca;
          color: #b91c1c;
          padding: 16px;
          border-radius: var(--radius-md);
          font-size: 0.9rem;
          margin-bottom: 24px;
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .submit-btn {
          margin-top: 10px;
          width: 100%;
        }
      ` }} />

      <div className="header-section">
        <h1 className="settings-title">Account Settings</h1>
        <p className="settings-subtitle">Manage your credentials and security preferences.</p>
      </div>

      {successMsg && (
        <div className="success-banner">
          <span>✅</span>
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="error-banner">
          <span>⚠️</span>
          <span>{errorMsg}</span>
        </div>
      )}

      <div className="card">
        <h3 style={{ marginBottom: '20px', fontSize: '1.15rem' }}>Update Password</h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '24px' }}>
          Enter your new password below. Ensure it is secure and at least 6 characters long.
        </p>

        <form onSubmit={handleUpdatePassword}>
          <div className="input-group">
            <label className="input-label">New Password</label>
            <input
              type="password"
              className="input-field"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="••••••••"
              required
              disabled={submitting}
            />
          </div>

          <div className="input-group">
            <label className="input-label">Confirm New Password</label>
            <input
              type="password"
              className="input-field"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              required
              disabled={submitting}
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary submit-btn"
            disabled={submitting}
          >
            {submitting ? 'Updating Password...' : 'Save Password'}
          </button>
        </form>
      </div>
    </div>
  );
}
