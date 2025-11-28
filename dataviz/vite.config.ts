import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'


export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: '/DataVizChallenge2025/',
  build: {
    reportCompressedSize: false, // skip brotli-size on 100MB assets to avoid long builds
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three', '@react-three/fiber', '@react-three/drei']
        }
      }
    }
  },
  server: {
    open: true
  }
})
