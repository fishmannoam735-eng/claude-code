/// <reference types="vite/client" />
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY: string;
  /** 'hash' builds a self-contained bundle for hosts with no path rewriting. */
  readonly VITE_ROUTER?: 'hash' | 'path';
}
