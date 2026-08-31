import { createClient } from '@supabase/supabase-js';

// Provided credentials
const SUPABASE_URL = "https://zjolmyhiincfpjojetov.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpqb2xteWhpaW5jZnBqb2pldG92Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU1MTY2NzYsImV4cCI6MjA4MTA5MjY3Nn0.kJJnpenjMdQsPXEq_56w9qyKK0TMENFEceZqlDLpxGA";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);