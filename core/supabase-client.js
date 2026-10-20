// core/supabase-client.js
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
const SUPABASE_URL = 'https://wfpopolzgxbglgmzjafg.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndmcG9wb2x6Z3hiZ2xnbXpqYWZnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkyMDg3MDUsImV4cCI6MjEwNDc4NDcwNX0.bU4l7Pn965id_moYgiQqk4tB6zBL-PNeIcdScNxzyKk';
export const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
// Initialize Supabase Client
export const db = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

// Utility Normalizers
export const cleanStr = (val) => String(val || '').trim();
export const cleanLower = (val) => String(val || '').trim().toLowerCase();