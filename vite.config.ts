
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiKey = env.API_KEY || process.env.API_KEY || '';
  
  return {
    plugins: [react()],
    define: {
      // 同时定义 process.env.API_KEY 和全局常量，增加兼容性
      'process.env.API_KEY': JSON.stringify(apiKey),
      '__API_KEY__': JSON.stringify(apiKey)
    },
    server: {
      host: true
    },
    build: {
      outDir: 'dist',
      sourcemap: mode === 'development'
    }
  };
});
