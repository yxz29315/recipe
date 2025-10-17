import { Session } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from "react-native";
import { supabase } from "../lib/supabase";
import { useRouter } from "expo-router";

export default function OnboardingScreen() {
  const [session, setSession] = useState<Session | null>(null);
  const [allergies, setAllergies] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
      if (!session) router.replace("/");
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (!session) router.replace("/");
    });

    return () => subscription.unsubscribe();
  }, []);

  const save = async () => {
    if (!session?.user) return;
    const normalized = allergies
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
      .join(", ");

    if (!normalized) {
      Alert.alert("Please enter at least one allergy or go back to skip.");
      return;
    }

    try {
      setSaving(true);
      const updates = {
        id: session.user.id,
        allergies: normalized,
        onboarding_dismissed: true,
        updated_at: new Date().toISOString(),
      };
      const { error } = await supabase.from("profiles").upsert(updates);
      if (error) throw error;
      router.replace("/");
    } catch (e: any) {
      Alert.alert(e?.message ?? "Failed to save allergies");
    } finally {
      setSaving(false);
    }
  };

  const skip = async () => {
    try {
      setSaving(true);
      if (!session?.user) {
        router.replace("/");
        return;
      }
      const updates = {
        id: session.user.id,
        onboarding_dismissed: true,
        updated_at: new Date().toISOString(),
      };
      const { error } = await supabase.from('profiles').upsert(updates);
      if (error) throw error;
      router.replace("/");
    } catch (e: any) {
      Alert.alert(e?.message ?? 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}> 
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome! Any allergies?</Text>
      <Text style={styles.p}>Enter comma-separated items, e.g. "peanuts, gluten".</Text>
      <TextInput
        style={styles.input}
        value={allergies}
        onChangeText={setAllergies}
        autoCapitalize="none"
        placeholder="e.g. peanuts, gluten"
      />
      <TouchableOpacity style={styles.btn} onPress={save} disabled={saving}>
        {saving ? <ActivityIndicator color="#fff"/> : <Text style={styles.btnText}>Save and Continue</Text>}
      </TouchableOpacity>
      <TouchableOpacity style={styles.linkBtn} onPress={skip}> 
        <Text style={styles.link}>Skip</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, justifyContent: "center" },
  title: { fontSize: 26, fontWeight: "700", marginBottom: 10, textAlign: "center" },
  p: { fontSize: 16, marginBottom: 12, textAlign: "center" },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
  btn: { backgroundColor: "#007AFF", padding: 14, borderRadius: 10, alignItems: "center" },
  btnText: { color: "white", fontWeight: "bold", fontSize: 16 },
  linkBtn: { marginTop: 10, alignItems: "center" },
  link: { color: "#007AFF", fontWeight: "600" },
});
