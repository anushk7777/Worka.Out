import { createClient } from '@supabase/supabase-js';

// Provided credentials
const SUPABASE_URL = "https://zjolmyhiincfpjojetov.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_XTuiXlLajNXt1SGRBe3w-w_e0ILaPJ7";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);