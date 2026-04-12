import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  
  // Use the secret from process.env (injected by AI Studio)
  const geminiKey = process.env.GEMINI_API_KEY || '';
  
  if (!geminiKey && mode === 'production') {
    console.error('\x1b[31m%s\x1b[0m', '---------------------------------------------------------');
    console.error('\x1b[31m%s\x1b[0m', 'FATAL ERROR: GEMINI_API_KEY is missing from environment!');
    console.error('\x1b[31m%s\x1b[0m', 'The build will produce a broken app. Check AI Studio Secrets.');
    console.error('\x1b[31m%s\x1b[0m', '---------------------------------------------------------');
    // We don't throw here to avoid breaking the agent's flow, but we log it clearly.
  }

  const buildId = "FINAL_SYNC_V1";
  console.log('--- VITE BUILD ---');
  console.log('Build ID:', buildId);
  console.log('Key Length:', geminiKey.length);
  console.log('------------------');

  return {
    base: './',
    plugins: [react(), tailwindcss()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(geminiKey),
      'import.meta.env.VITE_GEMINI_API_KEY': JSON.stringify(geminiKey),
      'import.meta.env.VITE_BUILD_ID': JSON.stringify(buildId),
      'process.env.APP_URL': JSON.stringify(env.APP_URL || process.env.APP_URL || ''),
      'window.GEMINI_API_KEY': JSON.stringify(geminiKey),
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
