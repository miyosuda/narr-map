import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // Run test in the browser environment
    environment: 'happy-dom'
  }
})
