'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

export default function RootPage() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.push('/login');
      } else if (profile?.role === 'admin') {
        router.push('/admin');
      } else {
        router.push('/dashboard');
      }
    }
  }, [user, profile, loading, router]);

  return (
    <div className="loading-container">
      <style dangerouslySetInnerHTML={{ __html: `
        .loading-container {
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
      `}} />
      <div className="spinner"></div>
    </div>
  );
}
