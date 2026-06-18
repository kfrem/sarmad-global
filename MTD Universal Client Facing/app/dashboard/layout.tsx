'use client';

import React, { useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  if (loading || !user) {
    return (
      <div className="layout-loading">
        <style dangerouslySetInnerHTML={{ __html: `
          .layout-loading {
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            background-color: #f8fafc;
          }
          .spinner {
            width: 40px;
            height: 40px;
            border: 3px solid #cbd5e1;
            border-top-color: var(--company-accent, #2563eb);
            border-radius: 50%;
            animation: spin 1s linear infinite;
          }
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        ` }} />
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div className="dashboard-layout">
      <Sidebar />
      <main className="main-content">
        <style dangerouslySetInnerHTML={{ __html: `
          .main-content {
            padding: 40px;
            max-width: 1400px;
            width: 100%;
            margin: 0 auto;
            overflow-y: auto;
          }
          @media (max-width: 768px) {
            .main-content {
              padding: 24px 16px;
            }
          }
        ` }} />
        {children}
      </main>
    </div>
  );
}
