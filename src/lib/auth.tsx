import type { Session } from '@supabase/supabase-js';
import { useQueryClient } from '@tanstack/react-query';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';

import { loginIdToAuthEmail, parseLoginId } from './domain/login-id';
import { phoneToAuthEmail } from './domain/phone-email';
import { supabase } from './supabase';
import type { Profile } from './types';

interface AuthContextValue {
  session: Session | null;
  profile: Profile | null;
  isLoading: boolean;
  signIn: (phone: string, password: string) => Promise<Profile | null>;
  signUp: (phone: string, password: string, fullName: string) => Promise<Profile | null>;
  signOut: () => Promise<void>;
  /**
   * Re-reads the signed-in profile row. The profile carries settings the
   * customer changes about themselves — how they pay, for one — and without
   * this the screen that changed it would keep showing the old answer until
   * the next cold start.
   */
  refreshProfile: () => Promise<Profile | null>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const userIdRef = useRef<string | undefined>(undefined);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadProfile = useCallback(async (userId: string | undefined): Promise<Profile | null> => {
    if (!userId) {
      setProfile(null);
      return null;
    }
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    if (error) {
      console.warn('Failed to load profile:', error.message);
      setProfile(null);
      return null;
    }
    const row = data as Profile;
    setProfile(row);
    return row;
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      userIdRef.current = data.session?.user.id;
      setSession(data.session);
      loadProfile(data.session?.user.id).finally(() => setIsLoading(false));
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      // Query keys name orders and shops, not the person asking. When the
      // person changes (a shared phone, "use another number" on a shop's web
      // page) the previous account's cached orders must not render for the
      // next one, so the whole cache goes with the session.
      // Only a change of person can leak the previous person's cache. With no
      // previous user there is nothing to protect, and clearing then (on the
      // session restore, a token refresh at start-up, or the guest's own
      // sign-in) removes a page's first queries mid-flight.
      if (userIdRef.current && userIdRef.current !== next?.user.id) {
        queryClient.clear();
      }
      userIdRef.current = next?.user.id;
      setSession(next);
      loadProfile(next?.user.id);
    });
    return () => sub.subscription.unsubscribe();
  }, [loadProfile, queryClient]);

  // Phone sign-ups need a paid SMS provider on Supabase, so auth runs on a
  // synthetic email derived from the phone or a shop's branded username; the
  // phone/username stays the user-facing identity.
  const signIn = useCallback(async (loginInput: string, password: string) => {
    const loginId = parseLoginId(loginInput);
    if (!loginId) throw new Error('Enter your mobile number or shop username.');
    const { data, error } = await supabase.auth.signInWithPassword({
      email: loginIdToAuthEmail(loginId),
      password,
    });
    if (error) throw new Error(error.message);
    // The destination after sign-in depends on the role. Wait for the
    // profile here so a superadmin is not sent to the customer home
    // while the row is still in flight.
    userIdRef.current = data.user.id;
    setSession(data.session);
    const profile = await loadProfile(data.user.id);
    if (profile?.role === 'superadmin') return profile;
    // If this is the first platform account, take the console rather than
    // waiting on a SQL-editor promotion. Missing function or an existing
    // superadmin both come back as an error; leave the profile as it is.
    const claimed = await supabase.rpc('claim_first_superadmin');
    const row = (Array.isArray(claimed.data) ? claimed.data[0] : claimed.data) as Profile | null;
    if (!claimed.error && row?.role === 'superadmin') {
      setProfile(row);
      return row;
    }
    return profile;
  }, [loadProfile]);

  const signUp = useCallback(
    async (phone: string, password: string, fullName: string) => {
      const { data, error } = await supabase.auth.signUp({
        email: phoneToAuthEmail(phone),
        password,
        options: { data: { full_name: fullName, phone } },
      });
      if (error) throw new Error(error.message);
      const userId = data.user?.id;
      if (!userId) return null;
      userIdRef.current = userId;
      setSession(data.session);
      return loadProfile(userId);
    },
    [loadProfile]
  );

  const refreshProfile = useCallback(async () => {
    return loadProfile(userIdRef.current);
  }, [loadProfile]);

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw new Error(error.message);
  }, []);

  return (
    <AuthContext.Provider
      value={{ session, profile, isLoading, signIn, signUp, signOut, refreshProfile }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
