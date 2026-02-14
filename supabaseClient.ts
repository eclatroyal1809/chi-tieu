
import { createClient } from '@supabase/supabase-js';

// Fallback values must be valid URLs to prevent 'createClient' from throwing immediately.
// Replace these with your actual project URL and Anon Key.
const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL || 'https://lldxgjbbwoxoiavpthgu.supabase.co';
const SUPABASE_ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxsZHhnamJid294b2lhdnB0aGd1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEwMDM4MDcsImV4cCI6MjA4NjU3OTgwN30.hdazR2Lgl_kVUuuzym1DL36n9Z6Jl3FkaWU9lVrcZUU';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
