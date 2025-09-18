// components/Auth.tsx
import React, { useEffect, useState } from 'react'
import {
    Alert,
    AppState,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native'
import { supabase } from '../lib/supabase'

export default function Auth() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  // Client-only: manage token refresh while app is active
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') supabase.auth.startAutoRefresh()
      else supabase.auth.stopAutoRefresh()
    })
    return () => sub.remove()
  }, [])

  async function signInWithEmail() {
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) Alert.alert(error.message)
    setLoading(false)
  }

  async function signUpWithEmail() {
    setLoading(true)
    const { data: { session }, error } = await supabase.auth.signUp({ email, password })
    if (error) Alert.alert(error.message)
    if (!session) Alert.alert('Please check your inbox for email verification!')
    setLoading(false)
  }

  return (
    <View style={styles.container}>
      <View style={[styles.verticallySpaced, styles.mt20]}>
        <Text style={styles.label}>Email</Text>
        <TextInput
          style={styles.input}
          keyboardType="email-address"
          autoCapitalize="none"
          value={email}
          onChangeText={setEmail}
          placeholder="email@address.com"
        />
      </View>

      <View style={styles.verticallySpaced}>
        <Text style={styles.label}>Password</Text>
        <TextInput
          style={styles.input}
          secureTextEntry
          autoCapitalize="none"
          value={password}
          onChangeText={setPassword}
          placeholder="Password"
        />
      </View>

      <View style={[styles.verticallySpaced, styles.mt20]}>
        <Pressable
          style={[styles.btn, loading && styles.btnDisabled]}
          onPress={signInWithEmail}
          disabled={loading}
        >
          <Text style={styles.btnText}>Sign in</Text>
        </Pressable>
      </View>

      <View style={styles.verticallySpaced}>
        <Pressable
          style={[styles.btn, loading && styles.btnDisabled]}
          onPress={signUpWithEmail}
          disabled={loading}
        >
          <Text style={styles.btnText}>Sign up</Text>
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
    borderWidth: 1, borderColor: '#ccc', borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 10,
  },
  btn: {
    backgroundColor: '#1e90ff', paddingVertical: 12, borderRadius: 8, alignItems: 'center',
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: 'white', fontWeight: '700' },
})
