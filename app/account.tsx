
import { Session } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import Account from "../components/Account";
import { supabase } from "../lib/supabase";
import { useRouter } from "expo-router";

export default function AccountScreen() {
  const [session, setSession] = useState<Session | null>(null);
  const [hasLoadedSession, setHasLoadedSession] = useState(false);
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setHasLoadedSession(true);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      // If the user just signed out, navigate away.
      if (!session || event === 'SIGNED_OUT') {
        router.replace('/');
      }
      setHasLoadedSession(true);
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <View>
      {session && session.user ? (
        <Account key={session.user.id} session={session} />
      ) : hasLoadedSession ? (
        <Text>Loading...</Text>
      ) : (
        <Text>Loading...</Text>
      )}
    </View>
  );
}
