const fields = {
  apiKey: 'VITE_FIREBASE_API_KEY',
  authDomain: 'VITE_FIREBASE_AUTH_DOMAIN',
  projectId: 'VITE_FIREBASE_PROJECT_ID',
  storageBucket: 'VITE_FIREBASE_STORAGE_BUCKET',
  messagingSenderId: 'VITE_FIREBASE_MESSAGING_SENDER_ID',
  appId: 'VITE_FIREBASE_APP_ID',
  measurementId: 'VITE_FIREBASE_MEASUREMENT_ID',
};

const required = ['apiKey', 'authDomain', 'projectId', 'appId'];

// Runs in Vite's build configuration, not in the browser.
export function getFirebaseConfig(env, { demo = false } = {}) {
  if (demo) {
    return {
      apiKey: 'demo-api-key',
      authDomain: 'demo.invalid',
      projectId: 'investpartner-demo',
      appId: 'demo-app',
    };
  }

  const config = {};
  for (const [field, variable] of Object.entries(fields)) {
    const value = env[variable]?.trim();
    if (value) config[field] = value;
  }

  const missing = required.filter(field => !config[field]).map(field => fields[field]);
  if (missing.length) {
    throw new Error(`Missing Firebase environment variables: ${missing.join(', ')}. Set them in Vercel or .env.local; use npm run dev:demo for fictional data.`);
  }
  return config;
}
