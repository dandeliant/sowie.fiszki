'use strict';
// ═══════════════════════════════════════════════════════════════
//  SOWIE FISZKI — Konfiguracja Supabase
//
//  UZUPEŁNIJ poniższe dane z Supabase Dashboard:
//    Project Settings → API → Project URL & anon/public key
// ═══════════════════════════════════════════════════════════════

const SUPABASE_URL      = 'https://kofenaaeleyhwhbkytcz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtvZmVuYWFlbGV5aHdoYmt5dGN6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU5MzM0NzMsImV4cCI6MjA5MTUwOTQ3M30.z0pzToDoK8NAEiyuKxeXhXnMvzEr5pfJjU7n6ActTU0';

// Klient Supabase (używany przez db.js oraz strony logowania/rejestracji)
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    // Supabase przechowuje sesję w localStorage pod kluczem sb-*
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false
  }
});
