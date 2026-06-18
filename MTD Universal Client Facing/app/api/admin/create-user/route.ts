import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Initialize a server-side Supabase client using the service role key to perform admin actions
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export async function POST(req: NextRequest) {
  try {
    // 1. Get the admin authorization header or cookie to verify the current session
    // For safety, we check if the user calling this API is a practice admin in public.users
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    }

    if (!serviceRoleKey) {
      return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY is not defined on the server.' }, { status: 500 });
    }

    // Initialize admin client early to bypass RLS policies on internal checks
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Initialize temporary supabase client to verify requester token
    const token = authHeader.replace('Bearer ', '');
    const tempClient = createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '');
    const { data: { user }, error: authError } = await tempClient.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorised session' }, { status: 401 });
    }

    // Verify if this user is a practice admin in public.users using adminClient (bypasses RLS)
    const { data: profile } = await adminClient
      .from('users')
      .select('role, company_id')
      .eq('id', user.id)
      .single();

    if (!profile || profile.role !== 'admin' || profile.company_id !== null) {
      return NextResponse.json({ error: 'Forbidden: Requires practice administrator role' }, { status: 403 });
    }

    // 2. Parse request body
    const { email, password, companyId, role } = await req.json();

    if (!email || !password || !role) {
      return NextResponse.json({ error: 'Missing required user parameters' }, { status: 400 });
    }


    // 3. Create user in Supabase Auth
    const { data: authUser, error: createUserError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (createUserError || !authUser.user) {
      throw new Error(createUserError?.message || 'Failed to create auth user');
    }

    // 4. Insert profile record in public.users
    const { error: profileError } = await adminClient
      .from('users')
      .insert({
        id: authUser.user.id,
        company_id: companyId || null,
        email: email,
        role: role,
      });

    if (profileError) {
      // Rollback auth user creation if profile fails
      await adminClient.auth.admin.deleteUser(authUser.user.id);
      throw profileError;
    }

    // Log the creation
    await adminClient.from('audit_log').insert({
      company_id: companyId || '00000000-0000-0000-0000-000000000000', // system level
      action: 'admin_create_user',
      entity: 'user',
      before: null,
      after: { email, role, company_id: companyId },
    });

    return NextResponse.json({
      success: true,
      userId: authUser.user.id,
    });

  } catch (err: any) {
    console.error('Error in api/admin/create-user:', err);
    return NextResponse.json({ error: err.message || 'Action failed' }, { status: 500 });
  }
}
