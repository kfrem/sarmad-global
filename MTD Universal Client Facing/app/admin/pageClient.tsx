'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

interface Company {
  id: string;
  name: string;
  logo_url: string | null;
  entity_type: string;
  vat_registered: boolean;
  accent_colour: string | null;
  created_at: string;
  modules?: string[];
}

interface User {
  id: string;
  email: string;
  role: string;
  company_id: string | null;
  company_name?: string;
}

interface AuditLog {
  id: string;
  action: string;
  entity: string;
  at: string;
  after: any;
}

export default function AdminPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  
  const [loadingData, setLoadingData] = useState(true);
  const [activeSubTab, setActiveSubTab] = useState<'companies' | 'users' | 'audit'>('companies');

  // Company Form States
  const [companyName, setCompanyName] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [entityType, setEntityType] = useState<'sole_trader' | 'landlord' | 'limited_company' | 'partnership'>('limited_company');
  const [vatRegistered, setVatRegistered] = useState(false);
  const [accentColour, setAccentColour] = useState('#2563EB');
  const [selectedModules, setSelectedModules] = useState<string[]>(['UNI']);

  // User Form States
  const [userEmail, setUserEmail] = useState('');
  const [userPassword, setUserPassword] = useState('');
  const [userCompanyId, setUserCompanyId] = useState('');
  const [userRole, setUserRole] = useState<'client' | 'admin'>('client');

  const loadAdminData = async () => {
    try {
      setLoadingData(true);
      
      // 1. Fetch Companies
      const { data: cos, error: cosErr } = await supabase.from('companies').select('*');
      if (cosErr) throw cosErr;
      const cosList = cos as Company[];

      // Fetch modules for all companies
      const { data: mods } = await supabase.from('company_modules').select('*');
      
      cosList.forEach((c) => {
        c.modules = mods ? mods.filter((m: any) => m.company_id === c.id).map((m: any) => m.module_code) : [];
      });
      setCompanies(cosList);

      // 2. Fetch Profiles/Users
      const { data: profiles, error: profErr } = await supabase.from('users').select('*');
      if (profErr) throw profErr;
      
      const userList = (profiles || []) as User[];
      userList.forEach((u) => {
        const matchingCompany = cosList.find((c) => c.id === u.company_id);
        u.company_name = matchingCompany ? matchingCompany.name : 'Practice Administration';
      });
      setUsers(userList);

      // 3. Fetch Audit Logs
      const { data: logs } = await supabase
        .from('audit_log')
        .select('*')
        .order('at', { ascending: false })
        .limit(10);
      
      if (logs) setAuditLogs(logs as AuditLog[]);

    } catch (err: any) {
      console.error('Error loading admin dashboard data:', err);
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    loadAdminData();
  }, []);

  // Handle Company Submission
  const handleCreateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName) return;

    try {
      // 1. Insert Company
      const { data: newCompany, error: companyErr } = await supabase
        .from('companies')
        .insert({
          name: companyName,
          logo_url: logoUrl || null,
          entity_type: entityType,
          vat_registered: vatRegistered,
          accent_colour: accentColour,
        })
        .select()
        .single();

      if (companyErr || !newCompany) throw companyErr;

      // 2. Insert Active Modules
      const moduleInserts = selectedModules.map((m) => ({
        company_id: newCompany.id,
        module_code: m,
      }));

      const { error: moduleErr } = await supabase
        .from('company_modules')
        .insert(moduleInserts);

      if (moduleErr) throw moduleErr;

      // Reset Form
      setCompanyName('');
      setLogoUrl('');
      setEntityType('limited_company');
      setVatRegistered(false);
      setAccentColour('#2563EB');
      setSelectedModules(['UNI']);
      
      alert('Company created successfully!');
      loadAdminData();

    } catch (err: any) {
      alert(`Error creating company: ${err.message}`);
    }
  };

  // Handle User Submission via backend API route
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userEmail || !userPassword) return;

    try {
      // Get the admin's own JWT token to authorize the request
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (!token) {
        throw new Error('No admin auth token available.');
      }

      const response = await fetch('/api/admin/create-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          email: userEmail,
          password: userPassword,
          companyId: userCompanyId || null,
          role: userRole,
        }),
      });

      if (!response.ok) {
        const errJson = await response.json();
        throw new Error(errJson.error || 'User creation API failed');
      }

      // Reset Form
      setUserEmail('');
      setUserPassword('');
      setUserCompanyId('');
      setUserRole('client');

      alert('User login credentials created successfully!');
      loadAdminData();

    } catch (err: any) {
      alert(`Error creating user login: ${err.message}`);
    }
  };

  const handleModuleToggle = (code: string) => {
    if (code === 'UNI') return; // Always enabled
    if (selectedModules.includes(code)) {
      setSelectedModules(selectedModules.filter((m) => m !== code));
    } else {
      setSelectedModules([...selectedModules, code]);
    }
  };

  return (
    <div className="admin-container animate-fade-in">
      <style dangerouslySetInnerHTML={{ __html: `
        .admin-header {
          margin-bottom: 32px;
        }
        .admin-tabs {
          display: flex;
          gap: 16px;
          border-bottom: 1px solid #e2e8f0;
          margin-bottom: 24px;
        }
        .admin-tab-btn {
          background: transparent;
          border: none;
          padding: 12px 6px;
          font-family: var(--font-display);
          font-size: 1rem;
          font-weight: 600;
          color: #64748b;
          cursor: pointer;
          border-bottom: 2px solid transparent;
          transition: all 0.2s;
        }
        .admin-tab-btn:hover {
          color: #0f172a;
        }
        .admin-tab-btn.active {
          color: #3b82f6;
          border-bottom-color: #3b82f6;
        }
        .admin-panels {
          display: grid;
          grid-template-columns: 2fr 1.2fr;
          gap: 32px;
        }
        @media (max-width: 992px) {
          .admin-panels {
            grid-template-columns: 1fr;
          }
        }
        .list-table {
          width: 100%;
          border-collapse: collapse;
        }
        .list-table th {
          text-align: left;
          padding: 12px;
          font-size: 0.8rem;
          font-weight: 700;
          color: #64748b;
          border-bottom: 2px solid #e2e8f0;
          text-transform: uppercase;
        }
        .list-table td {
          padding: 16px 12px;
          border-bottom: 1px solid #e2e8f0;
          font-size: 0.9rem;
        }
        .checkbox-group {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          margin-top: 8px;
        }
        .checkbox-label {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          border: 1px solid #cbd5e1;
          border-radius: 6px;
          font-size: 0.85rem;
          cursor: pointer;
          user-select: none;
          transition: background 0.2s;
        }
        .checkbox-label.active {
          border-color: #3b82f6;
          background: rgba(59, 130, 246, 0.05);
          color: #2563eb;
        }
        .log-item {
          border-left: 2px solid #e2e8f0;
          padding-left: 16px;
          margin-bottom: 16px;
          position: relative;
        }
        .log-item::before {
          content: '';
          width: 8px;
          height: 8px;
          background: #cbd5e1;
          border-radius: 50%;
          position: absolute;
          left: -5px;
          top: 6px;
        }
      ` }} />

      <div className="admin-header">
        <h1>Practice Administration Panel</h1>
        <p style={{ color: '#64748b', marginTop: '4px' }}>
          Create and configure client portal environments, register logins, and audit logs.
        </p>
      </div>

      <div className="admin-tabs">
        <button className={`admin-tab-btn ${activeSubTab === 'companies' ? 'active' : ''}`} onClick={() => setActiveSubTab('companies')}>
          🏢 Client Companies
        </button>
        <button className={`admin-tab-btn ${activeSubTab === 'users' ? 'active' : ''}`} onClick={() => setActiveSubTab('users')}>
          👥 User Credentials
        </button>
        <button className={`admin-tab-btn ${activeSubTab === 'audit' ? 'active' : ''}`} onClick={() => setActiveSubTab('audit')}>
          🕵️ Compliance Audit Log
        </button>
      </div>

      {loadingData ? (
        <p>Loading administration console...</p>
      ) : (
        <>
          {/* Companies Panel */}
          {activeSubTab === 'companies' && (
            <div className="admin-panels">
              {/* Companies List */}
              <div className="card">
                <h3>Active Client Companies</h3>
                <p className="input-label" style={{ marginBottom: '16px' }}>Manage workspace rules and modules</p>

                {companies.length === 0 ? (
                  <p>No client companies registered yet.</p>
                ) : (
                  <table className="list-table">
                    <thead>
                      <tr>
                        <th>Company Name</th>
                        <th>Tax Framing</th>
                        <th>VAT</th>
                        <th>Branding</th>
                        <th>Active Modules</th>
                      </tr>
                    </thead>
                    <tbody>
                      {companies.map((c) => (
                        <tr key={c.id}>
                          <td><strong>{c.name}</strong></td>
                          <td style={{ textTransform: 'capitalize' }}>{c.entity_type.replace('_', ' ')}</td>
                          <td>
                            <span className={`badge badge-${c.vat_registered ? 'success' : 'pending'}`}>
                              {c.vat_registered ? 'Registered' : 'No VAT'}
                            </span>
                          </td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ display: 'inline-block', width: '14px', height: '14px', borderRadius: '50%', background: c.accent_colour || '#2563EB' }} />
                              <span style={{ fontSize: '0.8rem' }}>{c.accent_colour || 'Default'}</span>
                            </div>
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                              {c.modules?.map((m) => (
                                <span key={m} className="badge badge-info" style={{ fontSize: '0.7rem', padding: '2px 6px' }}>
                                  {m}
                                </span>
                              ))}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Create Company Form */}
              <div className="card" style={{ height: 'fit-content' }}>
                <h3>Provision New Company</h3>
                <p className="input-label" style={{ marginBottom: '16px' }}>Set workspace structure and branding</p>
                
                <form onSubmit={handleCreateCompany}>
                  <div className="input-group">
                    <label className="input-label">Company Legal Name</label>
                    <input
                      type="text"
                      className="input-field"
                      placeholder="e.g. Acme Trading Ltd"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      required
                    />
                  </div>

                  <div className="input-group">
                    <label className="input-label">Logo URL (Optional)</label>
                    <input
                      type="url"
                      className="input-field"
                      placeholder="e.g. https://logo.com/acme.png"
                      value={logoUrl}
                      onChange={(e) => setLogoUrl(e.target.value)}
                    />
                  </div>

                  <div className="input-group">
                    <label className="input-label">Entity Type & Tax Framing</label>
                    <select
                      className="select-field"
                      value={entityType}
                      onChange={(e: any) => setEntityType(e.target.value)}
                      required
                    >
                      <option value="sole_trader">Sole Trader (SA103)</option>
                      <option value="landlord">Property Landlord (SA105)</option>
                      <option value="limited_company">Limited Company (Ordinary Accounts)</option>
                      <option value="partnership">Partnership (Standard Partnership)</option>
                    </select>
                  </div>

                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', margin: '16px 0' }}>
                    <input
                      type="checkbox"
                      id="vatStatus"
                      checked={vatRegistered}
                      onChange={(e) => setVatRegistered(e.target.checked)}
                      style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                    />
                    <label htmlFor="vatStatus" style={{ fontSize: '0.9rem', fontWeight: 600, cursor: 'pointer' }}>
                      Is company registered for UK VAT?
                    </label>
                  </div>

                  <div className="input-group">
                    <label className="input-label">Workspace Accent Color</label>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                      <input
                        type="color"
                        value={accentColour}
                        onChange={(e) => setAccentColour(e.target.value)}
                        style={{ width: '44px', height: '40px', padding: '0', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer' }}
                      />
                      <input
                        type="text"
                        className="input-field"
                        value={accentColour}
                        onChange={(e) => setAccentColour(e.target.value)}
                        style={{ width: '110px' }}
                      />
                    </div>
                  </div>

                  <div className="input-group">
                    <label className="input-label">Active Industry Modules</label>
                    <div className="checkbox-group">
                      {[
                        { code: 'UNI', name: 'UNI (Universal)' },
                        { code: 'CH', name: 'CH (Charities)' },
                        { code: 'CN', name: 'CN (Construction)' },
                        { code: 'HP', name: 'HP (Hospitality)' },
                        { code: 'AG', name: 'AG (Agriculture)' },
                        { code: 'CR', name: 'CR (Care Services)' },
                      ].map((mod) => (
                        <div
                          key={mod.code}
                          className={`checkbox-label ${selectedModules.includes(mod.code) ? 'active' : ''}`}
                          onClick={() => handleModuleToggle(mod.code)}
                        >
                          <input
                            type="checkbox"
                            checked={selectedModules.includes(mod.code)}
                            onChange={() => {}}
                            style={{ display: 'none' }}
                          />
                          <span>{mod.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '16px' }}>
                    🏢 Create Company Workspace
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* Users Panel */}
          {activeSubTab === 'users' && (
            <div className="admin-panels">
              {/* Users List */}
              <div className="card">
                <h3>Practice & Client Portal Logins</h3>
                <p className="input-label" style={{ marginBottom: '16px' }}>Authorised login accounts and workspace mappings</p>

                <table className="list-table">
                  <thead>
                    <tr>
                      <th>Email Address</th>
                      <th>Role</th>
                      <th>Assigned Workspace</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => (
                      <tr key={u.id}>
                        <td><strong>{u.email}</strong></td>
                        <td>
                          <span className={`badge badge-${u.role === 'admin' ? 'danger' : 'info'}`}>
                            {u.role}
                          </span>
                        </td>
                        <td>{u.company_name}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Create User Form */}
              <div className="card" style={{ height: 'fit-content' }}>
                <h3>Provision Portal Credentials</h3>
                <p className="input-label" style={{ marginBottom: '16px' }}>Create credentials for client access</p>

                <form onSubmit={handleCreateUser}>
                  <div className="input-group">
                    <label className="input-label">User Email Address</label>
                    <input
                      type="email"
                      className="input-field"
                      placeholder="e.g. user@company.co.uk"
                      value={userEmail}
                      onChange={(e) => setUserEmail(e.target.value)}
                      required
                    />
                  </div>

                  <div className="input-group">
                    <label className="input-label">Temporary Password</label>
                    <input
                      type="password"
                      className="input-field"
                      placeholder="Minimum 6 characters"
                      value={userPassword}
                      onChange={(e) => setUserPassword(e.target.value)}
                      required
                    />
                  </div>

                  <div className="input-group">
                    <label className="input-label">Assign to Company</label>
                    <select
                      className="select-field"
                      value={userCompanyId}
                      onChange={(e) => setUserCompanyId(e.target.value)}
                    >
                      <option value="">-- Practice Administration (No company) --</option>
                      {companies.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="input-group">
                    <label className="input-label">User Role</label>
                    <select
                      className="select-field"
                      value={userRole}
                      onChange={(e: any) => setUserRole(e.target.value)}
                      required
                    >
                      <option value="client">Client User (Standard)</option>
                      <option value="admin">Practice Administrator (Full control)</option>
                    </select>
                  </div>

                  <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '16px' }}>
                    👥 Create Login Credentials
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* Audit Log Panel */}
          {activeSubTab === 'audit' && (
            <div className="card">
              <h3>System Audit Compliance trail</h3>
              <p className="input-label" style={{ marginBottom: '24px' }}>Practice-wide log of transactions, document uploads, and configuration overrides.</p>

              <div style={{ marginTop: '16px' }}>
                {auditLogs.length === 0 ? (
                  <p>No audit events logged yet.</p>
                ) : (
                  auditLogs.map((log) => (
                    <div key={log.id} className="log-item">
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                        <strong>{log.action.replace(/_/g, ' ').toUpperCase()}</strong>
                        <span style={{ color: '#64748b' }}>{new Date(log.at).toLocaleString('en-GB')}</span>
                      </div>
                      <p style={{ fontSize: '0.9rem', marginTop: '4px' }}>
                        Modified entity: {log.entity}
                      </p>
                      {log.after && (
                        <pre style={{ background: '#f1f5f9', padding: '10px', borderRadius: '6px', fontSize: '0.75rem', marginTop: '8px', overflowX: 'auto', fontFamily: 'Courier New' }}>
                          {JSON.stringify(log.after, null, 2)}
                        </pre>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
