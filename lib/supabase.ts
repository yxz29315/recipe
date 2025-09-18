import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import 'react-native-url-polyfill/auto';

const supabaseUrl = "https://izwdlfckyfscsfubhcto.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml6d2RsZmNreWZzY3NmdWJoY3RvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTcyOTg5NjQsImV4cCI6MjA3Mjg3NDk2NH0.AJGXL4VKXC4E9qIvv2r1AdNnyPcF3gyngTXiG0tE1Cg";

// In-memory storage only during SSR (server renders web, no window)
const ssrMemoryStorage = {
  getItem: async (_key: string) => null as string | null,
  setItem: async (_key: string, _value: string) => {},
  removeItem: async (_key: string) => {},
}

const isSSR = Platform.OS === 'web' && typeof window === 'undefined'
const storage = isSSR ? ssrMemoryStorage : AsyncStorage

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage,                 // <-- use the SSR-safe storage here
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
})
