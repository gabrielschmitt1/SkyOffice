import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    minify: 'terser',
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          phaser: ['phaser'],
          colyseus: ['colyseus.js'],
          mui: ['@mui/material', '@mui/icons-material']
        }
      }
    }
  },
  define: {
    // Configurar URL do servidor para produção
    'process.env.VITE_SERVER_URL': JSON.stringify(process.env.VITE_SERVER_URL || 'wss://skyoffice-server.your-subdomain.workers.dev')
  },
  server: {
    port: 5173,
    host: true
  },
  preview: {
    port: 4173,
    host: true
  }
})
