import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    return NextResponse.json({
      SUPABASE_URL_defined: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      SUPABASE_URL_length: process.env.NEXT_PUBLIC_SUPABASE_URL?.length || 0,
      SUPABASE_ANON_KEY_defined: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      SUPABASE_ANON_KEY_length: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.length || 0,
      SUPABASE_SERVICE_ROLE_KEY_defined: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      SUPABASE_SERVICE_ROLE_KEY_length: process.env.SUPABASE_SERVICE_ROLE_KEY?.length || 0,
      GEMINI_API_KEY_defined: !!process.env.GEMINI_API_KEY,
      GEMINI_API_KEY_length: process.env.GEMINI_API_KEY?.length || 0,
      NODE_ENV: process.env.NODE_ENV,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
