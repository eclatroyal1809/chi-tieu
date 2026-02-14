
import { createClient } from '@supabase/supabase-js';

// Helper function to safely get environment variables without crashing in browser
const getEnv = (key: string) => {
  try {
    // Check for Vite (import.meta.env)
    // @ts-ignore
    if (typeof import.meta !== 'undefined' && import.meta.env) {
      // @ts-ignore
      return import.meta.env[key] || import.meta.env[`VITE_${key}`];
    }
    // Check for Node/CRA (process.env)
    if (typeof process !== 'undefined' && process.env) {
      return process.env[key];
    }
  } catch (e) {
    // Ignore errors in environments where these are restricted
  }
  return undefined;
};

// Fallback values must be valid URLs to prevent 'createClient' from throwing immediately.
// We prioritize environment variables, but fall back to the provided hardcoded values.
const SUPABASE_URL = getEnv('REACT_APP_SUPABASE_URL') || 'https://lldxgjbbwoxoiavpthgu.supabase.co';
const SUPABASE_ANON_KEY = getEnv('REACT_APP_SUPABASE_ANON_KEY') || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxsZHhnamJid294b2lhdnB0aGd1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEwMDM4MDcsImV4cCI6MjA4NjU3OTgwN30.hdazR2Lgl_kVUuuzym1DL36n9Z6Jl3FkaWU9lVrcZUU';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
