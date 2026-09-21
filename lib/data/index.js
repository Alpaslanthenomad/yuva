// lib/data/index.js — tek giriş noktası. Env varsa Supabase, yoksa demo.
import { hasSupabase } from '../supabase.js';
import makeDemoRepo from './demoRepo.js';
import makeSupabaseRepo from './supabaseRepo.js';

let repo = null;
/** @returns {import('./contract.js').Repo} */
export function getRepo() {
  if (!repo) repo = hasSupabase ? makeSupabaseRepo() : makeDemoRepo();
  return repo;
}
