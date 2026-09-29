/**
 * Initialisation Firebase — SDK modulaire (ESM) chargé depuis le CDN officiel.
 * Cache Firestore persistant (IndexedDB) partagé entre onglets : hors ligne,
 * latence et multi-onglets sont gérés par le SDK.
 *
 * Mode émulateur (tests locaux uniquement) : http://localhost:<port>/?emu
 */
export const SDK = 'https://www.gstatic.com/firebasejs/12.19.0/';

const [appMod, authMod, fsMod] = await Promise.all([
    import(SDK + 'firebase-app.js'),
    import(SDK + 'firebase-auth.js'),
    import(SDK + 'firebase-firestore.js')
]);

export const EMULATOR = ['localhost', '127.0.0.1'].includes(location.hostname)
    && new URLSearchParams(location.search).has('emu');

/* global FIREBASE_CONFIG — défini dans index.html */
const config = EMULATOR ? { ...FIREBASE_CONFIG, projectId: 'demo-lisa' } : FIREBASE_CONFIG;

export const app = appMod.initializeApp(config);
export const auth = authMod.getAuth(app);
export const db = fsMod.initializeFirestore(app, {
    localCache: fsMod.persistentLocalCache({ tabManager: fsMod.persistentMultipleTabManager() })
});

if (EMULATOR) {
    authMod.connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });
    fsMod.connectFirestoreEmulator(db, 'localhost', 8080);
}

export { authMod, fsMod };
