import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import process from 'node:process'

export default defineConfig(({ mode }) => {
  // Preview deployments always use fictional in-memory data. Production keeps Firebase.
  const demo = mode === 'demo' || process.env.VERCEL_ENV === 'preview'
  const demoSdk = fileURLToPath(new URL('./src/demo/firebase.js', import.meta.url))
  return {
    plugins: [react(), {
      name: 'verify-demo-isolation',
      generateBundle(_, bundle) {
        if (!demo) return
        for (const chunk of Object.values(bundle)) {
          if (chunk.type === 'chunk' && Object.keys(chunk.modules).some(id => /node_modules\/(?:@firebase|firebase)\//.test(id))) {
            this.error('Demo builds must not include the real Firebase SDK.')
          }
        }
      },
    }],
    define: { 'import.meta.env.VITE_DEMO_MODE': JSON.stringify(demo) },
    resolve: { alias: demo ? [
      { find: /^firebase\/(app|auth|firestore)$/, replacement: demoSdk },
    ] : [] },
  }
})
