import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SUPABASE_URL = 'https://lljsnoovwvxebzbaal.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'Sb_publishable_NYNyvl3svSrRKskmUfDJGQ_Iq3PCOTt';

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
