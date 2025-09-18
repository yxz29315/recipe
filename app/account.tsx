
import { Session } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import Account from "../components/Account";
import { supabase } from "../lib/supabase";
import { useRouter } from "expo-router";

export default function AccountScreen() {
  const [session, setSession] = useState<Session | null>(null);
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <View>
      {session && session.user ? (
        <Account key={session.user.id} session={session} />
      ) : (
        <Text>Loading...</Text>
      )}
    </View>
  );
}
