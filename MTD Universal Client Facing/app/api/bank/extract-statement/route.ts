import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import AdmZip from 'adm-zip';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

export async function POST(req: NextRequest) {
  try {
    const { fileBase64, filename, mimeType, companyId } = await req.json();

    if (!fileBase64 || !filename || !companyId) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    // Convert base64 to Buffer
    const base64Data = fileBase64.split(';base64,').pop() || fileBase64;
    let fileBuffer: any = Buffer.from(base64Data, 'base64');
    let currentMimeType = mimeType;
    let currentFilename = filename;

    // 1. If ZIP archive, extract the first CSV or PDF inside it
    if (filename.toLowerCase().endsWith('.zip') || mimeType === 'application/zip' || mimeType === 'application/x-zip-compressed') {
      try {
        const zip = new AdmZip(fileBuffer);
        const zipEntries = zip.getEntries();
        
        // Find the first CSV or PDF entry
        const entry = zipEntries.find(e => {
          const name = e.entryName.toLowerCase();
          return !e.isDirectory && (name.endsWith('.csv') || name.endsWith('.pdf'));
        });

        if (!entry) {
          return NextResponse.json({ error: 'No valid CSV or PDF bank statement found inside the ZIP archive.' }, { status: 400 });
        }

        fileBuffer = entry.getData();
        currentFilename = entry.entryName.split('/').pop() || entry.entryName;
        currentMimeType = currentFilename.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'text/csv';
        console.log(`Extracted file from ZIP: ${currentFilename} (${currentMimeType})`);
      } catch (err: any) {
        return NextResponse.json({ error: `Failed to extract ZIP archive: ${err.message}` }, { status: 400 });
      }
    }

    // 2. Parse details based on file type
    let statementLines: any[] = [];
    const apiKey = process.env.GEMINI_API_KEY;

    if (currentFilename.toLowerCase().endsWith('.csv') || currentMimeType === 'text/csv') {
      // Attempt standard CSV text extraction first
      const csvText = fileBuffer.toString('utf-8');
      
      // If we have a Gemini API Key, let Gemini parse the CSV text. This is 100% robust!
      if (apiKey) {
        statementLines = await parseStatementWithGemini(csvText, 'text/csv', apiKey);
      } else {
        // Fallback: parse CSV locally using regex
        statementLines = parseCsvLocally(csvText);
        if (statementLines.length === 0) {
          return NextResponse.json({ error: 'Failed to auto-detect columns in bank statement. GEMINI_API_KEY is required for advanced/unusual CSV layouts.' }, { status: 400 });
        }
      }
    } else if (currentFilename.toLowerCase().endsWith('.pdf') || currentMimeType === 'application/pdf') {
      if (!apiKey) {
        return NextResponse.json({ error: 'GEMINI_API_KEY is required to extract transactions from PDF bank statements.' }, { status: 400 });
      }
      statementLines = await parseStatementWithGemini(fileBuffer.toString('base64'), 'application/pdf', apiKey);
    } else {
      return NextResponse.json({ error: `Unsupported file format: ${currentFilename}. Please upload a CSV, PDF, or ZIP containing them.` }, { status: 400 });
    }

    if (statementLines.length === 0) {
      return NextResponse.json({ error: 'No transactions could be extracted from the statement file.' }, { status: 400 });
    }

    // 3. Insert statement lines into database
    const dbLines = statementLines.map(line => {
      // Clean and format values
      let dateStr = line.date;
      if (dateStr && dateStr.includes('/')) {
        const parts = dateStr.split('/');
        if (parts[2] && parts[2].length === 4) {
          dateStr = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
        }
      }

      return {
        company_id: companyId,
        date: dateStr || new Date().toISOString().split('T')[0],
        description: line.description || 'Unidentified bank transaction',
        money_in: Number((line.money_in || 0).toFixed(2)),
        money_out: Number((line.money_out || 0).toFixed(2)),
        balance: line.balance ? Number(line.balance.toFixed(2)) : null,
        status: 'unmatched',
      };
    });

    const { error: insertError } = await supabase.from('bank_lines').insert(dbLines);
    if (insertError) {
      throw insertError;
    }

    // Write audit log
    await supabase.from('audit_log').insert({
      company_id: companyId,
      action: 'extract_bank_statement',
      entity: 'bank_lines',
      before: { filename: currentFilename },
      after: { imported_count: dbLines.length },
    });

    return NextResponse.json({
      success: true,
      count: dbLines.length,
      lines: dbLines.slice(0, 5), // return sample
    });

  } catch (err: any) {
    console.error('Error in API extract-statement:', err);
    return NextResponse.json({ error: err.message || 'Failed to extract bank statement' }, { status: 500 });
  }
}

// Local CSV fallback parser
function parseCsvLocally(csvText: string): any[] {
  const lines = csvText.split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length <= 1) return [];

  const rows = lines.map(line => {
    const matches = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || line.split(',');
    return matches.map(m => m.replace(/^"|"$/g, '').trim());
  });

  const headers = rows[0];
  let dateIdx = -1;
  let descIdx = -1;
  let outIdx = -1;
  let inIdx = -1;
  let amtIdx = -1;
  let balIdx = -1;

  headers.forEach((h, idx) => {
    const hl = h.toLowerCase();
    if (hl.includes('date')) dateIdx = idx;
    else if (hl.includes('desc') || hl.includes('detail') || hl.includes('narrative') || hl.includes('memo') || hl.includes('transaction')) descIdx = idx;
    else if (hl.includes('out') || hl.includes('debit') || hl.includes('spent') || hl.includes('withdraw')) outIdx = idx;
    else if (hl.includes('in') || hl.includes('credit') || hl.includes('received') || hl.includes('deposit')) inIdx = idx;
    else if (hl.includes('amount') || hl.includes('value')) amtIdx = idx;
    else if (hl.includes('balance')) balIdx = idx;
  });

  if (dateIdx === -1 || descIdx === -1) return [];

  const statementLines = [];
  for (const row of rows.slice(1)) {
    if (!row[dateIdx] || !row[descIdx]) continue;

    let outAmt = 0;
    let inAmt = 0;

    if (outIdx >= 0 && inIdx >= 0 && outIdx !== inIdx) {
      outAmt = Math.abs(parseFloat(row[outIdx].replace(/[^0-9.-]/g, ''))) || 0;
      inAmt = parseFloat(row[inIdx].replace(/[^0-9.-]/g, '')) || 0;
    } else if (amtIdx >= 0) {
      const val = parseFloat(row[amtIdx].replace(/[^0-9.-]/g, '')) || 0;
      if (val < 0) {
        outAmt = Math.abs(val);
        inAmt = 0;
      } else {
        outAmt = 0;
        inAmt = val;
      }
    } else if (outIdx >= 0) {
      // Single amount column mapped to out
      const val = parseFloat(row[outIdx].replace(/[^0-9.-]/g, '')) || 0;
      if (val < 0) {
        outAmt = Math.abs(val);
        inAmt = 0;
      } else {
        outAmt = 0;
        inAmt = val;
      }
    }

    const balance = balIdx >= 0 && row[balIdx] ? parseFloat(row[balIdx].replace(/[^0-9.-]/g, '')) || null : null;

    statementLines.push({
      date: row[dateIdx],
      description: row[descIdx],
      money_in: inAmt,
      money_out: outAmt,
      balance: balance,
    });
  }

  return statementLines;
}

// Gemini statement parser
async function parseStatementWithGemini(data: string, mimeType: string, apiKey: string): Promise<any[]> {
  const model = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const prompt = `You are a professional UK bookkeeping system. Extract all bank transactions from this bank statement.
For each transaction, extract:
1. The transaction date (format strictly YYYY-MM-DD).
2. The merchant narrative / description.
3. The spent amount (money_out) as a positive number.
4. The received amount (money_in) as a positive number.
5. The running balance (balance) if visible, or null if not.

Return the result strictly as a JSON object containing a "lines" array of transactions. Do not wrap in markdown blocks, just return pure JSON.`;

  let contentPart: any = {};
  if (mimeType === 'text/csv') {
    contentPart = { text: `${prompt}\n\nStatement Content:\n${data}` };
  } else {
    contentPart = {
      inlineData: {
        mimeType: mimeType,
        data: data,
      },
    };
  }

  const requestBody = {
    contents: [
      {
        parts: [
          mimeType === 'text/csv' ? contentPart : { text: prompt },
          mimeType !== 'text/csv' ? contentPart : null,
        ].filter(Boolean),
      },
    ],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'OBJECT',
        properties: {
          lines: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              properties: {
                date: { type: 'STRING' },
                description: { type: 'STRING' },
                money_in: { type: 'NUMBER' },
                money_out: { type: 'NUMBER' },
                balance: { type: 'NUMBER' },
              },
              required: ['date', 'description', 'money_in', 'money_out'],
            },
          },
        },
        required: ['lines'],
      },
    },
  };

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini Statement extraction error: ${response.status} - ${errText}`);
  }

  const resJson = await response.json();
  const textResult = resJson.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!textResult) {
    throw new Error('Empty response from Gemini Statement Vision model');
  }

  const parsed = JSON.parse(textResult);
  return parsed.lines || [];
}
