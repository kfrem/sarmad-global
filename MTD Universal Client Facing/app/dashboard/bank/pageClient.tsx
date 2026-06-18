'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabaseClient';

interface BankLine {
  id: string;
  date: string;
  description: string;
  money_in: number;
  money_out: number;
  balance: number | null;
  status: 'matched' | 'unmatched';
  matched_transaction_id: string | null;
  receipt_document_id: string | null;
  receipt?: {
    filename: string;
    uploaded_at: string;
  } | null;
}

interface OrphanReceipt {
  id: string;
  filename: string;
  type: string;
  period: string;
  uploaded_at: string;
  // We'll calculate if it is an orphan receipt (not linked to any bank line)
}

export default function BankReconciliationPage() {
  const { company } = useAuth();
  
  const [bankLines, setBankLines] = useState<BankLine[]>([]);
  const [loadingLines, setLoadingLines] = useState(true);
  const [selectedLineId, setSelectedLineId] = useState<string | null>(null);
  
  // CSV Import States
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvRows, setCsvRows] = useState<string[][]>([]);
  const [importing, setImporting] = useState(false);
  
  // CSV Mappings
  const [dateCol, setDateCol] = useState<string>('');
  const [descCol, setDescCol] = useState<string>('');
  const [moneyOutCol, setMoneyOutCol] = useState<string>('');
  const [moneyInCol, setMoneyInCol] = useState<string>('');
  const [balanceCol, setBalanceCol] = useState<string>('');
  
  // Tab states: 'reconcile' | 'import' | 'exceptions'
  const [activeTab, setActiveTab] = useState<'reconcile' | 'import' | 'exceptions'>('reconcile');
  
  // Matching receipts searching
  const [receiptSearch, setReceiptSearch] = useState('');
  const [availableReceipts, setAvailableReceipts] = useState<OrphanReceipt[]>([]);
  const [suggestedReceipts, setSuggestedReceipts] = useState<OrphanReceipt[]>([]);
  
  // Manual Line Form
  const [manualDate, setManualDate] = useState('');
  const [manualDesc, setManualDesc] = useState('');
  const [manualIn, setManualIn] = useState(0);
  const [manualOut, setManualOut] = useState(0);
  const [manualBalance, setManualBalance] = useState('');

  // Fetch Bank Lines
  const loadBankLines = async () => {
    if (!company) return;
    try {
      setLoadingLines(true);
      
      // Fetch bank lines and join document details if receipt linked
      const { data, error } = await supabase
        .from('bank_lines')
        .select('*')
        .order('date', { ascending: false });

      if (error) throw error;
      
      // We will manually fetch document details for receipts
      const linesList = data as BankLine[];
      
      // Fetch details of linked receipts
      const receiptIds = linesList.map((line) => line.receipt_document_id).filter(Boolean) as string[];
      if (receiptIds.length > 0) {
        const { data: docs } = await supabase
          .from('documents')
          .select('id, filename, uploaded_at')
          .in('id', receiptIds);
        
        if (docs) {
          linesList.forEach((line) => {
            if (line.receipt_document_id) {
              const matchedDoc = docs.find((d: any) => d.id === line.receipt_document_id);
              if (matchedDoc) {
                line.receipt = {
                  filename: matchedDoc.filename,
                  uploaded_at: matchedDoc.uploaded_at,
                };
              }
            }
          });
        }
      }

      setBankLines(linesList);
      if (linesList.length > 0 && !selectedLineId) {
        setSelectedLineId(linesList[0].id);
      }
    } catch (err) {
      console.error('Error loading bank lines:', err);
    } finally {
      setLoadingLines(false);
    }
  };

  // Fetch Orphan Receipts
  const loadOrphanReceipts = async () => {
    if (!company) return;
    try {
      // 1. Fetch all documents of type receipt or invoice
      const { data: docs } = await supabase
        .from('documents')
        .select('id, filename, type, period, uploaded_at')
        .in('type', ['receipt', 'invoice'])
        .eq('archived', false);
      
      if (!docs) return;

      // 2. Fetch all receipt_document_ids linked to bank_lines
      const { data: linkedLines } = await supabase
        .from('bank_lines')
        .select('receipt_document_id')
        .is('receipt_document_id', 'not.null');
      
      const linkedIds = linkedLines ? linkedLines.map((l: any) => l.receipt_document_id) : [];
      
      // Filter out linked IDs to get orphans
      const orphans = (docs as OrphanReceipt[]).filter((d) => !linkedIds.includes(d.id));
      setAvailableReceipts(orphans);
    } catch (err) {
      console.error('Error loading orphan receipts:', err);
    }
  };

  useEffect(() => {
    loadBankLines();
    loadOrphanReceipts();
  }, [company]);

  // Load Suggestions for the selected line
  const selectedLine = bankLines.find((l) => l.id === selectedLineId);

  useEffect(() => {
    if (selectedLine && availableReceipts.length > 0) {
      // Smart matching suggestions: matches exact amount or near amount (+/- 10%)
      const amountToMatch = selectedLine.money_out > 0 ? selectedLine.money_out : selectedLine.money_in;
      
      // Let's search transactions or documents to match amount
      // We'll search orphan receipts
      // For receipts, we can check if there are transactions associated with it that match the amount
      const loadSuggestions = async () => {
        // Query transactions matching amount
        const { data: matchingTxs } = await supabase
          .from('transactions')
          .select('document_id, gross_amount')
          .eq('gross_amount', amountToMatch);
        
        const docIds = matchingTxs ? matchingTxs.map((t: any) => t.document_id).filter(Boolean) : [];
        
        const suggestions = availableReceipts.filter((rec) => {
          // Suggest if the receipt has a transaction matching the amount,
          // or if the filename/date might align
          const isDocIdMatch = docIds.includes(rec.id);
          const isDateNear = Math.abs(new Date(rec.uploaded_at).getTime() - new Date(selectedLine.date).getTime()) < 15 * 24 * 60 * 60 * 1000; // 15 days
          return isDocIdMatch || isDateNear;
        });

        setSuggestedReceipts(suggestions);
      };
      
      loadSuggestions();
    } else {
      setSuggestedReceipts([]);
    }
  }, [selectedLineId, availableReceipts]);

  // CSV Parsing
  const handleCsvChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setCsvFile(file);
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
        if (lines.length > 0) {
          // Parse CSV rows simple split
          const rows = lines.map((line) => {
            // Match commas but respect quotes
            const matches = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || line.split(',');
            return matches.map((m) => m.replace(/^"|"$/g, '').trim());
          });
          
          setCsvHeaders(rows[0]);
          setCsvRows(rows.slice(1));
          
          // Auto-guess columns
          rows[0].forEach((header) => {
            const h = header.toLowerCase();
            if (h.includes('date')) setDateCol(header);
            else if (h.includes('desc') || h.includes('detail') || h.includes('narrative')) setDescCol(header);
            else if (h.includes('out') || h.includes('debit') || h.includes('paid out')) setMoneyOutCol(header);
            else if (h.includes('in') || h.includes('credit') || h.includes('paid in')) setMoneyInCol(header);
            else if (h.includes('balance')) setBalanceCol(header);
          });
        }
      };
      reader.readAsText(file);
    }
  };

  const handleImportCsv = async () => {
    if (!company || csvRows.length === 0 || !dateCol || !descCol) {
      alert('Please select date and description columns.');
      return;
    }

    setImporting(true);
    try {
      const dateIdx = csvHeaders.indexOf(dateCol);
      const descIdx = csvHeaders.indexOf(descCol);
      const outIdx = csvHeaders.indexOf(moneyOutCol);
      const inIdx = csvHeaders.indexOf(moneyInCol);
      const balIdx = csvHeaders.indexOf(balanceCol);

      const importedLines = [];

      for (const row of csvRows) {
        if (!row[dateIdx] || !row[descIdx]) continue;

        // Parse date. UK format standard DD/MM/YYYY
        let dateStr = row[dateIdx];
        if (dateStr.includes('/')) {
          const parts = dateStr.split('/');
          if (parts[2].length === 4) {
            // DD/MM/YYYY -> YYYY-MM-DD
            dateStr = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
          }
        }

        const desc = row[descIdx];
        const outAmt = outIdx >= 0 ? Math.abs(parseFloat(row[outIdx].replace(/[^0-9.-]/g, ''))) || 0 : 0;
        const inAmt = inIdx >= 0 ? parseFloat(row[inIdx].replace(/[^0-9.-]/g, '')) || 0 : 0;
        const balance = balIdx >= 0 ? parseFloat(row[balIdx].replace(/[^0-9.-]/g, '')) || null : null;

        importedLines.push({
          company_id: company.id,
          date: dateStr,
          description: desc,
          money_in: Number(inAmt.toFixed(2)),
          money_out: Number(outAmt.toFixed(2)),
          balance: balance ? Number(balance.toFixed(2)) : null,
          status: 'unmatched',
        });
      }

      const { error } = await supabase.from('bank_lines').insert(importedLines);
      if (error) throw error;

      alert(`Successfully imported ${importedLines.length} bank statement lines.`);
      setCsvFile(null);
      setCsvHeaders([]);
      setCsvRows([]);
      setActiveTab('reconcile');
      loadBankLines();

    } catch (err: any) {
      alert(`Error importing CSV: ${err.message}`);
    } finally {
      setImporting(false);
    }
  };

  // Add Manual Statement Line
  const handleAddManualLine = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company || !manualDate || !manualDesc) return;

    try {
      const newLine = {
        company_id: company.id,
        date: manualDate,
        description: manualDesc,
        money_in: Number(manualIn.toFixed(2)),
        money_out: Number(manualOut.toFixed(2)),
        balance: manualBalance ? Number(parseFloat(manualBalance).toFixed(2)) : null,
        status: 'unmatched',
      };

      const { data, error } = await supabase
        .from('bank_lines')
        .insert(newLine)
        .select()
        .single();

      if (error) throw error;

      setManualDate('');
      setManualDesc('');
      setManualIn(0);
      setManualOut(0);
      setManualBalance('');
      
      alert('Statement line added.');
      loadBankLines();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  // Link receipt
  const handleMatchReceipt = async (receiptId: string) => {
    if (!selectedLineId) return;
    try {
      // 1. Update bank line status to matched and link receipt
      const { error: lineError } = await supabase
        .from('bank_lines')
        .update({
          receipt_document_id: receiptId,
          status: 'matched',
        })
        .eq('id', selectedLineId);

      if (lineError) throw lineError;

      // 2. Update the document status to matched
      const { error: docError } = await supabase
        .from('documents')
        .update({
          status: 'matched',
        })
        .eq('id', receiptId);

      if (docError) throw docError;

      alert('Receipt linked and matched successfully!');
      loadBankLines();
      loadOrphanReceipts();
    } catch (err: any) {
      alert(`Error matching receipt: ${err.message}`);
    }
  };

  // Unlink receipt
  const handleUnmatch = async (lineId: string, receiptId: string | null) => {
    try {
      // 1. Reset bank line
      const { error: lineError } = await supabase
        .from('bank_lines')
        .update({
          receipt_document_id: null,
          status: 'unmatched',
        })
        .eq('id', lineId);

      if (lineError) throw lineError;

      // 2. Set document back to reviewed (or pending)
      if (receiptId) {
        await supabase
          .from('documents')
          .update({
            status: 'reviewed',
          })
          .eq('id', receiptId);
      }

      alert('Match removed.');
      loadBankLines();
      loadOrphanReceipts();
    } catch (err: any) {
      alert(`Error unmatching: ${err.message}`);
    }
  };

  const filteredOrphans = availableReceipts.filter((r) =>
    r.filename.toLowerCase().includes(receiptSearch.toLowerCase())
  );

  return (
    <div className="bank-container animate-fade-in">
      <style dangerouslySetInnerHTML={{ __html: `
        .tab-bar {
          display: flex;
          gap: 16px;
          border-bottom: 1px solid var(--border-light);
          margin-bottom: 24px;
        }
        .tab-btn {
          background: transparent;
          border: none;
          padding: 12px 6px;
          font-family: var(--font-display);
          font-size: 1rem;
          font-weight: 600;
          color: var(--text-muted);
          cursor: pointer;
          border-bottom: 2px solid transparent;
          transition: border-color 0.2s, color 0.2s;
        }
        .tab-btn:hover {
          color: var(--text-main);
        }
        .tab-btn.active {
          color: var(--primary);
          border-bottom-color: var(--primary);
        }
        .recon-grid {
          display: grid;
          grid-template-columns: 1.1fr 1fr;
          gap: 32px;
        }
        @media (max-width: 992px) {
          .recon-grid {
            grid-template-columns: 1fr;
          }
        }
        .line-item-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
          max-height: 600px;
          overflow-y: auto;
          padding-right: 6px;
        }
        .line-card {
          border: 1px solid var(--border-light);
          border-radius: var(--radius-md);
          padding: 16px;
          cursor: pointer;
          background: #ffffff;
          transition: border-color 0.2s, box-shadow 0.2s;
        }
        .line-card:hover {
          border-color: var(--primary);
        }
        .line-card.active {
          border-color: var(--primary);
          box-shadow: 0 0 0 3px var(--primary-glow);
        }
        .line-header {
          display: flex;
          justify-content: space-between;
          margin-bottom: 8px;
        }
        .amount-display {
          font-weight: 700;
          font-family: var(--font-display);
        }
        .amount-out { color: var(--color-danger); }
        .amount-in { color: var(--color-success); }
        
        .receipt-picker {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .receipt-card {
          border: 1px solid var(--border-light);
          border-radius: var(--radius-md);
          padding: 12px 16px;
          background: #fafafa;
          display: flex;
          justify-content: space-between;
          align-items: center;
          transition: background 0.2s;
        }
        .receipt-card:hover {
          background: #f1f5f9;
        }
        .csv-mapping-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 16px;
          margin-top: 20px;
          margin-bottom: 24px;
        }
        .exception-box {
          border: 1px solid #fee2e2;
          background: #fef2f2;
          color: #991b1b;
          border-radius: var(--radius-md);
          padding: 16px;
          margin-bottom: 16px;
        }
        .exception-title {
          font-weight: 700;
          margin-bottom: 4px;
          display: flex;
          align-items: center;
          gap: 8px;
        }
      ` }} />

      <h1>Bank Statement Matching</h1>
      <p className="input-label" style={{ marginTop: '4px' }}>
        Import your bank transaction history and match statement lines to supporting receipts.
      </p>

      {/* Tabs */}
      <div className="tab-bar">
        <button
          className={`tab-btn ${activeTab === 'reconcile' ? 'active' : ''}`}
          onClick={() => setActiveTab('reconcile')}
        >
          🏦 Reconciliation & Matching
        </button>
        <button
          className={`tab-btn ${activeTab === 'import' ? 'active' : ''}`}
          onClick={() => setActiveTab('import')}
        >
          📥 Import Statements
        </button>
        <button
          className={`tab-btn ${activeTab === 'exceptions' ? 'active' : ''}`}
          onClick={() => setActiveTab('exceptions')}
        >
          ⚠️ Exception Reports
        </button>
      </div>

      {/* Reconcile Tab */}
      {activeTab === 'reconcile' && (
        <div className="recon-grid">
          {/* List of bank lines */}
          <div>
            <h3>Bank Statement Lines</h3>
            <p className="input-label" style={{ marginBottom: '16px' }}>Click a line to reconcile or link receipts</p>
            
            {loadingLines ? (
              <p>Loading bank statement lines...</p>
            ) : bankLines.length === 0 ? (
              <p style={{ color: 'var(--text-muted)' }}>No statement lines imported. Go to 'Import Statements' to load records.</p>
            ) : (
              <div className="line-item-list">
                {bankLines.map((line) => {
                  const isActive = line.id === selectedLineId;
                  const isOut = line.money_out > 0;
                  return (
                    <div
                      key={line.id}
                      className={`line-card ${isActive ? 'active' : ''}`}
                      onClick={() => setSelectedLineId(line.id)}
                    >
                      <div className="line-header">
                        <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                          {new Date(line.date).toLocaleDateString('en-GB')}
                        </span>
                        <span className={`badge badge-${line.status === 'matched' ? 'success' : 'danger'}`}>
                          {line.status}
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: 500, fontSize: '0.95rem' }}>{line.description}</span>
                        <span className={`amount-display ${isOut ? 'amount-out' : 'amount-in'}`}>
                          {isOut ? `-£${line.money_out.toFixed(2)}` : `+£${line.money_in.toFixed(2)}`}
                        </span>
                      </div>
                      {line.receipt && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '8px', display: 'flex', gap: '4px' }}>
                          <span>📎 matched to:</span>
                          <strong>{line.receipt.filename}</strong>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Reconciliation Workspace */}
          <div className="card" style={{ height: 'fit-content' }}>
            <h3>Match Workspace</h3>
            
            {selectedLine ? (
              <div style={{ marginTop: '20px' }}>
                <div style={{ padding: '16px', background: 'var(--bg-app)', borderRadius: '12px', marginBottom: '24px' }}>
                  <p className="input-label">Selected Statement Line</p>
                  <h4 style={{ fontSize: '1.1rem', margin: '4px 0' }}>{selectedLine.description}</h4>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px' }}>
                    <span>Date: {new Date(selectedLine.date).toLocaleDateString('en-GB')}</span>
                    <strong style={{ fontSize: '1.1rem' }} className={selectedLine.money_out > 0 ? 'amount-out' : 'amount-in'}>
                      {selectedLine.money_out > 0 ? `-£${selectedLine.money_out.toFixed(2)}` : `+£${selectedLine.money_in.toFixed(2)}`}
                    </strong>
                  </div>
                </div>

                {selectedLine.status === 'matched' ? (
                  <div style={{ textAlign: 'center', padding: '24px 0' }}>
                    <span style={{ fontSize: '2rem' }}>✅</span>
                    <h4 style={{ marginTop: '12px' }}>Line Reconciled</h4>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                      Linked receipt: {selectedLine.receipt?.filename}
                    </p>
                    <button
                      type="button"
                      className="btn btn-danger"
                      style={{ marginTop: '20px' }}
                      onClick={() => handleUnmatch(selectedLine.id, selectedLine.receipt_document_id)}
                    >
                      Unmatch Receipt
                    </button>
                  </div>
                ) : (
                  <div className="receipt-picker">
                    {/* Suggested matches */}
                    {suggestedReceipts.length > 0 && (
                      <div>
                        <h4 style={{ fontSize: '0.9rem', color: 'var(--primary)', marginBottom: '8px' }}>💡 Suggested Receipts</h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {suggestedReceipts.map((rec) => (
                            <div key={rec.id} className="receipt-card">
                              <div>
                                <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{rec.filename}</div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                  Uploaded {new Date(rec.uploaded_at).toLocaleDateString('en-GB')}
                                </div>
                              </div>
                              <button
                                type="button"
                                className="btn btn-primary"
                                style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                                onClick={() => handleMatchReceipt(rec.id)}
                              >
                                Match
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Search all orphans */}
                    <div>
                      <h4 style={{ fontSize: '0.9rem', marginBottom: '8px' }}>🔍 Search All Uploaded Receipts</h4>
                      <input
                        type="text"
                        className="input-field"
                        placeholder="Search receipt filename..."
                        value={receiptSearch}
                        onChange={(e) => setReceiptSearch(e.target.value)}
                        style={{ marginBottom: '12px' }}
                      />

                      {filteredOrphans.length === 0 ? (
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>No orphan receipts match your search.</p>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '250px', overflowY: 'auto' }}>
                          {filteredOrphans.map((rec) => (
                            <div key={rec.id} className="receipt-card">
                              <div>
                                <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{rec.filename}</div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                  Period: {rec.period} | Uploaded {new Date(rec.uploaded_at).toLocaleDateString('en-GB')}
                                </div>
                              </div>
                              <button
                                type="button"
                                className="btn btn-primary"
                                style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                                onClick={() => handleMatchReceipt(rec.id)}
                              >
                                Link
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p style={{ marginTop: '20px', color: 'var(--text-muted)' }}>Select a line to view reconciliation options.</p>
            )}
          </div>
        </div>
      )}

      {/* Import Tab */}
      {activeTab === 'import' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '32px' }}>
          <div className="card">
            <h3>Import Bank Statement (CSV)</h3>
            <p className="input-label" style={{ marginTop: '4px' }}>Load statement transactions from your banking provider.</p>

            <div style={{ marginTop: '24px' }}>
              <input
                type="file"
                accept=".csv"
                onChange={handleCsvChange}
                style={{ marginBottom: '16px' }}
                disabled={importing}
              />
              
              {csvFile && (
                <>
                  <p className="input-label" style={{ marginTop: '16px' }}>Configure CSV Column Mapping</p>
                  
                  <div className="csv-mapping-grid">
                    <div className="input-group">
                      <label className="input-label">Date Column</label>
                      <select className="select-field" value={dateCol} onChange={(e) => setDateCol(e.target.value)}>
                        <option value="">-- Select Column --</option>
                        {csvHeaders.map((h) => <option key={h} value={h}>{h}</option>)}
                      </select>
                    </div>

                    <div className="input-group">
                      <label className="input-label">Description Column</label>
                      <select className="select-field" value={descCol} onChange={(e) => setDescCol(e.target.value)}>
                        <option value="">-- Select Column --</option>
                        {csvHeaders.map((h) => <option key={h} value={h}>{h}</option>)}
                      </select>
                    </div>

                    <div className="input-group">
                      <label className="input-label">Money Out (Debit)</label>
                      <select className="select-field" value={moneyOutCol} onChange={(e) => setMoneyOutCol(e.target.value)}>
                        <option value="">-- Select Column --</option>
                        {csvHeaders.map((h) => <option key={h} value={h}>{h}</option>)}
                      </select>
                    </div>

                    <div className="input-group">
                      <label className="input-label">Money In (Credit)</label>
                      <select className="select-field" value={moneyInCol} onChange={(e) => setMoneyInCol(e.target.value)}>
                        <option value="">-- Select Column --</option>
                        {csvHeaders.map((h) => <option key={h} value={h}>{h}</option>)}
                      </select>
                    </div>

                    <div className="input-group">
                      <label className="input-label">Balance Column</label>
                      <select className="select-field" value={balanceCol} onChange={(e) => setBalanceCol(e.target.value)}>
                        <option value="">-- Select Column (Optional) --</option>
                        {csvHeaders.map((h) => <option key={h} value={h}>{h}</option>)}
                      </select>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="btn btn-primary"
                    style={{ width: '100%', padding: '12px' }}
                    onClick={handleImportCsv}
                    disabled={importing}
                  >
                    {importing ? 'Importing records...' : 'Confirm Column Mappings & Import'}
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="card">
            <h3>Add Statement Line Manually</h3>
            <p className="input-label" style={{ marginTop: '4px' }}>Add a single bank transaction without importing a CSV.</p>

            <form onSubmit={handleAddManualLine} style={{ marginTop: '20px' }}>
              <div className="input-group">
                <label className="input-label">Transaction Date</label>
                <input
                  type="date"
                  className="input-field"
                  value={manualDate}
                  onChange={(e) => setManualDate(e.target.value)}
                  required
                />
              </div>

              <div className="input-group">
                <label className="input-label">Description / Merchant</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="e.g. Starling Bank Fee"
                  value={manualDesc}
                  onChange={(e) => setManualDesc(e.target.value)}
                  required
                />
              </div>

              <div className="split-row">
                <div className="input-group">
                  <label className="input-label">Money Out (Debit)</label>
                  <input
                    type="number"
                    step="0.01"
                    className="input-field"
                    value={manualOut}
                    onChange={(e) => setManualOut(Number(e.target.value))}
                  />
                </div>

                <div className="input-group">
                  <label className="input-label">Money In (Credit)</label>
                  <input
                    type="number"
                    step="0.01"
                    className="input-field"
                    value={manualIn}
                    onChange={(e) => setManualIn(Number(e.target.value))}
                  />
                </div>
              </div>

              <div className="input-group">
                <label className="input-label">Running Balance (Optional)</label>
                <input
                  type="number"
                  step="0.01"
                  className="input-field"
                  placeholder="£"
                  value={manualBalance}
                  onChange={(e) => setManualBalance(e.target.value)}
                />
              </div>

              <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '10px' }}>
                ➕ Add Statement Line
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Exceptions Tab */}
      {activeTab === 'exceptions' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Unmatched Bank Lines */}
          <div className="card">
            <h2>Exceptions: Unmatched Bank Lines</h2>
            <p className="input-label" style={{ margin: '4px 0 16px' }}>Statement transactions lacking supporting invoices or receipts</p>
            
            {bankLines.filter(l => l.status === 'unmatched').length === 0 ? (
              <p style={{ color: 'var(--color-success)', fontWeight: 600 }}>All bank lines are matched to supporting documents!</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {bankLines.filter(l => l.status === 'unmatched').map((line) => (
                  <div key={line.id} className="exception-box">
                    <div className="exception-title">
                      <span>⚠️ Unmatched Statement Line</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.9rem' }}>
                      <span>
                        <strong>{line.description}</strong> on {new Date(line.date).toLocaleDateString('en-GB')}
                      </span>
                      <strong className={line.money_out > 0 ? 'amount-out' : 'amount-in'}>
                        {line.money_out > 0 ? `-£${line.money_out.toFixed(2)}` : `+£${line.money_in.toFixed(2)}`}
                      </strong>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Orphan Receipts */}
          <div className="card">
            <h2>Exceptions: Orphan Receipts</h2>
            <p className="input-label" style={{ margin: '4px 0 16px' }}>Uploaded receipt files that have not been linked to any bank line</p>

            {availableReceipts.length === 0 ? (
              <p style={{ color: 'var(--color-success)', fontWeight: 600 }}>All uploaded receipts are matched to statement lines!</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {availableReceipts.map((rec) => (
                  <div key={rec.id} className="exception-box" style={{ background: 'rgba(6, 180, 212, 0.05)', border: '1px solid rgba(6, 180, 212, 0.15)', color: 'var(--color-info)' }}>
                    <div className="exception-title" style={{ color: 'var(--color-info)' }}>
                      <span>📎 Orphan Uploaded File</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.9rem' }}>
                      <span>
                        <strong>{rec.filename}</strong> (Period: {rec.period})
                      </span>
                      <span>Uploaded {new Date(rec.uploaded_at).toLocaleDateString('en-GB')}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
