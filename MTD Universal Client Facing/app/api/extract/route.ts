import { NextRequest, NextResponse } from 'next/server';
import { extractDocument } from '@/lib/extraction';
import { supabase } from '@/lib/supabaseClient';

export async function POST(req: NextRequest) {
  try {
    const { documentId, companyId, mode } = await req.json();

    if (!documentId || !companyId || !mode) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    // 1. Run extraction service
    const extraction = await extractDocument(documentId, companyId, mode);

    // 2. Fetch company VAT status to decide VAT logic
    const { data: company, error: companyError } = await supabase
      .from('companies')
      .select('vat_registered')
      .eq('id', companyId)
      .single();

    if (companyError || !company) {
      return NextResponse.json({ error: `Company not found: ${companyError?.message}` }, { status: 404 });
    }

    const isVatRegistered = company.vat_registered;
    const insertedTransactions: any[] = [];

    // 3. Insert draft transactions into the database
    for (const tx of extraction.transactions) {
      const gross = Number(tx.gross_amount) || 0;
      let net = gross;
      let vatCode: 'S20' | 'R5' | 'Z' | 'E' | 'OS' | 'RC' | undefined = tx.vat_rate_code || 'OS';
      let vatAmount = 0;

      // VAT logic
      if (isVatRegistered && tx.vat_rate_code) {
        // Simple VAT rate mapping
        let rate = 0;
        if (tx.vat_rate_code === 'S20') rate = 0.20;
        else if (tx.vat_rate_code === 'R5') rate = 0.05;

        // If VAT is included, back-calculate
        net = gross / (1 + rate);
        vatAmount = gross - net;
        vatCode = tx.vat_rate_code;
      } else {
        // Not VAT registered or no code: Net is Gross, VAT is 0
        net = gross;
        vatAmount = 0;
        vatCode = isVatRegistered ? 'OS' : undefined; // Default Outside Scope if registered
      }

      // Prepare transaction draft record
      const draftTx = {
        company_id: companyId,
        document_id: documentId,
        date: tx.date || new Date().toISOString().split('T')[0],
        description: tx.description || 'Extracted transaction',
        gross_amount: Number(gross.toFixed(2)),
        net_amount: Number(net.toFixed(2)),
        vat_code: vatCode,
        vat_amount: Number(vatAmount.toFixed(2)),
        classification: tx.classification || 'expense',
        account_code: tx.suggested_account_code || null,
        business_percent: 100.00,
        is_split: false,
        status: 'draft',
      };

      const { data: inserted, error: insertError } = await supabase
        .from('transactions')
        .insert(draftTx)
        .select()
        .single();

      if (insertError) {
        console.error('Failed to insert draft transaction:', insertError);
      } else {
        insertedTransactions.push(inserted);
      }
    }

    // 4. Write audit log for the extraction call
    await supabase.from('audit_log').insert({
      company_id: companyId,
      action: 'extract_document',
      entity: 'document',
      before: { document_id: documentId, mode },
      after: { 
        transaction_count: insertedTransactions.length, 
        estimated_cost: extraction.estimatedCost,
        provider: extraction.provider 
      },
    });

    return NextResponse.json({
      success: true,
      provider: extraction.provider,
      estimatedCost: extraction.estimatedCost,
      transactions: insertedTransactions,
    });
  } catch (err: any) {
    console.error('Error in api/extract:', err);
    return NextResponse.json({ error: err.message || 'Extraction failed' }, { status: 500 });
  }
}
