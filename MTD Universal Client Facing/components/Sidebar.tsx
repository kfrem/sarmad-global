'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

export default function Sidebar() {
  const { company, signOut, profile } = useAuth();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navItems = [
    { name: 'Dashboard', path: '/dashboard', icon: '📊' },
    { name: 'Upload Documents', path: '/dashboard/upload', icon: '📤' },
    { name: 'Review Transactions', path: '/dashboard/review', icon: '📝' },
    { name: 'Bank Statement matching', path: '/dashboard/bank', icon: '🏦' },
    { name: 'Reports', path: '/dashboard/reports', icon: '📈' },
    { name: 'Settings', path: '/dashboard/settings', icon: '⚙️' },
  ];

  const toggleMobile = () => setMobileOpen(!mobileOpen);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        .sidebar {
          background-color: var(--bg-sidebar);
          color: var(--text-sidebar);
          display: flex;
          flex-direction: column;
          padding: 30px 24px;
          height: 100vh;
          position: sticky;
          top: 0;
          border-right: 1px solid rgba(255, 255, 255, 0.05);
          z-index: 100;
          transition: transform var(--transition-normal);
        }
        .logo-section {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 40px;
          padding-bottom: 20px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        }
        .company-logo {
          width: 40px;
          height: 40px;
          border-radius: var(--radius-sm);
          background-color: #ffffff;
          object-fit: contain;
          padding: 4px;
        }
        .company-logo-placeholder {
          width: 40px;
          height: 40px;
          border-radius: var(--radius-sm);
          background-color: var(--primary);
          color: #ffffff;
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: var(--font-display);
          font-weight: 800;
          font-size: 1.2rem;
        }
        .company-name {
          font-family: var(--font-display);
          color: #ffffff;
          font-size: 1.15rem;
          font-weight: 600;
          letter-spacing: -0.01em;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .nav-list {
          list-style: none;
          display: flex;
          flex-direction: column;
          gap: 6px;
          flex: 1;
        }
        .nav-link {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 16px;
          border-radius: var(--radius-md);
          font-weight: 500;
          font-size: 0.95rem;
          transition: background var(--transition-fast), color var(--transition-fast);
        }
        .nav-link:hover {
          background-color: rgba(255, 255, 255, 0.04);
          color: #ffffff;
        }
        .nav-link.active {
          background-color: var(--primary);
          color: #ffffff;
          box-shadow: 0 4px 12px var(--primary-glow);
        }
        .footer-section {
          padding-top: 20px;
          border-top: 1px solid rgba(255, 255, 255, 0.08);
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .user-email {
          font-size: 0.8rem;
          color: var(--text-sidebar);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .btn-logout {
          background: transparent;
          color: #fca5a5;
          border: 1px solid rgba(239, 68, 68, 0.2);
          padding: 10px;
          border-radius: var(--radius-sm);
          font-size: 0.9rem;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.2s, border-color 0.2s;
          text-align: center;
        }
        .btn-logout:hover {
          background: rgba(239, 68, 68, 0.1);
          border-color: #ef4444;
          color: #ffffff;
        }
        .mobile-header {
          display: none;
          background-color: var(--bg-sidebar);
          color: #ffffff;
          padding: 16px 20px;
          align-items: center;
          justify-content: space-between;
          position: sticky;
          top: 0;
          z-index: 101;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        }
        .menu-btn {
          background: transparent;
          border: none;
          color: #ffffff;
          font-size: 1.5rem;
          cursor: pointer;
        }

        @media (max-width: 1024px) {
          .mobile-header {
            display: flex;
          }
          .sidebar {
            position: fixed;
            left: 0;
            top: 60px;
            bottom: 0;
            width: 280px;
            transform: ${mobileOpen ? 'translateX(0)' : 'translateX(-100%)'};
            height: calc(100vh - 60px);
          }
        }
      `}} />

      {/* Mobile Top Header */}
      <div className="mobile-header">
        <div className="company-name">{company?.name || 'Client Portal'}</div>
        <button className="menu-btn" onClick={toggleMobile}>
          {mobileOpen ? '✕' : '☰'}
        </button>
      </div>

      {/* Sidebar Navigation */}
      <aside className="sidebar">
        <div className="logo-section">
          {company?.logo_url ? (
            <img src={company.logo_url} alt="Logo" className="company-logo" />
          ) : (
            <div className="company-logo-placeholder">
              {company?.name ? company.name.charAt(0).toUpperCase() : 'C'}
            </div>
          )}
          <span className="company-name">{company?.name || 'Client Portal'}</span>
        </div>

        <nav className="nav-list">
          {navItems.map((item) => {
            const isActive = pathname === item.path || pathname.startsWith(`${item.path}/`);
            return (
              <li key={item.path}>
                <Link
                  href={item.path}
                  className={`nav-link ${isActive ? 'active' : ''}`}
                  onClick={() => setMobileOpen(false)}
                >
                  <span>{item.icon}</span>
                  <span>{item.name}</span>
                </Link>
              </li>
            );
          })}
        </nav>

        <div className="footer-section">
          <div className="user-email">Logged in as:<br/>{profile?.email}</div>
          <button className="btn-logout" onClick={signOut}>
            🚪 Sign Out
          </button>
        </div>
      </aside>
    </>
  );
}
