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
  const [files, setFiles] = useState<File[]>([]);
  const [filePreviews, setFilePreviews] = useState<string[]>([]);
  const [dragActive, setDragActive] = useState(false);
  
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
    const selectedFiles = e.target.files;
    if (selectedFiles && selectedFiles.length > 0) {
      const newFiles = Array.from(selectedFiles);
      setFiles(prev => [...prev, ...newFiles]);
      
      const newPreviews = newFiles.map(file => {
        if (file.type.startsWith('image/')) {
          return URL.createObjectURL(file);
        }
        return '';
      });
      setFilePreviews(prev => [...prev, ...newPreviews]);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFiles = Array.from(e.dataTransfer.files);
      setFiles(prev => [...prev, ...droppedFiles]);
      
      const newPreviews = droppedFiles.map(file => {
        if (file.type.startsWith('image/')) {
          return URL.createObjectURL(file);
        }
        return '';
      });
      setFilePreviews(prev => [...prev, ...newPreviews]);
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
    if (files.length === 0 || !company) return;

    setUploading(true);
    setProgress(0);

    try {
      const totalFiles = files.length;
      for (let i = 0; i < totalFiles; i++) {
        const currentFile = files[i];
        const fileNumText = `[File ${i + 1} of ${totalFiles}]`;
        const baseProgress = (i / totalFiles) * 100;
        const stepProgress = 100 / totalFiles;

        setStatusMsg(`${fileNumText} Compressing ${currentFile.name}...`);
        setProgress(Math.round(baseProgress + stepProgress * 0.1));

        let uploadPayload: Blob | File = currentFile;

        // Only compress image uploads, bypass PDF and CSV
        if (currentFile.type.startsWith('image/')) {
          try {
            uploadPayload = await compressImage(currentFile);
          } catch (err) {
            console.warn('Compression failed, uploading original file:', err);
          }
        }

        setStatusMsg(`${fileNumText} Uploading ${currentFile.name}...`);
        setProgress(Math.round(baseProgress + stepProgress * 0.4));

        const uniqueId = crypto.randomUUID();
        const storagePath = `${company.id}/${uniqueId}/${currentFile.name}`;

        // 1. Upload to Supabase Storage
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('documents')
          .upload(storagePath, uploadPayload, {
            contentType: currentFile.type,
            upsert: true
          });

        if (uploadError) {
          throw uploadError;
        }

        setStatusMsg(`${fileNumText} Saving database reference...`);
        setProgress(Math.round(baseProgress + stepProgress * 0.6));

        // 2. Insert record in `documents` table
        const { data: docRecord, error: docError } = await supabase
          .from('documents')
          .insert({
            id: uniqueId,
            company_id: company.id,
            type: docType,
            filename: currentFile.name,
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

        setStatusMsg(`${fileNumText} Analysing with AI Extraction...`);
        setProgress(Math.round(baseProgress + stepProgress * 0.8));

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

        setProgress(Math.round(baseProgress + stepProgress));
      }

      setStatusMsg('Success! All documents uploaded and transaction drafts generated.');
      
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
        .upload-zone:hover, .upload-zone.drag-active {
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
        .file-list-container {
          display: flex;
          flex-direction: column;
          gap: 12px;
          margin-top: 16px;
          max-height: 400px;
          overflow-y: auto;
          padding-right: 4px;
        }
        .file-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px;
          border: 1px solid var(--border-light);
          border-radius: var(--radius-md);
          background: #ffffff;
          gap: 16px;
          transition: transform 0.2s, box-shadow 0.2s;
        }
        .file-item:hover {
          transform: translateY(-1px);
          box-shadow: var(--shadow-sm);
        }
        .file-item-info {
          display: flex;
          align-items: center;
          gap: 12px;
          flex: 1;
          min-width: 0;
        }
        .file-item-thumbnail {
          width: 48px;
          height: 48px;
          object-fit: cover;
          border-radius: var(--radius-sm);
          background: #f1f5f9;
          border: 1px solid var(--border-light);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.5rem;
          flex-shrink: 0;
        }
        .file-item-details {
          display: flex;
          flex-direction: column;
          min-width: 0;
        }
        .file-item-name {
          font-size: 0.875rem;
          font-weight: 600;
          color: var(--text-main);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .file-item-size {
          font-size: 0.75rem;
          color: var(--text-muted);
        }
        .file-item-remove {
          background: none;
          border: none;
          color: var(--color-danger);
          font-size: 1.25rem;
          cursor: pointer;
          padding: 4px 8px;
          border-radius: var(--radius-sm);
          transition: background-color 0.2s;
        }
        .file-item-remove:hover {
          background-color: rgba(239, 68, 68, 0.05);
        }
        .add-more-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          width: 100%;
          padding: 12px;
          border: 2px dashed var(--border-light);
          border-radius: var(--radius-md);
          background: #fdfdfd;
          font-size: 0.875rem;
          font-weight: 600;
          color: var(--text-muted);
          cursor: pointer;
          transition: border-color 0.2s, color 0.2s, background-color 0.2s;
          margin-top: 12px;
        }
        .add-more-btn:hover {
          border-color: var(--primary);
          color: var(--primary);
          background-color: rgba(var(--company-accent-rgb), 0.01);
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
              multiple
            />

            {files.length === 0 ? (
              <div 
                className={`upload-zone ${dragActive ? 'drag-active' : ''}`} 
                onClick={() => fileInputRef.current?.click()}
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
              >
                <span className="upload-icon">📤</span>
                <div className="upload-text">
                  <h3>Choose files or drag them here</h3>
                  <p>Supports JPEG, PNG, WEBP, PDF, and CSV up to 50MB</p>
                </div>
              </div>
            ) : (
              <div>
                <div className="file-list-container">
                  {files.map((file, idx) => {
                    const preview = filePreviews[idx];
                    return (
                      <div className="file-item" key={idx}>
                        <div className="file-item-info">
                          {preview ? (
                            <img src={preview} alt="Thumbnail" className="file-item-thumbnail" />
                          ) : (
                            <div className="file-item-thumbnail">
                              {file.name.endsWith('.pdf') ? '📄' : file.name.endsWith('.csv') ? '📊' : '📁'}
                            </div>
                          )}
                          <div className="file-item-details">
                            <span className="file-item-name" title={file.name}>{file.name}</span>
                            <span className="file-item-size">{(file.size / (1024 * 1024)).toFixed(2)} MB</span>
                          </div>
                        </div>
                        <button
                          type="button"
                          className="file-item-remove"
                          onClick={() => {
                            setFiles(prev => prev.filter((_, i) => i !== idx));
                            setFilePreviews(prev => prev.filter((_, i) => i !== idx));
                          }}
                          disabled={uploading}
                          title="Remove file"
                        >
                          🗑️
                        </button>
                      </div>
                    );
                  })}
                </div>
                
                <button
                  type="button"
                  className="add-more-btn"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                >
                  ➕ Add More Files
                </button>
              </div>
            )}

            {files.length > 0 && (
              <button
                type="submit"
                className="btn btn-primary"
                style={{ width: '100%', marginTop: '24px' }}
                disabled={uploading}
              >
                {uploading ? 'Processing...' : `Upload & Process ${files.length} Document${files.length > 1 ? 's' : ''}`}
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
