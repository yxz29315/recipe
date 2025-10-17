import type { Session } from '@supabase/supabase-js'
import { useEffect, useState } from 'react'
import {
    ActivityIndicator,
    Alert,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native'
import { supabase } from '../lib/supabase'

export default function Account({ session }: { session: Session }) {
  const [loading, setLoading] = useState(true)
  const [allergies, setAllergies] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')

  useEffect(() => {
    if (session) getProfile()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session])

  async function getProfile() {
    try {
      setLoading(true)
      if (!session?.user) throw new Error('No user on the session!')

      const { data, error, status } = await supabase
        .from('profiles')
        .select('allergies, avatar_url')
        .eq('id', session.user.id)
        .single()

      if (error && status !== 406) throw error

      if (data) {
        setAllergies(data.allergies ?? '')
        setAvatarUrl(data.avatar_url ?? '')
      }
    } catch (err) {
      if (err instanceof Error) Alert.alert(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function updateProfile({
    allergies,
    avatar_url,
  }: {
    allergies: string
    avatar_url: string
  }) {
    try {
      setLoading(true)
      if (!session?.user) throw new Error('No user on the session!')

      const updates = {
        id: session.user.id,
        allergies,
        avatar_url,
        updated_at: new Date().toISOString(),
      }

      const { error } = await supabase.from('profiles').upsert(updates)
      if (error) throw error
    } catch (err) {
      if (err instanceof Error) Alert.alert(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.verticallySpaced}>
        <Text style={styles.label}>Allergies</Text>
        <TextInput
          style={styles.input}
          value={allergies}
          onChangeText={setAllergies}
          autoCapitalize="none"
          placeholder="e.g. peanuts, gluten"
        />
      </View>

      <View style={styles.verticallySpaced}>
      </View>

      <View style={[styles.verticallySpaced, styles.mt20]}>
        <Pressable
          style={[styles.btn, loading && styles.btnDisabled]}
          onPress={() => updateProfile({ allergies, avatar_url: avatarUrl })}
          disabled={loading}
        >
          {loading ? <ActivityIndicator /> : <Text style={styles.btnText}>Update</Text>}
        </Pressable>
      </View>

      <View style={styles.verticallySpaced}>
        <Pressable style={styles.btnSecondary} onPress={() => supabase.auth.signOut()}>
          <Text style={styles.btnSecondaryText}>Sign Out</Text>
        </Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { marginTop: 40, padding: 12 },
  verticallySpaced: { paddingTop: 4, paddingBottom: 4, alignSelf: 'stretch' },
  mt20: { marginTop: 20 },
  label: { marginBottom: 6, fontWeight: '600' },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  inputDisabled: { backgroundColor: '#f2f2f2' },
  btn: {
    backgroundColor: '#1e90ff',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: 'white', fontWeight: '700' },
  btnSecondary: {
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1e90ff',
  },
  btnSecondaryText: { color: '#1e90ff', fontWeight: '700' },
})
