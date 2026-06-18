'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabaseClient';
import Link from 'next/link';

interface Stats {
  pendingDocs: number;
  draftTx: number;
  confirmedTx: number;
  unmatchedBankLines: number;
}

interface DocItem {
  id: string;
  filename: string;
  type: string;
  status: string;
  uploaded_at: string;
}

export default function DashboardPage() {
  const { company, profile } = useAuth();
  const [stats, setStats] = useState<Stats>({ pendingDocs: 0, draftTx: 0, confirmedTx: 0, unmatchedBankLines: 0 });
  const [recentDocs, setRecentDocs] = useState<DocItem[]>([]);
  const [loadingStats, setLoadingStats] = useState(true);

  const loadDashboardData = async () => {
    try {
      setLoadingStats(true);

      // Fetch pending documents count
      const { count: pendingDocsCount } = await supabase
        .from('documents')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');

      // Fetch draft transactions count
      const { count: draftTxCount } = await supabase
        .from('transactions')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'draft');

      // Fetch confirmed transactions count
      const { count: confirmedTxCount } = await supabase
        .from('transactions')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'confirmed');

      // Fetch unmatched bank lines count
      const { count: unmatchedBankCount } = await supabase
        .from('bank_lines')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'unmatched');

      setStats({
        pendingDocs: pendingDocsCount || 0,
        draftTx: draftTxCount || 0,
        confirmedTx: confirmedTxCount || 0,
        unmatchedBankLines: unmatchedBankCount || 0,
      });

      // Fetch recent 5 documents
      const { data: docs } = await supabase
        .from('documents')
        .select('id, filename, type, status, uploaded_at')
        .order('uploaded_at', { ascending: false })
        .limit(5);

      if (docs) {
        setRecentDocs(docs as DocItem[]);
      }
    } catch (err) {
      console.error('Error loading dashboard data:', err);
    } finally {
      setLoadingStats(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  const getTaxFramingText = () => {
    if (!company) return '';
    switch (company.entity_type) {
      case 'sole_trader':
        return 'Making Tax Digital (ITSA) Sole Trader quarterly records';
      case 'landlord':
        return 'Making Tax Digital (ITSA) Property rental records';
      case 'limited_company':
        return 'Ordinary Accounts and Corporation Tax records';
      case 'partnership':
        return 'Partnership Tax Return records';
      default:
        return '';
    }
  };

  return (
    <div className="dashboard-container animate-fade-in">
      <style dangerouslySetInnerHTML={{ __html: `
        .welcome-card {
          background: linear-gradient(135deg, var(--primary) 0%, rgba(var(--company-accent-rgb), 0.8) 100%);
          color: #ffffff;
          padding: 32px;
          border-radius: var(--radius-lg);
          margin-bottom: 32px;
          box-shadow: var(--shadow-lg);
        }
        .welcome-card h1 {
          font-size: 2rem;
          margin-bottom: 8px;
        }
        .welcome-card p {
          opacity: 0.9;
          font-size: 1rem;
        }
        .meta-badges {
          display: flex;
          gap: 10px;
          margin-top: 16px;
        }
        .meta-badge {
          background: rgba(255, 255, 255, 0.15);
          backdrop-filter: blur(4px);
          padding: 6px 12px;
          border-radius: 9999px;
          font-size: 0.8rem;
          font-weight: 600;
          letter-spacing: 0.02em;
        }
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
          gap: 24px;
          margin-bottom: 32px;
        }
        .stat-card {
          background: var(--bg-card);
          border: 1px solid var(--border-light);
          border-radius: var(--radius-md);
          padding: 24px;
          box-shadow: var(--shadow-sm);
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .stat-label {
          font-size: 0.85rem;
          font-weight: 700;
          color: var(--text-muted);
          text-transform: uppercase;
        }
        .stat-value {
          font-family: var(--font-display);
          font-size: 2.25rem;
          font-weight: 700;
          color: var(--text-main);
        }
        .stat-footer {
          font-size: 0.875rem;
          color: var(--text-muted);
          margin-top: auto;
        }
        .grid-split {
          display: grid;
          grid-template-columns: 2fr 1fr;
          gap: 32px;
        }
        @media (max-width: 1024px) {
          .grid-split {
            grid-template-columns: 1fr;
          }
        }
        .doc-list-table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 16px;
        }
        .doc-list-table th {
          text-align: left;
          padding: 12px 16px;
          font-size: 0.8rem;
          font-weight: 700;
          color: var(--text-muted);
          border-bottom: 1px solid var(--border-light);
          text-transform: uppercase;
        }
        .doc-list-table td {
          padding: 16px;
          border-bottom: 1px solid var(--border-light);
          font-size: 0.9rem;
        }
        .quick-actions {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .action-card {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 20px;
          background: var(--bg-card);
          border: 1px solid var(--border-light);
          border-radius: var(--radius-md);
          box-shadow: var(--shadow-sm);
          cursor: pointer;
          transition: transform 0.2s, box-shadow 0.2s;
        }
        .action-card:hover {
          transform: translateY(-2px);
          box-shadow: var(--shadow-md);
          border-color: var(--primary);
        }
        .action-icon {
          font-size: 2rem;
          width: 50px;
          height: 50px;
          border-radius: var(--radius-sm);
          background: var(--primary-glow);
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .action-info h3 {
          font-size: 1rem;
          margin-bottom: 4px;
        }
        .action-info p {
          font-size: 0.85rem;
          color: var(--text-muted);
        }
      ` }} />

      {/* Welcome Card */}
      <div className="welcome-card">
        <h1>Welcome back, {profile?.email.split('@')[0]}</h1>
        <p>{getTaxFramingText()}</p>
        <div className="meta-badges">
          <span className="meta-badge">Entity: {company?.entity_type.replace('_', ' ')}</span>
          <span className="meta-badge">VAT: {company?.vat_registered ? 'Registered' : 'Not Registered'}</span>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <span className="stat-label">Pending Documents</span>
          <span className="stat-value">{stats.pendingDocs}</span>
          <span className="stat-footer">Files uploaded needing data review</span>
        </div>

        <div className="stat-card">
          <span className="stat-label">Draft Transactions</span>
          <span className="stat-value">{stats.draftTx}</span>
          <span className="stat-footer">Lines extracted awaiting confirmation</span>
        </div>

        <div className="stat-card">
          <span className="stat-label">Confirmed Items</span>
          <span className="stat-value">{stats.confirmedTx}</span>
          <span className="stat-footer">Records locked for this period</span>
        </div>

        <div className="stat-card">
          <span className="stat-label">Unmatched Bank Lines</span>
          <span className="stat-value">{stats.unmatchedBankLines}</span>
          <span className="stat-footer">Statement lines with no receipts</span>
        </div>
      </div>

      {/* Main Grid split */}
      <div className="grid-split">
        {/* Recent Uploads */}
        <div className="card">
          <h2>Recent Documents</h2>
          <p className="input-label" style={{ marginTop: '4px' }}>Latest uploads and current review states</p>

          {loadingStats ? (
            <p style={{ marginTop: '20px' }}>Loading documents...</p>
          ) : recentDocs.length === 0 ? (
            <p style={{ marginTop: '20px', color: 'var(--text-muted)' }}>No documents uploaded yet. Click Upload Documents to begin.</p>
          ) : (
            <table className="doc-list-table">
              <thead>
                <tr>
                  <th>Filename</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Uploaded</th>
                </tr>
              </thead>
              <tbody>
                {recentDocs.map((doc) => (
                  <tr key={doc.id}>
                    <td style={{ fontWeight: 600 }}>{doc.filename}</td>
                    <td style={{ textTransform: 'capitalize' }}>{doc.type.replace('_', ' ')}</td>
                    <td>
                      <span className={`badge badge-${doc.status === 'matched' ? 'success' : doc.status === 'reviewed' ? 'info' : 'pending'}`}>
                        {doc.status}
                      </span>
                    </td>
                    <td>{new Date(doc.uploaded_at).toLocaleDateString('en-GB')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Quick Actions */}
        <div className="quick-actions">
          <h2>Quick Actions</h2>
          <p className="input-label" style={{ marginBottom: '8px' }}>Task navigation shortcuts</p>

          <Link href="/dashboard/upload">
            <div className="action-card">
              <div className="action-icon">📤</div>
              <div className="action-info">
                <h3>Upload Invoice or Receipt</h3>
                <p>Add paper receipts or digital PDF bills</p>
              </div>
            </div>
          </Link>

          <Link href="/dashboard/review">
            <div className="action-card">
              <div className="action-icon">📝</div>
              <div className="action-info">
                <h3>Review Transactions</h3>
                <p>Confirm drafts and split expenses</p>
              </div>
            </div>
          </Link>

          <Link href="/dashboard/bank">
            <div className="action-card">
              <div className="action-icon">🏦</div>
              <div className="action-info">
                <h3>Import Bank Statements</h3>
                <p>Match transactions to bank statements</p>
              </div>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
