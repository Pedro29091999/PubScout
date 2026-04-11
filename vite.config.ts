import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  
  // Prioritize process.env (real secrets) over env (which might pick up placeholders from .env.example)
  const geminiKey = process.env.GEMINI_API_KEY || (env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY' ? env.GEMINI_API_KEY : '') || '';

  return {
    base: './',
    plugins: [react(), tailwindcss()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(geminiKey),
      'import.meta.env.VITE_GEMINI_API_KEY': JSON.stringify(geminiKey),
      'process.env.APP_URL': JSON.stringify(env.APP_URL || process.env.APP_URL || ''),
      'global': 'window',
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
