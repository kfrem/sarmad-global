'use client';

import React, { useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, profile, loading, signOut } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.push('/login');
      } else if (profile?.role !== 'admin' || profile?.company_id !== null) {
        // Normal client or company admin has no business in the practice admin panel
        router.push('/dashboard');
      }
    }
  }, [user, profile, loading, router]);

  if (loading || !user || profile?.role !== 'admin' || profile?.company_id !== null) {
    return (
      <div className="layout-loading">
        <style dangerouslySetInnerHTML={{ __html: `
          .layout-loading {
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            background-color: #0f172a;
          }
          .spinner {
            width: 40px;
            height: 40px;
            border: 3px solid #334155;
            border-top-color: #3b82f6;
            border-radius: 50%;
            animation: spin 1s linear infinite;
          }
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}} />
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div className="admin-layout">
      <style dangerouslySetInnerHTML={{ __html: `
        .admin-layout {
          display: grid;
          grid-template-columns: 280px 1fr;
          min-height: 100vh;
          background-color: #f8fafc;
        }
        @media (max-width: 1024px) {
          .admin-layout {
            grid-template-columns: 1fr;
          }
        }
        .admin-sidebar {
          background-color: #0f172a;
          color: #94a3b8;
          padding: 30px 24px;
          display: flex;
          flex-direction: column;
          border-right: 1px solid #1e293b;
        }
        .admin-brand {
          font-family: 'Outfit', sans-serif;
          font-size: 1.3rem;
          font-weight: 800;
          color: #ffffff;
          margin-bottom: 40px;
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .admin-main {
          padding: 40px;
          max-width: 1400px;
          width: 100%;
          margin: 0 auto;
          overflow-y: auto;
        }
        .admin-nav {
          display: flex;
          flex-direction: column;
          gap: 6px;
          flex: 1;
        }
        .admin-link {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 16px;
          border-radius: 8px;
          color: #94a3b8;
          font-weight: 500;
          transition: background 0.2s, color 0.2s;
        }
        .admin-link:hover, .admin-link.active {
          background-color: #1e293b;
          color: #ffffff;
        }
        .admin-footer {
          padding-top: 20px;
          border-top: 1px solid #1e293b;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .btn-logout {
          background: transparent;
          color: #fca5a5;
          border: 1px solid rgba(239, 68, 68, 0.2);
          padding: 10px;
          border-radius: 6px;
          font-size: 0.9rem;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.2s;
          text-align: center;
        }
        .btn-logout:hover {
          background: rgba(239, 68, 68, 0.1);
          color: #ffffff;
          border-color: #ef4444;
        }
      `}} />

      <aside className="admin-sidebar">
        <div className="admin-brand">
          <span>💼</span>
          <span>Practice Admin</span>
        </div>
        <nav className="admin-nav">
          <div className="admin-link active">
            <span>🏢</span>
            <span>Manage Tenants</span>
          </div>
        </nav>
        <div className="admin-footer">
          <div style={{ fontSize: '0.8rem' }}>Practice Administrator:<br/>{profile?.email}</div>
          <button className="btn-logout" onClick={signOut}>
            🚪 Logout
          </button>
        </div>
      </aside>

      <main className="admin-main">
        {children}
      </main>
    </div>
  );
}
