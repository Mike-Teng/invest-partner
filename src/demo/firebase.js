// Build-time replacement for the Firebase SDK in demo builds only.
// All changes live in this tab's memory; this module has no network or storage API.
import { createDemoDocuments, demoEmail } from './fixtures.js';
let documents = createDemoDocuments();
const listeners = new Set();
const authListeners = new Set();
const demoUser = { uid: 'demo', email: demoEmail, displayName: 'Demo account' };
let currentUser = demoUser;
const copy = value => value === undefined ? undefined : structuredClone(value);
const reference = (kind, parent, path) => ({ kind, path: [parent?.path, ...path].filter(Boolean).join('/') });
export const initializeApp = () => ({});
export const getFirestore = () => ({});
export const getAuth = () => ({});
export class GoogleAuthProvider {}
export const collection = (parent, ...path) => reference('collection', parent, path);
export const doc = (parent, ...path) => reference('document', parent, path);
export const orderBy = (field, direction) => ({ field, direction });
export const query = (ref, order) => ({ ...ref, order });
function documentSnapshot(path) {
  const data = copy(documents[path]);
  return { id: path.split('/').at(-1), ref: { kind: 'document', path }, exists: () => data !== undefined, data: () => copy(data) };
}
function snapshot(ref) {
  if (ref.kind !== 'collection') return documentSnapshot(ref.path);
  let docs = Object.keys(documents).filter(path => path.startsWith(`${ref.path}/`) && path.split('/').length === ref.path.split('/').length + 1).map(documentSnapshot);
  if (ref.order) docs = docs.sort((a, b) => (a.data()[ref.order.field] - b.data()[ref.order.field]) * (ref.order.direction === 'desc' ? -1 : 1));
  return { docs, forEach: callback => docs.forEach(callback) };
}
function notify() { for (const listener of listeners) listener.callback(snapshot(listener.ref)); }
export function onSnapshot(ref, callback) {
  const listener = { ref, callback }; listeners.add(listener);
  queueMicrotask(() => { if (listeners.has(listener)) callback(snapshot(ref)); });
  return () => listeners.delete(listener);
}
export function onAuthStateChanged(_, callback) {
  authListeners.add(callback);
  queueMicrotask(() => { if (authListeners.has(callback)) callback(currentUser); });
  return () => authListeners.delete(callback);
}
export async function signInWithPopup() { currentUser = demoUser; authListeners.forEach(callback => callback(currentUser)); }
export async function signOut() { currentUser = null; authListeners.forEach(callback => callback(null)); }
export const getDocFromServer = async ref => snapshot(ref);
export const getDocsFromServer = getDocFromServer;
export const getDocs = getDocFromServer;
export const serverTimestamp = () => Date.now();
export const arrayUnion = value => ({ operation: 'union', value });
export const arrayRemove = value => ({ operation: 'remove', value });
function set(ref, input, options) {
  const data = options?.merge ? { ...documents[ref.path] } : {};
  for (const [key, value] of Object.entries(input)) {
    if (value?.operation === 'union') data[key] = [...new Set([...(documents[ref.path]?.[key] || []), value.value])];
    else if (value?.operation === 'remove') data[key] = (documents[ref.path]?.[key] || []).filter(item => item !== value.value);
    else data[key] = copy(value);
  }
  documents[ref.path] = data;
}
export async function setDoc(ref, data, options) { set(ref, data, options); notify(); }
export const updateDoc = (ref, data) => setDoc(ref, data, { merge: true });
export function writeBatch() {
  const paths = [];
  return { delete: ref => paths.push(ref.path), commit: async () => { paths.forEach(path => delete documents[path]); notify(); } };
}
export async function runTransaction(_, callback) {
  const writes = [];
  const result = await callback({ get: async ref => snapshot(ref),
    set: (ref, data) => writes.push(() => set(ref, data)), delete: ref => writes.push(() => delete documents[ref.path]) });
  if (writes.length) { writes.forEach(write => write()); notify(); }
  return result;
}
