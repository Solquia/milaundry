import { Redirect } from 'expo-router';

import { Loading } from '@/components/ui-kit';
import { useAuth } from '@/lib/auth';
import { openRoute } from '@/lib/domain/splash-gate';
import { hasSeenSplash } from '@/lib/splash-state';

export default function Index() {
  const { session, profile, isLoading } = useAuth();

  const destination = openRoute({
    isAuthLoading: isLoading,
    hasSession: Boolean(session),
    role: profile?.role,
    hasSeenSplash: hasSeenSplash(),
  });

  // Null means the destination is not knowable yet — the session is still
  // being restored and the splash has already played.
  if (!destination) return <Loading />;

  return <Redirect href={destination as never} />;
}
