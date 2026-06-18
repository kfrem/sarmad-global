'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabaseClient';

interface ReportRow {
  id: string;
  date: string;
  description: string;
  gross_amount: number;
  net_amount: number;
  vat_code: string | null;
  vat_amount: number;
  classification: string;
  account_code: number | null;
  account_name?: string;
  hmrc_category_id?: string | null;
  hmrc_category_name?: string;
  business_percent: number;
  is_split: boolean;
  status: string;
  property_id?: string | null;
  documents?: {
    filename: string;
    storage_path: string;
  } | null;
}

export default function ReportsPage() {
  const { company } = useAuth();
  
  // Date Filters
  const [periodType, setPeriodType] = useState<'quarter' | 'year' | 'custom'>('quarter');
  const [selectedQuarter, setSelectedQuarter] = useState('2026-Q1');
  const [selectedYear, setSelectedYear] = useState('2026');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  // Data State
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [bankLines, setBankLines] = useState<any[]>([]);
  const [orphanDocs, setOrphanDocs] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [hmrcCategories, setHmrcCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Tab states: 'listing' | 'summary' | 'vat' | 'income_exp' | 'exceptions' | 'property'
  const [activeTab, setActiveTab] = useState<'listing' | 'summary' | 'vat' | 'income_exp' | 'exceptions' | 'property'>('listing');

  // Load Accounts & Categories mapping
  useEffect(() => {
    const loadMappingData = async () => {
      const { data: accs } = await supabase.from('accounts').select('code, name');
      const { data: cats } = await supabase.from('hmrc_categories').select('id, name');
      if (accs) setAccounts(accs);
      if (cats) setHmrcCategories(cats);
    };
    loadMappingData();
  }, []);

  const getPeriodDates = () => {
    let start = '';
    let end = '';

    if (periodType === 'quarter') {
      // Standard UK Tax quarters run:
      // Q1: 6 April - 5 July
      // Q2: 6 July - 5 October
      // Q3: 6 October - 5 January
      // Q4: 6 January - 5 April
      const [yearStr, q] = selectedQuarter.split('-');
      const year = parseInt(yearStr);

      if (q === 'Q1') {
        start = `${year}-04-06`;
        end = `${year}-07-05`;
      } else if (q === 'Q2') {
        start = `${year}-07-06`;
        end = `${year}-10-05`;
      } else if (q === 'Q3') {
        start = `${year}-10-06`;
        end = `${year + 1}-01-05`;
      } else if (q === 'Q4') {
        start = `${year}-01-06`;
        end = `${year}-04-05`;
      }
    } else if (periodType === 'year') {
      const year = parseInt(selectedYear);
      start = `${year}-04-06`;
      end = `${year + 1}-04-05`;
    } else {
      start = startDate;
      end = endDate;
    }

    return { start, end };
  };

  const generateReport = async () => {
    if (!company) return;
    setLoading(true);
    try {
      const { start, end } = getPeriodDates();

      if (!start || !end) {
        alert('Please specify a valid start and end date.');
        setLoading(false);
        return;
      }

      // 1. Fetch Transactions
      let query = supabase
        .from('transactions')
        .select('*, documents(filename, storage_path)')
        .eq('status', 'confirmed')
        .gte('date', start)
        .lte('date', end)
        .order('date', { ascending: true });

      const { data: txData, error: txError } = await query;
      if (txError) throw txError;

      const mappedRows = (txData || []).map((row: any) => {
        const acc = accounts.find((a) => a.code === row.account_code);
        const cat = hmrcCategories.find((c) => c.id === row.hmrc_category_id);
        return {
          ...row,
          account_name: acc ? acc.name : 'Uncategorised',
          hmrc_category_name: cat ? cat.name : 'Uncategorised',
        };
      });

      setRows(mappedRows);

      // 2. Fetch Bank Lines
      const { data: bankData } = await supabase
        .from('bank_lines')
        .gte('date', start)
        .lte('date', end);
      
      if (bankData) setBankLines(bankData);

      // 3. Fetch Orphan Documents
      const { data: docData } = await supabase
        .from('documents')
        .eq('status', 'pending')
        .gte('uploaded_at', `${start}T00:00:00Z`)
        .lte('uploaded_at', `${end}T23:59:59Z`);
      
      if (docData) setOrphanDocs(docData);

    } catch (err: any) {
      alert(`Error generating report: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (company && accounts.length > 0 && hmrcCategories.length > 0) {
      generateReport();
    }
  }, [company, periodType, selectedQuarter, selectedYear, startDate, endDate, accounts, hmrcCategories]);

  // Client-Side CSV Export
  const exportToCsv = (filename: string, content: string) => {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportListing = () => {
    let csv = 'Date,Description,Gross,Net,VAT Code,VAT Amount,Classification,Account Code,Account Name,HMRC Category,Business Portion %,Split,Property Tag,Document Filename\n';
    
    rows.forEach((r) => {
      const docName = r.documents?.filename ? `"${r.documents.filename.replace(/"/g, '""')}"` : '';
      csv += `${r.date},"${r.description.replace(/"/g, '""')}",${r.gross_amount},${r.net_amount},${r.vat_code || ''},${r.vat_amount},${r.classification},${r.account_code || ''},"${r.account_name}","${r.hmrc_category_name}",${r.business_percent},${r.is_split},"${r.property_id || ''}",${docName}\n`;
    });

    exportToCsv(`Transaction_Listing_${getPeriodDates().start}_to_${getPeriodDates().end}.csv`, csv);
  };

  // Summaries Calculations
  // 1. CoA Summary
  const getCoaSummary = () => {
    const summaryMap: Record<number, { code: number; name: string; gross: number; net: number; vat: number }> = {};
    rows.forEach((r) => {
      if (r.account_code) {
        if (!summaryMap[r.account_code]) {
          summaryMap[r.account_code] = { code: r.account_code, name: r.account_name || '', gross: 0, net: 0, vat: 0 };
        }
        summaryMap[r.account_code].gross += r.gross_amount;
        summaryMap[r.account_code].net += r.net_amount;
        summaryMap[r.account_code].vat += r.vat_amount;
      }
    });
    return Object.values(summaryMap);
  };

  // 2. HMRC Summary
  const getHmrcSummary = () => {
    const summaryMap: Record<string, { id: string; name: string; gross: number; net: number; vat: number }> = {};
    rows.forEach((r) => {
      if (r.hmrc_category_id) {
        if (!summaryMap[r.hmrc_category_id]) {
          summaryMap[r.hmrc_category_id] = { id: r.hmrc_category_id, name: r.hmrc_category_name || '', gross: 0, net: 0, vat: 0 };
        }
        summaryMap[r.hmrc_category_id].gross += r.gross_amount;
        summaryMap[r.hmrc_category_id].net += r.net_amount;
        summaryMap[r.hmrc_category_id].vat += r.vat_amount;
      }
    });
    return Object.values(summaryMap);
  };

  // 3. VAT Summary
  const getVatSummary = () => {
    let outputVat = 0;
    let inputVat = 0;
    const ratesSummary: Record<string, { rate: string; net: number; vat: number }> = {};

    rows.forEach((r) => {
      if (r.vat_code && r.vat_amount > 0) {
        if (!ratesSummary[r.vat_code]) {
          ratesSummary[r.vat_code] = { rate: r.vat_code, net: 0, vat: 0 };
        }
        ratesSummary[r.vat_code].net += r.net_amount;
        ratesSummary[r.vat_code].vat += r.vat_amount;

        if (r.classification === 'income') {
          outputVat += r.vat_amount;
        } else if (r.classification === 'expense' || r.classification === 'asset') {
          inputVat += r.vat_amount;
        }
      }
    });

    return {
      outputVat,
      inputVat,
      netVat: outputVat - inputVat,
      rates: Object.values(ratesSummary),
    };
  };

  // 4. Income and Expenditure
  const getIncomeExpenditure = () => {
    let businessIncome = 0;
    let businessExpense = 0;
    let drawingsPrivate = 0;

    rows.forEach((r) => {
      if (r.classification === 'income') {
        businessIncome += r.net_amount;
      } else if (r.classification === 'expense') {
        businessExpense += r.net_amount;
      } else if (r.classification === 'personal') {
        drawingsPrivate += r.gross_amount; // Personal/Drawings has no VAT recovery
      }
    });

    return {
      businessIncome,
      businessExpense,
      netSurplus: businessIncome - businessExpense,
      drawingsPrivate,
    };
  };

  // 5. Landlord property breakdown
  const getPropertyBreakdown = () => {
    const propMap: Record<string, { property: string; income: number; expense: number; net: number }> = {};
    rows.forEach((r) => {
      if (company?.entity_type === 'landlord' && r.property_id) {
        const prop = r.property_id;
        if (!propMap[prop]) {
          propMap[prop] = { property: prop, income: 0, expense: 0, net: 0 };
        }
        if (r.classification === 'income') {
          propMap[prop].income += r.net_amount;
        } else if (r.classification === 'expense') {
          propMap[prop].expense += r.net_amount;
        }
        propMap[prop].net = propMap[prop].income - propMap[prop].expense;
      }
    });
    return Object.values(propMap);
  };

  const openDocument = async (path: string) => {
    const { data, error } = await supabase.storage.from('documents').createSignedUrl(path, 60);
    if (error) {
      alert('Error fetching file link');
    } else if (data?.signedUrl) {
      window.open(data.signedUrl, '_blank');
    }
  };

  return (
    <div className="reports-container animate-fade-in">
      <style dangerouslySetInnerHTML={{ __html: `
        .filter-panel {
          background: #ffffff;
          border: 1px solid var(--border-light);
          border-radius: var(--radius-lg);
          padding: 24px;
          margin-bottom: 32px;
          box-shadow: var(--shadow-sm);
        }
        .filter-row {
          display: flex;
          gap: 20px;
          align-items: flex-end;
          flex-wrap: wrap;
        }
        .tab-bar {
          display: flex;
          gap: 16px;
          border-bottom: 1px solid var(--border-light);
          margin-bottom: 24px;
          overflow-x: auto;
        }
        .tab-btn {
          background: transparent;
          border: none;
          padding: 12px 6px;
          font-family: var(--font-display);
          font-size: 0.95rem;
          font-weight: 600;
          color: var(--text-muted);
          cursor: pointer;
          border-bottom: 2px solid transparent;
          white-space: nowrap;
          transition: border-color 0.2s, color 0.2s;
        }
        .tab-btn:hover {
          color: var(--text-main);
        }
        .tab-btn.active {
          color: var(--primary);
          border-bottom-color: var(--primary);
        }
        .report-table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 16px;
        }
        .report-table th {
          text-align: left;
          padding: 12px;
          font-size: 0.8rem;
          font-weight: 700;
          color: var(--text-muted);
          border-bottom: 2px solid var(--border-light);
          text-transform: uppercase;
        }
        .report-table td {
          padding: 14px 12px;
          border-bottom: 1px solid var(--border-light);
          font-size: 0.875rem;
        }
        .report-table tr:hover {
          background-color: var(--bg-app);
        }
        .summary-card {
          background: var(--bg-card);
          border: 1px solid var(--border-light);
          border-radius: var(--radius-md);
          padding: 24px;
          box-shadow: var(--shadow-sm);
          margin-bottom: 24px;
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 24px;
        }
        .summary-item {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .summary-val {
          font-size: 1.8rem;
          font-weight: 700;
          font-family: var(--font-display);
        }
      ` }} />

      <h1>Reports & Data Export</h1>
      <p className="input-label" style={{ marginTop: '4px' }}>
        Generate bookkeeping journals and category aggregates for Making Tax Digital.
      </p>

      {/* Filter Panel */}
      <div className="filter-panel" style={{ marginTop: '24px' }}>
        <div className="filter-row">
          <div className="input-group" style={{ marginBottom: 0 }}>
            <label className="input-label">Filter Period By</label>
            <select
              className="select-field"
              value={periodType}
              onChange={(e: any) => setPeriodType(e.target.value)}
              style={{ width: '180px' }}
            >
              <option value="quarter">UK Tax Quarter</option>
              <option value="year">Full Tax Year</option>
              <option value="custom">Custom Range</option>
            </select>
          </div>

          {periodType === 'quarter' && (
            <div className="input-group" style={{ marginBottom: 0 }}>
              <label className="input-label">Select Quarter</label>
              <select
                className="select-field"
                value={selectedQuarter}
                onChange={(e) => setSelectedQuarter(e.target.value)}
                style={{ width: '220px' }}
              >
                <option value="2026-Q1">Q1 (6 April - 5 July 2026)</option>
                <option value="2026-Q2">Q2 (6 July - 5 October 2026)</option>
                <option value="2026-Q3">Q3 (6 October 2026 - 5 January 2027)</option>
                <option value="2025-Q4">Q4 (6 January - 5 April 2026)</option>
              </select>
            </div>
          )}

          {periodType === 'year' && (
            <div className="input-group" style={{ marginBottom: 0 }}>
              <label className="input-label">Select Tax Year</label>
              <select
                className="select-field"
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                style={{ width: '180px' }}
              >
                <option value="2026">2026 / 2027</option>
                <option value="2025">2025 / 2026</option>
              </select>
            </div>
          )}

          {periodType === 'custom' && (
            <>
              <div className="input-group" style={{ marginBottom: 0 }}>
                <label className="input-label">Start Date</label>
                <input
                  type="date"
                  className="input-field"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  style={{ width: '160px' }}
                />
              </div>
              <div className="input-group" style={{ marginBottom: 0 }}>
                <label className="input-label">End Date</label>
                <input
                  type="date"
                  className="input-field"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  style={{ width: '160px' }}
                />
              </div>
            </>
          )}

          <button
            type="button"
            className="btn btn-primary"
            onClick={generateReport}
            disabled={loading}
          >
            {loading ? 'Compiling...' : '🔄 Refresh Report'}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="tab-bar">
        <button className={`tab-btn ${activeTab === 'listing' ? 'active' : ''}`} onClick={() => setActiveTab('listing')}>
          📝 Transaction Listing
        </button>
        <button className={`tab-btn ${activeTab === 'summary' ? 'active' : ''}`} onClick={() => setActiveTab('summary')}>
          📁 Category Summaries
        </button>
        {company?.vat_registered && (
          <button className={`tab-btn ${activeTab === 'vat' ? 'active' : ''}`} onClick={() => setActiveTab('vat')}>
            🇬🇧 VAT Summary
          </button>
        )}
        <button className={`tab-btn ${activeTab === 'income_exp' ? 'active' : ''}`} onClick={() => setActiveTab('income_exp')}>
          💵 Income & Expenditure
        </button>
        {company?.entity_type === 'landlord' && (
          <button className={`tab-btn ${activeTab === 'property' ? 'active' : ''}`} onClick={() => setActiveTab('property')}>
            🏠 Property Breakdown
          </button>
        )}
        <button className={`tab-btn ${activeTab === 'exceptions' ? 'active' : ''}`} onClick={() => setActiveTab('exceptions')}>
          ⚠️ Exceptions Report
        </button>
      </div>

      {loading ? (
        <p>Loading report data...</p>
      ) : (
        <>
          {/* 1. Transaction Listing Tab */}
          {activeTab === 'listing' && (
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div>
                  <h3>Confirmed Transaction Journal</h3>
                  <p className="input-label">Double-entry logs with digital links to source documents</p>
                </div>
                <button type="button" className="btn btn-secondary" onClick={handleExportListing}>
                  📤 Export to CSV
                </button>
              </div>

              {rows.length === 0 ? (
                <p style={{ marginTop: '20px' }}>No transactions confirmed in this period.</p>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table className="report-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Description</th>
                        <th>Gross</th>
                        <th>Net</th>
                        <th>VAT Code</th>
                        <th>VAT Amt</th>
                        <th>Classification</th>
                        <th>CoA Code</th>
                        <th>Category Name</th>
                        <th>Source File</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row) => (
                        <tr key={row.id}>
                          <td>{new Date(row.date).toLocaleDateString('en-GB')}</td>
                          <td>{row.description}</td>
                          <td>£{row.gross_amount.toFixed(2)}</td>
                          <td>£{row.net_amount.toFixed(2)}</td>
                          <td>{row.vat_code || 'OS'}</td>
                          <td>£{row.vat_amount.toFixed(2)}</td>
                          <td style={{ textTransform: 'capitalize' }}>{row.classification}</td>
                          <td>{row.account_code || ''}</td>
                          <td>{row.account_name}</td>
                          <td>
                            {row.documents?.storage_path ? (
                              <button
                                type="button"
                                style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontWeight: 600, textDecoration: 'underline', padding: 0 }}
                                onClick={() => openDocument(row.documents!.storage_path)}
                              >
                                {row.documents.filename}
                              </button>
                            ) : (
                              'Manual'
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* 2. Category Summaries Tab */}
          {activeTab === 'summary' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {/* CoA Summary */}
              <div className="card">
                <h3>Chart of Accounts Totals</h3>
                <p className="input-label" style={{ marginBottom: '16px' }}>Posting summaries grouped by 5-digit ledger code</p>
                
                {getCoaSummary().length === 0 ? (
                  <p>No categorised ledger records.</p>
                ) : (
                  <table className="report-table">
                    <thead>
                      <tr>
                        <th>Account Code</th>
                        <th>Account Name</th>
                        <th>Net Total</th>
                        <th>VAT Total</th>
                        <th>Gross Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {getCoaSummary().map((acc) => (
                        <tr key={acc.code}>
                          <td><strong>{acc.code}</strong></td>
                          <td>{acc.name}</td>
                          <td>£{acc.net.toFixed(2)}</td>
                          <td>£{acc.vat.toFixed(2)}</td>
                          <td>£{acc.gross.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* HMRC Summary */}
              <div className="card">
                <h3>HMRC Tax Box Totals</h3>
                <p className="input-label" style={{ marginBottom: '16px' }}>Summaries grouped by SA103/SA105 tax return lines</p>

                {getHmrcSummary().length === 0 ? (
                  <p>No tax-mapped records.</p>
                ) : (
                  <table className="report-table">
                    <thead>
                      <tr>
                        <th>Tax Category Name</th>
                        <th>Net Business Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {getHmrcSummary().map((cat) => (
                        <tr key={cat.id}>
                          <td><strong>{cat.name}</strong></td>
                          <td>£{cat.net.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {/* 3. VAT Summary Tab */}
          {activeTab === 'vat' && company?.vat_registered && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div className="summary-card">
                <div className="summary-item">
                  <span className="input-label">Output VAT (Sales)</span>
                  <span className="summary-val" style={{ color: 'var(--color-success)' }}>
                    £{getVatSummary().outputVat.toFixed(2)}
                  </span>
                </div>
                <div className="summary-item">
                  <span className="input-label">Input VAT (Expenses)</span>
                  <span className="summary-val" style={{ color: 'var(--color-danger)' }}>
                    £{getVatSummary().inputVat.toFixed(2)}
                  </span>
                </div>
                <div className="summary-item">
                  <span className="input-label">Net VAT Due / Reclaimable</span>
                  <span className="summary-val">
                    £{Math.abs(getVatSummary().netVat).toFixed(2)}
                    <span style={{ fontSize: '0.9rem', fontWeight: 600, marginLeft: '8px' }}>
                      {getVatSummary().netVat >= 0 ? 'Owed to HMRC' : 'Reclaimable'}
                    </span>
                  </span>
                </div>
              </div>

              <div className="card">
                <h3>VAT Breakdown by Rate Code</h3>
                <table className="report-table" style={{ marginTop: '16px' }}>
                  <thead>
                    <tr>
                      <th>VAT Rate Code</th>
                      <th>Net Base Amount</th>
                      <th>VAT Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {getVatSummary().rates.map((rate) => (
                      <tr key={rate.rate}>
                        <td><strong>{rate.rate}</strong></td>
                        <td>£{rate.net.toFixed(2)}</td>
                        <td>£{rate.vat.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 4. Income and Expenditure Tab */}
          {activeTab === 'income_exp' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div className="summary-card">
                <div className="summary-item">
                  <span className="input-label">Business Income</span>
                  <span className="summary-val" style={{ color: 'var(--color-success)' }}>
                    £{getIncomeExpenditure().businessIncome.toFixed(2)}
                  </span>
                </div>
                <div className="summary-item">
                  <span className="input-label">Business Expenses</span>
                  <span className="summary-val" style={{ color: 'var(--color-danger)' }}>
                    £{getIncomeExpenditure().businessExpense.toFixed(2)}
                  </span>
                </div>
                <div className="summary-item">
                  <span className="input-label">Net Surplus / Profit</span>
                  <span className="summary-val">
                    £{getIncomeExpenditure().netSurplus.toFixed(2)}
                  </span>
                </div>
                <div className="summary-item">
                  <span className="input-label">Drawings / Private splits</span>
                  <span className="summary-val" style={{ color: 'var(--text-muted)' }}>
                    £{getIncomeExpenditure().drawingsPrivate.toFixed(2)}
                  </span>
                </div>
              </div>

              <div className="card">
                <h3>Profit & Loss Details</h3>
                <p className="input-label">Net figures excluding all VAT (reclaimable) and private splits</p>
                <table className="report-table" style={{ marginTop: '16px' }}>
                  <thead>
                    <tr>
                      <th>Section</th>
                      <th>Bookkeeping Ledger</th>
                      <th>Net Business Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ background: 'rgba(16, 185, 129, 0.03)' }}>
                      <td><strong>INCOME</strong></td>
                      <td>Total Revenues (Sales)</td>
                      <td style={{ color: 'var(--color-success)', fontWeight: 600 }}>
                        +£{getIncomeExpenditure().businessIncome.toFixed(2)}
                      </td>
                    </tr>
                    {getCoaSummary().filter(acc => acc.code.toString().startsWith('4')).map(acc => (
                      <tr key={acc.code}>
                        <td style={{ opacity: 0.6 }}>Revenue Detail</td>
                        <td>{acc.name} ({acc.code})</td>
                        <td>£{acc.net.toFixed(2)}</td>
                      </tr>
                    ))}
                    
                    <tr style={{ background: 'rgba(239, 68, 68, 0.03)' }}>
                      <td><strong>EXPENSES</strong></td>
                      <td>Total Business Expenditures</td>
                      <td style={{ color: 'var(--color-danger)', fontWeight: 600 }}>
                        -£{getIncomeExpenditure().businessExpense.toFixed(2)}
                      </td>
                    </tr>
                    {getCoaSummary().filter(acc => acc.code.toString().startsWith('7') || acc.code.toString().startsWith('8')).map(acc => (
                      <tr key={acc.code}>
                        <td style={{ opacity: 0.6 }}>Expense Detail</td>
                        <td>{acc.name} ({acc.code})</td>
                        <td>£{acc.net.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 5. Landlord Property Breakdown */}
          {activeTab === 'property' && company?.entity_type === 'landlord' && (
            <div className="card">
              <h3>Rental Performance per Property</h3>
              <p className="input-label" style={{ marginBottom: '16px' }}>P&L calculations segmented by property identifier</p>
              
              {getPropertyBreakdown().length === 0 ? (
                <p>No property tags assigned to transactions yet.</p>
              ) : (
                <table className="report-table">
                  <thead>
                    <tr>
                      <th>Property Tag</th>
                      <th>Rental Income</th>
                      <th>Property Expenses</th>
                      <th>Net Yield / Profit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {getPropertyBreakdown().map((p) => (
                      <tr key={p.property}>
                        <td><strong>{p.property}</strong></td>
                        <td style={{ color: 'var(--color-success)' }}>£{p.income.toFixed(2)}</td>
                        <td style={{ color: 'var(--color-danger)' }}>£{p.expense.toFixed(2)}</td>
                        <td style={{ fontWeight: 600 }}>£{p.net.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* 6. Exceptions Tab */}
          {activeTab === 'exceptions' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div className="card">
                <h3>Unreconciled Bank Lines ({bankLines.filter(b => b.status === 'unmatched').length})</h3>
                <p className="input-label" style={{ marginBottom: '16px' }}>Statement transactions missing invoices/receipts</p>
                <table className="report-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Description</th>
                      <th>Money In</th>
                      <th>Money Out</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bankLines.filter(b => b.status === 'unmatched').map((b) => (
                      <tr key={b.id}>
                        <td>{new Date(b.date).toLocaleDateString('en-GB')}</td>
                        <td>{b.description}</td>
                        <td style={{ color: 'var(--color-success)' }}>{b.money_in > 0 ? `£${b.money_in.toFixed(2)}` : ''}</td>
                        <td style={{ color: 'var(--color-danger)' }}>{b.money_out > 0 ? `£${b.money_out.toFixed(2)}` : ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="card">
                <h3>Orphan Receipts / Unlinked Uploads ({orphanDocs.length})</h3>
                <p className="input-label" style={{ marginBottom: '16px' }}>Receipt files not matched to any bank statements</p>
                <table className="report-table">
                  <thead>
                    <tr>
                      <th>Upload Date</th>
                      <th>Filename</th>
                      <th>Type</th>
                      <th>Period</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orphanDocs.map((doc) => (
                      <tr key={doc.id}>
                        <td>{new Date(doc.uploaded_at).toLocaleDateString('en-GB')}</td>
                        <td>{doc.filename}</td>
                        <td style={{ textTransform: 'capitalize' }}>{doc.type}</td>
                        <td>{doc.period}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
