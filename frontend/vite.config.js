import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'ClaimCheck',
        short_name: 'ClaimCheck',
        description: 'Verified lost & found for campuses, airports, and stations.',
        theme_color: '#1f3a2e',
        background_color: '#1f3a2e', // splash screen while the installed app opens, matches the sign-in screen
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        navigateFallback: '/index.html',
        runtimeCaching: [{
          urlPattern: ({ url }) => url.pathname.startsWith('/api/'),
          handler: 'NetworkOnly',
        }],
      },
    }),
  ],
  server: {
    // changeOrigin sends Django a Host it already allows, even when the page is opened through a phone tunnel.
    proxy: { '/api': { target: 'http://127.0.0.1:8000', changeOrigin: true } }, // avoids CORS in dev
    // Tunnels for testing on a phone over HTTPS (see README): Cloudflare quick tunnels and ngrok's permanent free domain.
    allowedHosts: ['.trycloudflare.com', '.ngrok-free.app', '.ngrok-free.dev'],
  },
})
