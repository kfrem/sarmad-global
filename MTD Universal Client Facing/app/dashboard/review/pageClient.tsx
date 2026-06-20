'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabaseClient';

interface Account {
  code: number;
  name: string;
  class: number;
  group_code: number;
  nature: string;
  type: string;
  statement: string;
  vat_default: string | null;
  industry_module: string;
}

interface HmrcCategory {
  id: string;
  code: string;
  name: string;
  applies_to_entity_type: string;
  maps_to_account_code: number | null;
}

interface Transaction {
  id: string;
  document_id: string | null;
  date: string;
  description: string;
  gross_amount: number;
  net_amount: number;
  vat_code: string | null;
  vat_amount: number;
  classification: 'income' | 'expense' | 'asset' | 'transfer' | 'personal' | 'none';
  account_code: number | null;
  hmrc_category_id: string | null;
  business_percent: number;
  is_split: boolean;
  parent_transaction_id: string | null;
  status: 'draft' | 'confirmed';
  property_id?: string | null;
  documents?: {
    filename: string;
    storage_path: string;
    type: string;
  } | null;
}

export default function TransactionReviewPage() {
  const { company, modules } = useAuth();
  
  const [txs, setTxs] = useState<Transaction[]>([]);
  const [loadingTxs, setLoadingTxs] = useState(true);
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);
  const [isSimpleMode, setIsSimpleMode] = useState(true);
  
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [hmrcCategories, setHmrcCategories] = useState<HmrcCategory[]>([]);
  
  // Signed URL for document preview
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [loadingUrl, setLoadingUrl] = useState(false);
  
  // Category system toggle: 'coa' (Chart of Accounts) or 'hmrc' (Self-Assessment)
  const [categorySystem, setCategorySystem] = useState<'coa' | 'hmrc'>('coa');
  const [accountSearch, setAccountSearch] = useState('');
  
  // Form States for the selected transaction
  const [grossInput, setGrossInput] = useState<number>(0);
  const [dateInput, setDateInput] = useState('');
  const [descInput, setDescInput] = useState('');
  const [vatIncluded, setVatIncluded] = useState(false);
  const [vatRate, setVatRate] = useState('S20');
  const [classification, setClassification] = useState<Transaction['classification']>('expense');
  const [selectedAccountCode, setSelectedAccountCode] = useState<number | null>(null);
  const [selectedHmrcId, setSelectedHmrcId] = useState<string | null>(null);
  const [propertyId, setPropertyId] = useState('');
  
  // Split State
  const [splitType, setSplitType] = useState<'wholly_business' | 'wholly_private' | 'part_private'>('wholly_business');
  const [businessPercent, setBusinessPercent] = useState<number>(100);
  const [businessAmount, setBusinessAmount] = useState<number>(0);

  const activeModules = React.useMemo(() => {
    const list = [...modules];
    if (!list.includes('UNI')) list.push('UNI');
    return list;
  }, [modules]);

  // Load Initial Reference Data (Accounts & HMRC Categories)
  const loadReferenceData = async () => {
    try {
      // 1. Fetch Accounts
      const { data: accs } = await supabase
        .from('accounts')
        .select('*')
        .eq('type', 'Posting')
        .eq('is_active', true)
        .in('industry_module', activeModules);
      
      if (accs) {
        setAccounts(accs as Account[]);
      }

      // 2. Fetch HMRC Categories
      if (company) {
        const { data: cats } = await supabase
          .from('hmrc_categories')
          .select('*')
          .eq('applies_to_entity_type', company.entity_type);
        
        if (cats) {
          setHmrcCategories(cats as HmrcCategory[]);
        }
      }
    } catch (err) {
      console.error('Error loading reference data:', err);
    }
  };

  // Load Draft Transactions
  const loadTransactions = async () => {
    try {
      setLoadingTxs(true);
      const { data, error } = await supabase
        .from('transactions')
        .select('*, documents(filename, storage_path, type)')
        .eq('status', 'draft')
        .order('date', { ascending: true });

      if (error) throw error;

      const transactionsList = (data || []) as Transaction[];
      setTxs(transactionsList);

      if (transactionsList.length > 0) {
        setSelectedIndex(0);
      } else {
        setSelectedIndex(-1);
      }
    } catch (err) {
      console.error('Error loading transactions:', err);
    } finally {
      setLoadingTxs(false);
    }
  };

  useEffect(() => {
    loadReferenceData();
    loadTransactions();
  }, [company, modules]);

  // Handle selected transaction change
  const currentTx = selectedIndex >= 0 ? txs[selectedIndex] : null;

  useEffect(() => {
    if (currentTx) {
      setIsSimpleMode(true);
      // Reset form states
      setGrossInput(currentTx.gross_amount);
      setDateInput(currentTx.date);
      setDescInput(currentTx.description);
      setClassification(currentTx.classification);
      setSelectedAccountCode(currentTx.account_code);
      setSelectedHmrcId(currentTx.hmrc_category_id);
      setPropertyId(currentTx.property_id || '');
      
      // VAT defaults
      if (currentTx.vat_amount > 0) {
        setVatIncluded(true);
        setVatRate(currentTx.vat_code || 'S20');
      } else {
        setVatIncluded(false);
        setVatRate(currentTx.vat_code || 'OS');
      }

      // Split defaults
      if (currentTx.business_percent === 100) {
        setSplitType('wholly_business');
        setBusinessPercent(100);
        setBusinessAmount(currentTx.gross_amount);
      } else if (currentTx.business_percent === 0) {
        setSplitType('wholly_private');
        setBusinessPercent(0);
        setBusinessAmount(0);
      } else {
        setSplitType('part_private');
        setBusinessPercent(currentTx.business_percent);
        setBusinessAmount(Number(((currentTx.gross_amount * currentTx.business_percent) / 100).toFixed(2)));
      }

      // Fetch signed URL for document
      if (currentTx.documents?.storage_path) {
        loadDocumentUrl(currentTx.documents.storage_path);
      } else {
        setSignedUrl(null);
      }
    } else {
      setSignedUrl(null);
    }
  }, [selectedIndex, txs]);

  const loadDocumentUrl = async (path: string) => {
    try {
      setLoadingUrl(true);
      const { data, error } = await supabase.storage
        .from('documents')
        .createSignedUrl(path, 1800); // 30 minutes access

      if (error) throw error;
      setSignedUrl(data.signedUrl);
    } catch (err) {
      console.error('Error generating signed URL:', err);
      setSignedUrl(null);
    } finally {
      setLoadingUrl(false);
    }
  };

  // Category mapping: synchronise CoA and HMRC selections
  const handleAccountChange = (code: number) => {
    setSelectedAccountCode(code);
    
    // Find if this account maps to an HMRC Category
    const matchingHmrc = hmrcCategories.find((cat) => cat.maps_to_account_code === code);
    if (matchingHmrc) {
      setSelectedHmrcId(matchingHmrc.id);
    }

    // Default VAT rate from account if available
    const account = accounts.find((acc) => acc.code === code);
    if (account?.vat_default) {
      setVatRate(account.vat_default);
    }
  };

  const handleHmrcChange = (id: string) => {
    setSelectedHmrcId(id);

    // Find if this HMRC category maps to a Chart of Accounts code
    const category = hmrcCategories.find((cat) => cat.id === id);
    if (category?.maps_to_account_code) {
      setSelectedAccountCode(category.maps_to_account_code);
      
      const account = accounts.find((acc) => acc.code === category.maps_to_account_code);
      if (account?.vat_default) {
        setVatRate(account.vat_default);
      }
    }
  };

  // Recalculate split values
  const handlePercentChange = (val: number) => {
    const pct = Math.max(0, Math.min(100, val));
    setBusinessPercent(pct);
    setBusinessAmount(Number(((grossInput * pct) / 100).toFixed(2)));
  };

  const handleAmountChange = (val: number) => {
    const amt = Math.max(0, Math.min(grossInput, val));
    setBusinessAmount(amt);
    setBusinessPercent(grossInput > 0 ? Number(((amt / grossInput) * 100).toFixed(1)) : 100);
  };

  // Confirmation Flow (Steps 1 to 6)
  const handleConfirm = async () => {
    if (!currentTx || !company) return;

    try {
      // Calculate VAT rates on the final gross
      let finalBusinessGross = grossInput;
      let finalPrivateGross = 0;

      if (splitType === 'wholly_private') {
        finalBusinessGross = 0;
        finalPrivateGross = grossInput;
      } else if (splitType === 'part_private') {
        finalBusinessGross = businessAmount;
        finalPrivateGross = grossInput - businessAmount;
      }

      // Calculate VAT and Net on the Business Portion
      let finalVatAmount = 0;
      let finalNetAmount = finalBusinessGross;
      let finalVatCode = vatIncluded ? vatRate : 'OS';

      if (company.vat_registered && vatIncluded) {
        let rate = 0;
        if (vatRate === 'S20') rate = 0.20;
        else if (vatRate === 'R5') rate = 0.05;

        finalNetAmount = finalBusinessGross / (1 + rate);
        finalVatAmount = finalBusinessGross - finalNetAmount;
      }

      // 1. Update the Main Transaction (Business Portion)
      const mainUpdate = {
        date: dateInput,
        description: descInput,
        gross_amount: Number(finalBusinessGross.toFixed(2)),
        net_amount: Number(finalNetAmount.toFixed(2)),
        vat_code: company.vat_registered ? finalVatCode : undefined,
        vat_amount: Number(finalVatAmount.toFixed(2)),
        classification: splitType === 'wholly_private' ? 'personal' : classification,
        account_code: splitType === 'wholly_private' ? null : selectedAccountCode,
        hmrc_category_id: splitType === 'wholly_private' ? null : selectedHmrcId,
        business_percent: splitType === 'wholly_business' ? 100 : splitType === 'wholly_private' ? 0 : businessPercent,
        is_split: splitType === 'part_private',
        status: 'confirmed',
        confirmed_at: new Date().toISOString(),
        property_id: company.entity_type === 'landlord' ? propertyId : null,
      };

      const { error: updateError } = await supabase
        .from('transactions')
        .update(mainUpdate)
        .eq('id', currentTx.id);

      if (updateError) throw updateError;

      // 2. If Part Private, insert the Linked Private Portion
      if (splitType === 'part_private' && finalPrivateGross > 0) {
        const privateTx = {
          company_id: company.id,
          document_id: currentTx.document_id,
          date: dateInput,
          description: `[Private Portion] ${descInput}`,
          gross_amount: Number(finalPrivateGross.toFixed(2)),
          net_amount: Number(finalPrivateGross.toFixed(2)),
          vat_code: 'OS',
          vat_amount: 0,
          classification: 'personal',
          account_code: null,
          hmrc_category_id: null,
          business_percent: 0.00,
          is_split: true,
          parent_transaction_id: currentTx.id,
          status: 'confirmed',
          confirmed_at: new Date().toISOString(),
        };

        const { error: privateError } = await supabase
          .from('transactions')
          .insert(privateTx);

        if (privateError) console.error('Error inserting private split portion:', privateError);
      }

      // Write Audit Log
      await supabase.from('audit_log').insert({
        company_id: company.id,
        action: 'confirm_transaction',
        entity: 'transaction',
        before: currentTx,
        after: { id: currentTx.id, ...mainUpdate },
      });

      // Remove confirmed transaction from local list and move to next
      const nextTxs = txs.filter((_, idx) => idx !== selectedIndex);
      setTxs(nextTxs);

      if (nextTxs.length > 0) {
        setSelectedIndex(Math.min(selectedIndex, nextTxs.length - 1));
      } else {
        setSelectedIndex(-1);
      }

    } catch (err: any) {
      alert(`Error confirming transaction: ${err.message || 'Unknown error'}`);
    }
  };

  const filteredAccounts = accounts.filter(
    (acc) =>
      acc.name.toLowerCase().includes(accountSearch.toLowerCase()) ||
      acc.code.toString().includes(accountSearch)
  );

  return (
    <div className="review-container animate-fade-in">
      <style dangerouslySetInnerHTML={{ __html: `
        .review-layout {
          display: grid;
          grid-template-columns: 320px 1fr;
          gap: 32px;
          margin-top: 24px;
        }
        @media (max-width: 1200px) {
          .review-layout {
            grid-template-columns: 1fr;
          }
        }
        .tx-list-card {
          background: #ffffff;
          border: 1px solid var(--border-light);
          border-radius: var(--radius-lg);
          padding: 20px;
          height: fit-content;
        }
        .tx-list {
          list-style: none;
          display: flex;
          flex-direction: column;
          gap: 10px;
          margin-top: 16px;
          max-height: 500px;
          overflow-y: auto;
        }
        .tx-item {
          padding: 12px 16px;
          border-radius: var(--radius-md);
          border: 1px solid var(--border-light);
          cursor: pointer;
          transition: background 0.2s, border-color 0.2s;
        }
        .tx-item:hover {
          background-color: var(--bg-app);
        }
        .tx-item.active {
          border-color: var(--primary);
          background-color: var(--primary-glow);
        }
        .tx-item h4 {
          font-size: 0.9rem;
          margin-bottom: 4px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .tx-item p {
          font-size: 0.8rem;
          color: var(--text-muted);
        }
        .workspace-panel {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 24px;
        }
        @media (max-width: 800px) {
          .workspace-panel {
            grid-template-columns: 1fr;
          }
        }
        .doc-preview-card {
          background: #0f172a;
          border-radius: var(--radius-lg);
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 400px;
          color: #ffffff;
          padding: 20px;
          position: sticky;
          top: 40px;
        }
        .preview-img {
          max-width: 100%;
          max-height: 550px;
          object-fit: contain;
          border-radius: var(--radius-sm);
        }
        .preview-iframe {
          width: 100%;
          height: 550px;
          border: none;
          background: #ffffff;
        }
        .form-section-title {
          font-size: 0.825rem;
          font-weight: 800;
          color: var(--primary);
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin-bottom: 12px;
          margin-top: 24px;
          border-bottom: 1px solid var(--border-light);
          padding-bottom: 6px;
        }
        .form-section-title:first-of-type {
          margin-top: 0;
        }
        .toggle-container {
          display: flex;
          background: var(--bg-app);
          border-radius: var(--radius-md);
          padding: 4px;
          margin-bottom: 16px;
        }
        .toggle-btn {
          flex: 1;
          background: transparent;
          border: none;
          padding: 8px;
          font-size: 0.85rem;
          font-weight: 600;
          cursor: pointer;
          border-radius: var(--radius-sm);
          transition: background 0.2s;
        }
        .toggle-btn.active {
          background: #ffffff;
          color: var(--primary);
          box-shadow: var(--shadow-sm);
        }
        .coa-list {
          max-height: 180px;
          overflow-y: auto;
          border: 1px solid var(--border-light);
          border-radius: var(--radius-md);
          padding: 6px;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .coa-item {
          padding: 8px 12px;
          border-radius: var(--radius-sm);
          font-size: 0.85rem;
          cursor: pointer;
          display: flex;
          justify-content: space-between;
        }
        .coa-item:hover {
          background: var(--bg-app);
        }
        .coa-item.active {
          background: var(--primary-glow);
          color: var(--primary);
          font-weight: 600;
        }
        .split-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
          margin-top: 12px;
        }
        .simple-summary-card {
          background: #f8fafc;
          border: 1px solid var(--border-light);
          border-radius: var(--radius-lg);
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .summary-field {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .summary-label {
          font-size: 0.725rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--text-muted);
          font-weight: 700;
        }
        .summary-value-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .summary-value {
          font-size: 0.95rem;
          font-weight: 500;
          color: var(--text-main);
        }
        .summary-edit-btn {
          background: transparent;
          border: none;
          color: var(--primary);
          font-size: 0.8rem;
          font-weight: 600;
          cursor: pointer;
          padding: 2px 6px;
          border-radius: 4px;
          transition: background 0.2s;
        }
        .summary-edit-btn:hover {
          background: rgba(var(--company-accent-rgb), 0.05);
        }
      ` }} />

      <h1>Review Transactions</h1>
      <p className="input-label" style={{ marginTop: '4px' }}>
        Confirm data, categorize, split private portions, and lock transactions.
      </p>

      {loadingTxs ? (
        <p style={{ marginTop: '20px' }}>Loading transactions for review...</p>
      ) : txs.length === 0 ? (
        <div className="card" style={{ marginTop: '24px', textAlign: 'center', padding: '60px' }}>
          <span style={{ fontSize: '3rem' }}>🎉</span>
          <h2 style={{ marginTop: '16px' }}>All caught up!</h2>
          <p style={{ color: 'var(--text-muted)', marginTop: '8px' }}>
            No draft transactions are awaiting review. Upload more documents or check reports.
          </p>
        </div>
      ) : (
        <div className="review-layout">
          {/* Sidebar list of drafts */}
          <div className="tx-list-card">
            <h3>Draft Queue</h3>
            <p className="input-label">{txs.length} item(s) to confirm</p>
            <ul className="tx-list">
              {txs.map((tx, idx) => (
                <li
                  key={tx.id}
                  className={`tx-item ${idx === selectedIndex ? 'active' : ''}`}
                  onClick={() => setSelectedIndex(idx)}
                >
                  <h4>{tx.description}</h4>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px' }}>
                    <p>{new Date(tx.date).toLocaleDateString('en-GB')}</p>
                    <strong style={{ fontSize: '0.85rem' }}>£{tx.gross_amount.toFixed(2)}</strong>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {/* Active Workspace */}
          {currentTx && (
            <div className="workspace-panel">
              {/* Document Preview */}
              <div className="doc-preview-card">
                {loadingUrl ? (
                  <p>Loading document preview...</p>
                ) : signedUrl ? (
                  currentTx.documents?.storage_path.endsWith('.pdf') ? (
                    <iframe src={`${signedUrl}#toolbar=0`} className="preview-iframe" title="PDF Viewer" />
                  ) : (
                    <img src={signedUrl} alt="Receipt Preview" className="preview-img" />
                  )
                ) : (
                  <div style={{ textAlign: 'center' }}>
                    <span style={{ fontSize: '2.5rem' }}>📄</span>
                    <p style={{ marginTop: '12px', color: '#94a3b8' }}>
                      No preview available for this document.<br/>
                      {currentTx.documents?.filename || 'Manual Record'}
                    </p>
                  </div>
                )}
              </div>
              {/* Review Form */}
              {isSimpleMode ? (
                <div className="card animate-fade-in">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <h3 style={{ margin: 0 }}>Review Transaction</h3>
                    <button
                      type="button"
                      className="toggle-btn"
                      style={{ padding: '6px 12px', fontSize: '0.8rem', border: '1px solid var(--border-light)', width: 'auto', borderRadius: 'var(--radius-md)' }}
                      onClick={() => setIsSimpleMode(false)}
                    >
                      ⚙️ Detailed Mode
                    </button>
                  </div>

                  <div className="simple-summary-card">
                    <div className="summary-field">
                      <span className="summary-label">Supplier / Description</span>
                      <div className="summary-value-row">
                        <span className="summary-value" style={{ fontWeight: 600 }}>{descInput || 'No description'}</span>
                        <button className="summary-edit-btn" onClick={() => setIsSimpleMode(false)}>Change</button>
                      </div>
                    </div>

                    <div className="summary-field" style={{ borderTop: '1px solid var(--border-light)', paddingTop: '12px' }}>
                      <span className="summary-label">Transaction Date</span>
                      <div className="summary-value-row">
                        <span className="summary-value">
                          {dateInput ? new Date(dateInput).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : 'No date'}
                        </span>
                        <button className="summary-edit-btn" onClick={() => setIsSimpleMode(false)}>Change</button>
                      </div>
                    </div>

                    <div className="summary-field" style={{ borderTop: '1px solid var(--border-light)', paddingTop: '12px' }}>
                      <span className="summary-label">Total Amount</span>
                      <div className="summary-value-row">
                        <span className="summary-value" style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--text-main)' }}>
                          £{grossInput.toFixed(2)}
                        </span>
                        <button className="summary-edit-btn" onClick={() => setIsSimpleMode(false)}>Change</button>
                      </div>
                    </div>

                    <div className="summary-field" style={{ borderTop: '1px solid var(--border-light)', paddingTop: '12px' }}>
                      <span className="summary-label">Bookkeeping Category</span>
                      <div className="summary-value-row">
                        <span className="summary-value" style={{ fontWeight: 600, color: 'var(--primary)' }}>
                          {accounts.find(a => a.code === selectedAccountCode)?.name || 'Unassigned / General'}
                        </span>
                        <button className="summary-edit-btn" onClick={() => setIsSimpleMode(false)}>Change</button>
                      </div>
                    </div>
                  </div>

                  <div style={{ marginTop: '28px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <button
                      type="button"
                      className="btn btn-primary"
                      style={{ width: '100%', padding: '16px', fontSize: '1.05rem', fontWeight: 700 }}
                      onClick={handleConfirm}
                    >
                      ✓ Yes, this is correct (Confirm)
                    </button>
                    
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{ width: '100%', padding: '12px', background: 'transparent', border: '1px solid var(--border-light)' }}
                      onClick={() => setIsSimpleMode(false)}
                    >
                      ✏️ No, change details / split expense
                    </button>
                  </div>
                </div>
              ) : (
                <div className="card animate-fade-in">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <h3 style={{ margin: 0 }}>Detailed Verification</h3>
                    <button
                      type="button"
                      className="toggle-btn active"
                      style={{ padding: '6px 12px', fontSize: '0.8rem', border: '1px solid var(--border-light)', width: 'auto', borderRadius: 'var(--radius-md)', background: '#ffffff', color: 'var(--primary)' }}
                      onClick={() => setIsSimpleMode(true)}
                    >
                      👁️ Simple Mode
                    </button>
                  </div>

                  {/* Step 1: Date, Description, Amount */}
                  <div className="form-section-title">1. Basic Details</div>
                  <div className="split-row">
                    <div className="input-group" style={{ marginBottom: '12px' }}>
                      <label className="input-label">Transaction Date</label>
                      <input
                        type="date"
                        className="input-field"
                        value={dateInput}
                        onChange={(e) => setDateInput(e.target.value)}
                      />
                    </div>

                    <div className="input-group" style={{ marginBottom: '12px' }}>
                      <label className="input-label">Gross Amount (GBP)</label>
                      <input
                        type="number"
                        step="0.01"
                        className="input-field"
                        value={grossInput}
                        onChange={(e) => setGrossInput(Number(e.target.value))}
                      />
                    </div>
                  </div>

                  <div className="input-group" style={{ marginBottom: '16px' }}>
                    <label className="input-label">Description / Supplier</label>
                    <input
                      type="text"
                      className="input-field"
                      value={descInput}
                      onChange={(e) => setDescInput(e.target.value)}
                    />
                  </div>

                  {/* Step 2: VAT Registered */}
                  {company?.vat_registered && (
                    <>
                      <div className="form-section-title">2. VAT Details</div>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '12px' }}>
                        <input
                          type="checkbox"
                          id="vatIncluded"
                          checked={vatIncluded}
                          onChange={(e) => setVatIncluded(e.target.checked)}
                          style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                        />
                        <label htmlFor="vatIncluded" style={{ fontSize: '0.9rem', fontWeight: 600, cursor: 'pointer' }}>
                          Is UK VAT included in this amount?
                        </label>
                      </div>

                      {vatIncluded && (
                        <div className="input-group">
                          <label className="input-label">VAT Rate Code</label>
                          <select
                            className="select-field"
                            value={vatRate}
                            onChange={(e) => setVatRate(e.target.value)}
                          >
                            <option value="S20">Standard 20% (S20)</option>
                            <option value="R5">Reduced 5% (R5)</option>
                            <option value="Z">Zero Rated 0% (Z)</option>
                            <option value="E">Exempt (E)</option>
                            <option value="OS">Outside Scope (OS)</option>
                          </select>
                        </div>
                      )}
                    </>
                  )}

                  {/* Step 3: Classification */}
                  <div className="form-section-title">3. Account Classification</div>
                  <div className="input-group">
                    <label className="input-label">Select Classification Type</label>
                    <select
                      className="select-field"
                      value={classification}
                      onChange={(e: any) => setClassification(e.target.value)}
                    >
                      <option value="expense">Business Expense</option>
                      <option value="income">Business Income</option>
                      <option value="asset">Asset purchase</option>
                      <option value="transfer">Transfer between bank accounts</option>
                      <option value="personal">Personal / Drawings (Wholly Private)</option>
                      <option value="none">None / Ignore this item</option>
                    </select>
                  </div>

                  {/* Landlord Property Tagging */}
                  {company?.entity_type === 'landlord' && (classification === 'expense' || classification === 'income') && (
                    <div className="input-group" style={{ marginTop: '12px' }}>
                      <label className="input-label">Associate to Property</label>
                      <input
                        type="text"
                        className="input-field"
                        placeholder="e.g. 12 High Street Flat A"
                        value={propertyId}
                        onChange={(e) => setPropertyId(e.target.value)}
                      />
                    </div>
                  )}

                  {/* Step 4: Category System Selection */}
                  {(classification === 'expense' || classification === 'income' || classification === 'asset') && (
                    <>
                      <div className="form-section-title">4. Category / Bookkeeping Account</div>
                      
                      <div className="toggle-container">
                        <button
                          type="button"
                          className={`toggle-btn ${categorySystem === 'coa' ? 'active' : ''}`}
                          onClick={() => setCategorySystem('coa')}
                        >
                          Chart of Accounts
                        </button>
                        <button
                          type="button"
                          className={`toggle-btn ${categorySystem === 'hmrc' ? 'active' : ''}`}
                          onClick={() => setCategorySystem('hmrc')}
                        >
                          HMRC Tax Categories
                        </button>
                      </div>

                      {categorySystem === 'coa' ? (
                        <div>
                          <input
                            type="text"
                            className="input-field"
                            placeholder="Search accounts by name or code..."
                            style={{ marginBottom: '10px' }}
                            value={accountSearch}
                            onChange={(e) => setAccountSearch(e.target.value)}
                          />
                          <div className="coa-list">
                            {filteredAccounts.map((acc) => (
                              <div
                                key={acc.code}
                                className={`coa-item ${selectedAccountCode === acc.code ? 'active' : ''}`}
                                onClick={() => handleAccountChange(acc.code)}
                              >
                                <span>{acc.name}</span>
                                <span style={{ opacity: 0.6 }}>{acc.code}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="input-group">
                          <label className="input-label">Select HMRC Tax Heading</label>
                          <select
                            className="select-field"
                            value={selectedHmrcId || ''}
                            onChange={(e) => handleHmrcChange(e.target.value)}
                          >
                            <option value="">-- Select category --</option>
                            {hmrcCategories.map((cat) => (
                              <option key={cat.id} value={cat.id}>
                                {cat.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </>
                  )}

                  {/* Step 5: Business vs Private Split */}
                  <div className="form-section-title">5. Business or Private Portion</div>
                  <div className="input-group">
                    <label className="input-label">Expense Allocation</label>
                    <select
                      className="select-field"
                      value={splitType}
                      onChange={(e: any) => {
                        const val = e.target.value;
                        setSplitType(val);
                        if (val === 'wholly_business') {
                          setBusinessPercent(100);
                          setBusinessAmount(grossInput);
                        } else if (val === 'wholly_private') {
                          setBusinessPercent(0);
                          setBusinessAmount(0);
                        } else {
                          setBusinessPercent(50);
                          setBusinessAmount(Number((grossInput * 0.5).toFixed(2)));
                        }
                      }}
                    >
                      <option value="wholly_business">Wholly Business (100%)</option>
                      <option value="wholly_private">Wholly Private (0% - drawings)</option>
                      <option value="part_private">Part Private Split (split percentage)</option>
                    </select>
                  </div>

                  {splitType === 'part_private' && (
                    <div className="split-row" style={{ marginTop: '0' }}>
                      <div className="input-group">
                        <label className="input-label">Business Portion (%)</label>
                        <input
                          type="number"
                          className="input-field"
                          value={businessPercent}
                          onChange={(e) => handlePercentChange(Number(e.target.value))}
                        />
                      </div>
                      <div className="input-group">
                        <label className="input-label">Business Amount (GBP)</label>
                        <input
                          type="number"
                          step="0.01"
                          className="input-field"
                          value={businessAmount}
                          onChange={(e) => handleAmountChange(Number(e.target.value))}
                        />
                      </div>
                    </div>
                  )}

                  {/* Step 6: Confirmation button */}
                  <div className="form-section-title">6. Save Record</div>
                  <button
                    type="button"
                    className="btn btn-primary"
                    style={{ width: '100%', padding: '14px', marginTop: '8px' }}
                    onClick={handleConfirm}
                  >
                    🔒 Confirm & Lock Transaction
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
