import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'TabHub',
        short_name: 'TabHub',
        description: 'Restaurant ordering & management',
        theme_color: '#18181b',
        background_color: '#18181b',
        display: 'standalone',
        orientation: 'any',
        start_url: '/',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
      workbox: {
        // Cache API responses for the public menu (offline fallback)
        runtimeCaching: [
          {
            urlPattern: /\/menu$/,
            handler: 'NetworkFirst',
            options: { cacheName: 'public-menu' },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: { '@': '/src' },
  },
})
