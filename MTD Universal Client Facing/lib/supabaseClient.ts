import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const isMock = !supabaseUrl || !supabaseAnonKey;

// A robust recursive proxy mock to prevent runtime crashes when env variables are not yet configured.
const createMockClient = (path: string[] = []): any => {
  const dummyFn = () => {};
  return new Proxy(dummyFn, {
    get(target, prop) {
      if (typeof prop === 'symbol') return undefined;
      if (prop === 'then' || prop === 'toJSON' || prop === '$$typeof') return undefined;
      return createMockClient([...path, prop as string]);
    },
    apply(target, thisArg, args) {
      const last = path[path.length - 1];
      if (last === 'getSession') {
        return Promise.resolve({ data: { session: null }, error: null });
      }
      if (last === 'onAuthStateChange') {
        return { data: { subscription: { unsubscribe: () => {} } } };
      }
      if (last === 'signInWithPassword') {
        return Promise.resolve({
          data: { user: null },
          error: { message: 'Supabase URL and Anon Key are missing. Please configure .env.local to log in.' },
        });
      }
      if (last === 'signOut') {
        return Promise.resolve({});
      }
      if (last === 'createSignedUrl') {
        return Promise.resolve({ data: { signedUrl: '' }, error: null });
      }
      // Default return value for queries
      return Promise.resolve({ data: [], error: null, count: 0 });
    },
  });
};

export const supabase = isMock
  ? createMockClient()
  : createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });

