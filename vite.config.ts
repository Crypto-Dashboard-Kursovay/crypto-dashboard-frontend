import { defineConfig } from 'vite'
import path from 'path'
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'


function figmaAssetResolver() {
  return {
    name: 'figma-asset-resolver',
    resolveId(id: string) {
      if (id.startsWith('figma:asset/')) {
        const filename = id.replace('figma:asset/', '')
        return path.resolve(__dirname, 'src/assets', filename)
      }
      return undefined
    },
  }
}

function getGitCommit(): string {
  // В CI прокидываем через build-arg → ENV (VITE_GIT_COMMIT). Локально читаем git напрямую.
  const envCommit = process.env.VITE_GIT_COMMIT
  if (envCommit) return envCommit.slice(0, 7)
  try {
    return execSync('git rev-parse --short HEAD', {
      cwd: __dirname,
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .toString()
      .trim()
  } catch {
    return 'dev'
  }
}

function getAppVersion(): string {
  try {
    const pkg = JSON.parse(readFileSync(path.resolve(__dirname, 'package.json'), 'utf8'))
    return pkg.version ?? '0.0.0'
  } catch {
    return '0.0.0'
  }
}

export default defineConfig({
  plugins: [
    figmaAssetResolver(),
    // The React and Tailwind plugins are both required for Make, even if
    // Tailwind is not being actively used – do not remove them
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      // Alias @ to the src directory
      '@': path.resolve(__dirname, './src'),
    },
  },

  // File types to support raw imports. Never add .css, .tsx, or .ts files to this.
  assetsInclude: ['**/*.svg', '**/*.csv'],

  define: {
    __GIT_COMMIT__: JSON.stringify(getGitCommit()),
    __APP_VERSION__: JSON.stringify(getAppVersion()),
    __BUILD_DATE__: JSON.stringify(new Date().toISOString().slice(0, 10)),
  },
})
