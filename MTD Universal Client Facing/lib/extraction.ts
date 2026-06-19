import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !serviceRoleKey) {
  console.warn('Supabase URL or Service Role Key missing in extraction environment.');
}

// Server-side service-role client bypasses RLS policies for document download & categories mapping
const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});


export interface ExtractedTransaction {
  date: string; // YYYY-MM-DD
  description: string;
  gross_amount: number;
  vat_rate_code?: 'S20' | 'R5' | 'Z' | 'E' | 'OS' | 'RC';
  vat_amount?: number;
  classification: 'income' | 'expense' | 'asset' | 'transfer' | 'personal' | 'none';
  suggested_account_code?: number;
  confidence: number; // 0.0 to 1.0
}

export interface ExtractionResult {
  provider: string;
  estimatedCost: number;
  transactions: ExtractedTransaction[];
}

export async function extractDocument(
  documentId: string,
  companyId: string,
  mode: 'vision' | 'hybrid' | 'manual'
): Promise<ExtractionResult> {
  const result: ExtractionResult = {
    provider: mode,
    estimatedCost: 0,
    transactions: [],
  };

  if (mode === 'manual') {
    // Return a single blank line for manual confirmation
    result.transactions = [
      {
        date: new Date().toISOString().split('T')[0],
        description: '',
        gross_amount: 0,
        classification: 'expense',
        confidence: 1.0,
      },
    ];
    return result;
  }

  // 1. Fetch the document record from DB
  const { data: doc, error: docError } = await supabase
    .from('documents')
    .select('*')
    .eq('id', documentId)
    .single();

  if (docError || !doc) {
    throw new Error(`Document not found: ${docError?.message || 'Unknown error'}`);
  }

  // 2. Fetch company active accounts to pass as a compact reference
  // We only pass posting accounts matching company modules
  // First, get the active modules for the company
  const { data: moduleData } = await supabase
    .from('company_modules')
    .select('module_code')
    .eq('company_id', companyId);

  const activeModules = moduleData ? moduleData.map((m: any) => m.module_code) : ['UNI'];
  if (!activeModules.includes('UNI')) activeModules.push('UNI');

  // Fetch accounts filtered by modules and posting type
  const { data: accounts } = await supabase
    .from('accounts')
    .select('code, name, description, vat_default')
    .eq('type', 'Posting')
    .eq('is_active', true)
    .in('industry_module', activeModules);

  const compactCategories = (accounts || []).map((acc: any) => ({
    code: acc.code,
    name: acc.name,
    desc: acc.description,
    vat_default: acc.vat_default,
  }));

  // 3. Download the file from Supabase Storage
  // Since we are running in Next.js Serverless, we can download the file as a buffer
  const { data: fileData, error: downloadError } = await supabase.storage
    .from('documents')
    .download(doc.storage_path);

  if (downloadError || !fileData) {
    throw new Error(`Failed to download file from storage: ${downloadError?.message}`);
  }

  const arrayBuffer = await fileData.arrayBuffer();
  const fileBuffer = Buffer.from(arrayBuffer);
  const mimeType = fileData.type || 'image/jpeg';

  if (mode === 'vision') {
    // vision model mode using Gemini API
    const apiKey = process.env.GEMINI_API_KEY;
    const model = process.env.GEMINI_MODEL || 'gemini-1.5-flash';

    if (!apiKey) {
      console.warn('GEMINI_API_KEY is not defined. Falling back to manual mode.');
      result.provider = 'manual (fallback)';
      result.transactions = [
        {
          date: new Date().toISOString().split('T')[0],
          description: 'Fallback: Please enter manual details (API key missing)',
          gross_amount: 0,
          classification: 'expense',
          confidence: 1.0,
        },
      ];
      return result;
    }

    const base64Data = fileBuffer.toString('base64');
    
    // Construct prompt
    const prompt = `You are an expert UK bookkeeping system. Extract all transactions from this receipt/invoice.
Return the output strictly in the requested JSON structure.

Context information:
The client company type is UK VAT-registered or non-VAT (VAT status: ${doc.type === 'invoice' || doc.type === 'receipt' ? 'registered' : 'not'}).
Here is the list of active account codes you should map to:
${JSON.stringify(compactCategories, null, 2)}

Instructions:
1. Parse the document. Extract the date (format YYYY-MM-DD), merchant name or description, and gross amount in GBP.
2. Select the best match 'suggested_account_code' from the provided accounts list.
3. Classify each line as 'income', 'expense', 'asset', 'transfer', 'personal', or 'none'.
4. Extract the VAT code (e.g. S20 for 20%, R5 for 5%, Z for 0%, E for exempt, OS for outside scope) if present.
5. Provide a confidence rating between 0.0 and 1.0.`;

    const requestBody = {
      contents: [
        {
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType: mimeType,
                data: base64Data,
              },
            },
          ],
        },
      ],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'OBJECT',
          properties: {
            transactions: {
              type: 'ARRAY',
              items: {
                type: 'OBJECT',
                properties: {
                  date: { type: 'STRING' },
                  description: { type: 'STRING' },
                  gross_amount: { type: 'NUMBER' },
                  vat_rate_code: { type: 'STRING', enum: ['S20', 'R5', 'Z', 'E', 'OS', 'RC'] },
                  vat_amount: { type: 'NUMBER' },
                  classification: { type: 'STRING', enum: ['income', 'expense', 'asset', 'transfer', 'personal', 'none'] },
                  suggested_account_code: { type: 'INTEGER' },
                  confidence: { type: 'NUMBER' },
                },
                required: ['date', 'description', 'gross_amount', 'classification', 'confidence'],
              },
            },
          },
          required: ['transactions'],
        },
      },
    };

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Gemini API error: ${response.status} - ${errText}`);
    }

    const resJson = await response.json();
    const textResult = resJson.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!textResult) {
      throw new Error('Empty response from Gemini Vision model');
    }

    const parsedResult = JSON.parse(textResult);
    result.transactions = parsedResult.transactions || [];
    
    // Estimate cost: Gemini 1.5 Flash costs $0.075 / 1M input tokens, $0.30 / 1M output tokens
    // Approximate: ~1500 input tokens (image + prompt) + ~300 output tokens
    // Cost ~ $0.0002 GBP (approx 0.02 pence)
    result.estimatedCost = 0.0002; 
  } else if (mode === 'hybrid') {
    // OCR + LLM mode (hybrid)
    // Run mock/regex OCR, then send text to Gemini
    // For simplicity, we can extract text from CSV or text documents directly, 
    // or run a basic text extraction, then pass it to Gemini Flash.
    // If it's a PDF, try to read text strings, otherwise fallback to vision.
    const rawText = fileBuffer.toString('utf-8').slice(0, 10000); // Take first 10k characters
    
    const apiKey = process.env.GEMINI_API_KEY;
    const model = process.env.GEMINI_MODEL || 'gemini-1.5-flash';

    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is not defined.');
    }

    const prompt = `You are a UK bookkeeping system. Extract all transactions from this raw OCR text:
---
${rawText}
---

Return the output strictly in the requested JSON structure.
Here is the list of active account codes you should map to:
${JSON.stringify(compactCategories, null, 2)}

Instructions:
1. Parse the text. Extract the date (format YYYY-MM-DD), merchant or description, and gross amount.
2. Select the best match 'suggested_account_code' from the list.
3. Classify each line as 'income', 'expense', 'asset', 'transfer', 'personal', or 'none'.
4. Extract the VAT code if present.
5. Provide confidence rating.`;

    const requestBody = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'OBJECT',
          properties: {
            transactions: {
              type: 'ARRAY',
              items: {
                type: 'OBJECT',
                properties: {
                  date: { type: 'STRING' },
                  description: { type: 'STRING' },
                  gross_amount: { type: 'NUMBER' },
                  vat_rate_code: { type: 'STRING', enum: ['S20', 'R5', 'Z', 'E', 'OS', 'RC'] },
                  vat_amount: { type: 'NUMBER' },
                  classification: { type: 'STRING', enum: ['income', 'expense', 'asset', 'transfer', 'personal', 'none'] },
                  suggested_account_code: { type: 'INTEGER' },
                  confidence: { type: 'NUMBER' },
                },
                required: ['date', 'description', 'gross_amount', 'classification', 'confidence'],
              },
            },
          },
          required: ['transactions'],
        },
      },
    };

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Gemini Hybrid API error: ${response.status} - ${errText}`);
    }

    const resJson = await response.json();
    const textResult = resJson.candidates?.[0]?.content?.parts?.[0]?.text;
    const parsedResult = JSON.parse(textResult);
    result.transactions = parsedResult.transactions || [];
    
    // Cost for text-only is cheaper: ~800 input tokens + ~300 output tokens
    result.estimatedCost = 0.0001;
  }

  return result;
}
