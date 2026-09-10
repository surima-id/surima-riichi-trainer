import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    environment: 'node',
    // The generator sweeps run every drill across 120 seeds in both languages,
    // and the efficiency drill ranks every discard of every hand.
    testTimeout: 60000,
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
})
