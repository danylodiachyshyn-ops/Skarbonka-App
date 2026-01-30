import { useEffect } from 'react';
import { Redirect } from 'expo-router';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { useAuthStore } from '@/src/hooks/useAuthStore';
import { supabase } from '@/src/lib/supabase';
import { getSessionParamsFromUrl } from '@/src/lib/oauth';
import { useBoxStore } from '@/src/hooks/useBoxStore';

export default function Index() {
  const { isAuthenticated, loading, checkSession, setSession } = useAuthStore();

  // Handle OAuth redirect when app is opened via deep link (e.g. skarbonka-app://auth/callback#...)
  const url = Linking.useURL();
  useEffect(() => {
    if (!url) return;
    const { access_token, refresh_token, error } = getSessionParamsFromUrl(url);
    if (error || !access_token || !refresh_token) return;
    WebBrowser.maybeCompleteAuthSession();
    supabase.auth.setSession({ access_token, refresh_token }).then(({ data }) => {
      if (data.session) {
        setSession(data.session);
        useBoxStore.getState().fetchUserBoxes();
      }
    });
  }, [url, setSession]);

  useEffect(() => {
    checkSession();
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
    return () => data.subscription.unsubscribe();
  }, [checkSession, setSession]);

  if (loading) {
    return null;
  }

  if (isAuthenticated) {
    return <Redirect href="/(tabs)/home" />;
  }

  return <Redirect href="/(auth)/login" />;
}
