'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';

interface UserProfile {
  id: string;
  company_id: string | null;
  email: string;
  role: 'client' | 'admin';
}

interface Company {
  id: string;
  name: string;
  logo_url: string | null;
  entity_type: 'sole_trader' | 'landlord' | 'limited_company' | 'partnership';
  vat_registered: boolean;
  accent_colour: string | null;
}

interface AuthContextType {
  user: any;
  profile: UserProfile | null;
  company: Company | null;
  modules: string[];
  loading: boolean;
  signOut: () => Promise<void>;
  refreshAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  company: null,
  modules: [],
  loading: true,
  signOut: async () => {},
  refreshAuth: async () => {},
});

export const useAuth = () => useContext(AuthContext);

// Helper to convert hex to RGB
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
}

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [modules, setModules] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const loadUserData = async (currentUser: any) => {
    try {
      if (!currentUser) {
        setProfile(null);
        setCompany(null);
        setModules([]);
        resetAccentColor();
        return;
      }

      // Fetch user profile
      const { data: profileData, error: profileError } = await supabase
        .from('users')
        .select('*')
        .eq('id', currentUser.id)
        .single();

      if (profileError || !profileData) {
        console.error('Error loading user profile:', profileError);
        setProfile(null);
        setCompany(null);
        setModules([]);
        resetAccentColor();
        return;
      }

      const userProfile = profileData as UserProfile;
      setProfile(userProfile);

      if (userProfile.company_id) {
        // Fetch company details
        const { data: companyData, error: companyError } = await supabase
          .from('companies')
          .select('*')
          .eq('id', userProfile.company_id)
          .single();

        if (!companyError && companyData) {
          const companyDetails = companyData as Company;
          setCompany(companyDetails);
          applyAccentColor(companyDetails.accent_colour);
        }

        // Fetch company active modules
        const { data: modulesData, error: modulesError } = await supabase
          .from('company_modules')
          .select('module_code')
          .eq('company_id', userProfile.company_id);

        if (!modulesError && modulesData) {
          setModules(modulesData.map((m: any) => m.module_code));
        }
      } else {
        // Practice admin has no company
        setCompany(null);
        setModules([]);
        resetAccentColor();
      }
    } catch (err) {
      console.error('Unexpected error in loadUserData:', err);
    }
  };

  const applyAccentColor = (hex: string | null) => {
    if (typeof window === 'undefined') return;
    if (hex && hex.startsWith('#')) {
      const rgb = hexToRgb(hex);
      document.documentElement.style.setProperty('--company-accent', hex);
      if (rgb) {
        document.documentElement.style.setProperty(
          '--company-accent-rgb',
          `${rgb.r}, ${rgb.g}, ${rgb.b}`
        );
      }
    } else {
      resetAccentColor();
    }
  };

  const resetAccentColor = () => {
    if (typeof window === 'undefined') return;
    document.documentElement.style.setProperty('--company-accent', '#1e40af');
    document.documentElement.style.setProperty('--company-accent-rgb', '30, 64, 175');
  };

  const refreshAuth = async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      const currentUser = session?.user || null;
      setUser(currentUser);
      await loadUserData(currentUser);
    } catch (err) {
      console.error('Error in refreshAuth:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Initial session load
    refreshAuth();

    // Listen to changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event: any, session: any) => {
        try {
          const currentUser = session?.user || null;
          setUser(currentUser);
          await loadUserData(currentUser);
        } catch (err) {
          console.error('Error in auth state change:', err);
        } finally {
          setLoading(false);
        }

        if (event === 'SIGNED_OUT') {
          router.push('/login');
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    setCompany(null);
    setModules([]);
    resetAccentColor();
    router.push('/login');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        company,
        modules,
        loading,
        signOut,
        refreshAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
