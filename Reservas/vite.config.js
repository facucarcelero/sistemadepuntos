import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: 'index.html',
        admin: 'admin.html',
        success: 'success.html',
        test: 'test.html',
        testNotifications: 'test-notifications.html'
      }
    }
  },
  server: {
    port: 3000,
    open: true
  }
}) 