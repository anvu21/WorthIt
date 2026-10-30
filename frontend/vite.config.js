import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Served from the oil project's CloudFront at /worthit/ — see CLAUDE.md.
export default defineConfig({
  base: '/worthit/',
  plugins: [react()],
  server: { port: 5174 },
})
