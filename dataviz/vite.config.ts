import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Use a relative base so bundled assets, public files (images/geojson) and the app
  // itself resolve correctly regardless of the hosting path (local file preview,
  // custom domains, GitHub Pages, etc.).
  base: './',
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
