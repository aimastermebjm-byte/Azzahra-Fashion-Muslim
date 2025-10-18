import { createClient } from '@supabase/supabase-js'
import { supabaseUrl, supabaseAnonKey } from '../config/supabase'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)