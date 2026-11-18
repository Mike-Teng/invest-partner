import test from 'node:test';
import assert from 'node:assert/strict';
import { getFirebaseConfig } from '../config/firebase.js';

const env = {
  VITE_FIREBASE_API_KEY: 'test-public-key',
  VITE_FIREBASE_AUTH_DOMAIN: 'test-project.firebaseapp.com',
  VITE_FIREBASE_PROJECT_ID: 'test-project',
  VITE_FIREBASE_APP_ID: '1:123:web:test',
  VITE_FIREBASE_STORAGE_BUCKET: 'test-project.firebasestorage.app',
  VITE_FIREBASE_MESSAGING_SENDER_ID: '123',
  VITE_FIREBASE_MEASUREMENT_ID: 'G-TEST',
};

test('build config preserves the configured Firebase app and ignores unrelated secrets', () => {
  assert.deepEqual(getFirebaseConfig({ ...env, PRIVATE_KEY: 'never-export' }), {
    apiKey: 'test-public-key', authDomain: 'test-project.firebaseapp.com',
    projectId: 'test-project', appId: '1:123:web:test',
    storageBucket: 'test-project.firebasestorage.app',
    messagingSenderId: '123', measurementId: 'G-TEST',
  });
});

test('missing login or project settings stop the build without exposing values', () => {
  for (const key of ['VITE_FIREBASE_API_KEY', 'VITE_FIREBASE_AUTH_DOMAIN', 'VITE_FIREBASE_PROJECT_ID', 'VITE_FIREBASE_APP_ID']) {
    assert.throws(() => getFirebaseConfig({ ...env, [key]: '  ' }), error => {
      assert.ok(error.message.includes(key));
      assert.ok(!error.message.includes(env.VITE_FIREBASE_API_KEY));
      return true;
    });
  }
});

test('optional Firebase products do not prevent Auth and Firestore from starting', () => {
  const config = getFirebaseConfig({ ...env, VITE_FIREBASE_MEASUREMENT_ID: '', VITE_FIREBASE_STORAGE_BUCKET: undefined, VITE_FIREBASE_MESSAGING_SENDER_ID: '' });
  assert.equal(config.projectId, env.VITE_FIREBASE_PROJECT_ID);
  assert.equal(config.authDomain, env.VITE_FIREBASE_AUTH_DOMAIN);
  assert.ok(!('measurementId' in config));
  assert.ok(!('storageBucket' in config));
  assert.ok(!('messagingSenderId' in config));
});

test('isolated previews need no configuration and cannot inherit live project values', () => {
  assert.deepEqual(getFirebaseConfig({}, { demo: true }), getFirebaseConfig(env, { demo: true }));
  assert.equal(getFirebaseConfig(env, { demo: true }).projectId, 'investpartner-demo');
});
