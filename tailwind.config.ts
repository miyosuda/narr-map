import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      fontFamily: {
        hiragino: ['"ヒラギノ角ゴ Pro W3"', '"Hiragino Kaku Gothic Pro"', 'sans-serif']
      }
    }
  },
  plugins: []
}
export default config
