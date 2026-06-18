'use client';

import React, { useState, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';

export default function DocumentUploadPage() {
  const { company } = useAuth();
  const [docType, setDocType] = useState<'invoice' | 'receipt' | 'bank_statement' | 'other'>('receipt');
  const [period, setPeriod] = useState('');
  const [extractionMode, setExtractionMode] = useState<'vision' | 'hybrid' | 'manual'>('vision');
  const [file, setFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  
  const [statusMsg, setStatusMsg] = useState('');
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // Helper to determine the current quarter
  const getDefaultPeriod = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1; // 1-indexed
    
    // UK tax quarters typically run April-June (Q1), July-Sept (Q2), Oct-Dec (Q3), Jan-Mar (Q4)
    if (month >= 4 && month <= 6) return `${year}-Q1`;
    if (month >= 7 && month <= 9) return `${year}-Q2`;
    if (month >= 10 && month <= 12) return `${year}-Q3`;
    return `${year - 1}-Q4`; // Jan-Mar falls in the previous year's Q4 or current calendar Q1
  };

  React.useEffect(() => {
    setPeriod(getDefaultPeriod());
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      if (selectedFile.type.startsWith('image/')) {
        setFilePreview(URL.createObjectURL(selectedFile));
      } else {
        setFilePreview(null); // PDF or CSV
      }
    }
  };

  // Client-side image compression
  const compressImage = (imageFile: File): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.src = URL.createObjectURL(imageFile);
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas context not available'));
          return;
        }

        const MAX_WIDTH = 1024;
        const MAX_HEIGHT = 1024;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error('Canvas blob is null'));
            }
          },
          'image/jpeg',
          0.85 // High quality compression
        );
      };
      img.onerror = (err) => reject(err);
    });
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !company) return;

    setUploading(true);
    setStatusMsg('Compressing image if required...');
    setProgress(10);

    try {
      let uploadPayload: Blob | File = file;

      // Only compress image uploads, bypass PDF and CSV
      if (file.type.startsWith('image/')) {
        try {
          uploadPayload = await compressImage(file);
        } catch (err) {
          console.warn('Compression failed, uploading original file:', err);
        }
      }

      setProgress(30);
      setStatusMsg('Uploading file to secure storage...');

      const fileExt = file.name.split('.').pop();
      const uniqueId = crypto.randomUUID();
      const storagePath = `${company.id}/${uniqueId}/${file.name}`;

      // 1. Upload to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('documents')
        .upload(storagePath, uploadPayload, {
          contentType: file.type,
          upsert: true
        });

      if (uploadError) {
        throw uploadError;
      }

      setProgress(60);
      setStatusMsg('Saving document reference in database...');

      // 2. Insert record in `documents` table
      const { data: docRecord, error: docError } = await supabase
        .from('documents')
        .insert({
          id: uniqueId,
          company_id: company.id,
          type: docType,
          filename: file.name,
          storage_path: storagePath,
          period: period,
          status: 'pending',
          archived: false,
        })
        .select()
        .single();

      if (docError || !docRecord) {
        throw new Error(docError?.message || 'Failed to save document metadata.');
      }

      setProgress(80);
      setStatusMsg('Initiating structural document extraction...');

      // 3. Trigger extraction API
      const response = await fetch('/api/extract', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          documentId: docRecord.id,
          companyId: company.id,
          mode: extractionMode,
        }),
      });

      if (!response.ok) {
        const errJson = await response.json();
        throw new Error(errJson.error || 'API Extraction failed');
      }

      setProgress(100);
      setStatusMsg('Success! Document uploaded and transaction drafts generated.');
      
      // Reset form and redirect to review
      setTimeout(() => {
        router.push('/dashboard/review');
      }, 1500);

    } catch (err: any) {
      console.error(err);
      setStatusMsg(`Error: ${err.message || 'Something went wrong.'}`);
      setUploading(false);
    }
  };

  return (
    <div className="upload-container animate-fade-in">
      <style dangerouslySetInnerHTML={{ __html: `
        .upload-wrapper {
          display: grid;
          grid-template-columns: 1.2fr 1fr;
          gap: 32px;
          margin-top: 24px;
        }
        @media (max-width: 900px) {
          .upload-wrapper {
            grid-template-columns: 1fr;
          }
        }
        .upload-zone {
          border: 2px dashed var(--border-light);
          border-radius: var(--radius-lg);
          padding: 40px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          background: #fafafa;
          cursor: pointer;
          transition: border-color var(--transition-fast), background var(--transition-fast);
          min-height: 260px;
        }
        .upload-zone:hover {
          border-color: var(--primary);
          background: rgba(var(--company-accent-rgb), 0.02);
        }
        .upload-icon {
          font-size: 3rem;
          margin-bottom: 16px;
        }
        .upload-text h3 {
          font-size: 1.1rem;
          margin-bottom: 6px;
        }
        .upload-text p {
          font-size: 0.85rem;
          color: var(--text-muted);
        }
        .preview-box {
          border: 1px solid var(--border-light);
          border-radius: var(--radius-md);
          padding: 16px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
          background: #ffffff;
        }
        .preview-img {
          max-width: 100%;
          max-height: 200px;
          object-fit: contain;
          border-radius: var(--radius-sm);
        }
        .preview-file-icon {
          font-size: 3.5rem;
        }
        .progress-bar-container {
          margin-top: 20px;
          width: 100%;
        }
        .progress-track {
          background-color: var(--border-light);
          height: 8px;
          border-radius: 9999px;
          overflow: hidden;
          margin-bottom: 8px;
        }
        .progress-fill {
          background-color: var(--primary);
          height: 100%;
          transition: width 0.3s ease;
        }
        .progress-text {
          font-size: 0.85rem;
          font-weight: 600;
          color: var(--primary);
          text-align: center;
        }
      ` }} />

      <h1>Upload Bookkeeping Documents</h1>
      <p className="input-label" style={{ marginTop: '4px' }}>
        Add invoices, statements, or receipts. Files are encrypted and isolated per company.
      </p>

      <div className="upload-wrapper">
        {/* Upload Form */}
        <div className="card">
          <form onSubmit={handleUpload}>
            <div className="input-group">
              <label className="input-label">Document Type</label>
              <select
                className="select-field"
                value={docType}
                onChange={(e: any) => setDocType(e.target.value)}
                required
              >
                <option value="receipt">Receipt (Cash / Card Purchase)</option>
                <option value="invoice">Supplier Invoice / Bill</option>
                <option value="bank_statement">Bank Statement (PDF / CSV)</option>
                <option value="other">Other Supporting Document</option>
              </select>
            </div>

            <div className="input-group">
              <label className="input-label">Tax Period / Quarter</label>
              <select
                className="select-field"
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                required
              >
                <option value="2026-Q1">Q1 (April - June 2026)</option>
                <option value="2026-Q2">Q2 (July - September 2026)</option>
                <option value="2026-Q3">Q3 (October - December 2026)</option>
                <option value="2025-Q4">Q4 (January - March 2026)</option>
                <option value="2026-Year">Full Tax Year 2026/27</option>
              </select>
            </div>

            <div className="input-group">
              <label className="input-label">Extraction Intelligence Mode</label>
              <select
                className="select-field"
                value={extractionMode}
                onChange={(e: any) => setExtractionMode(e.target.value)}
                required
              >
                <option value="vision">Vision Model (Default Gemini Flash - suggested)</option>
                <option value="hybrid">OCR + LLM Text Model (Best for high volume clean text)</option>
                <option value="manual">Manual Entry Only (Zero external model cost)</option>
              </select>
            </div>

            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="image/jpeg,image/png,image/webp,application/pdf,text/csv"
              style={{ display: 'none' }}
            />

            {!file ? (
              <div className="upload-zone" onClick={() => fileInputRef.current?.click()}>
                <span className="upload-icon">📤</span>
                <div className="upload-text">
                  <h3>Choose a file or drag it here</h3>
                  <p>Supports JPEG, PNG, WEBP, PDF, and CSV up to 50MB</p>
                </div>
              </div>
            ) : (
              <div className="preview-box">
                {filePreview ? (
                  <img src={filePreview} alt="Preview" className="preview-img" />
                ) : (
                  <div className="preview-file-icon">
                    {file.name.endsWith('.pdf') ? '📄' : file.name.endsWith('.csv') ? '📊' : '📁'}
                  </div>
                )}
                <div style={{ textAlign: 'center' }}>
                  <p style={{ fontWeight: 600, fontSize: '0.9rem' }}>{file.name}</p>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    {(file.size / (1024 * 1024)).toFixed(2)} MB
                  </p>
                </div>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setFile(null);
                    setFilePreview(null);
                  }}
                  disabled={uploading}
                >
                  Clear File
                </button>
              </div>
            )}

            {file && (
              <button
                type="submit"
                className="btn btn-primary"
                style={{ width: '100%', marginTop: '24px' }}
                disabled={uploading}
              >
                {uploading ? 'Processing...' : 'Upload & Process Document'}
              </button>
            )}
          </form>

          {uploading && (
            <div className="progress-bar-container">
              <div className="progress-track">
                <div className="progress-fill" style={{ width: `${progress}%` }}></div>
              </div>
              <div className="progress-text">{statusMsg}</div>
            </div>
          )}

          {!uploading && statusMsg && (
            <div
              className={`badge badge-${statusMsg.startsWith('Error') ? 'danger' : 'success'}`}
              style={{ width: '100%', padding: '12px', marginTop: '16px', display: 'block', textAlign: 'center' }}
            >
              {statusMsg}
            </div>
          )}
        </div>

        {/* Informational sidebar */}
        <div className="card" style={{ height: 'fit-content' }}>
          <h2>Storage & Privacy</h2>
          <p className="input-label" style={{ margin: '8px 0 16px' }}>
            Security compliance policies in place.
          </p>

          <ul style={{ paddingLeft: '20px', fontSize: '0.9rem', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <li>
              <strong>Per-Tenant Isolation:</strong> Your files are protected by database RLS policies. No other portal tenant can ever access or view your uploaded documents.
            </li>
            <li>
              <strong>UK Data Residency:</strong> Storage is hosted entirely within the UK/EU region to satisfy local data handling regulations and GDPR.
            </li>
            <li>
              <strong>Cost-Control Compression:</strong> Images are automatically resized on your phone or computer before uploading to save your mobile data and reduce processing costs.
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
