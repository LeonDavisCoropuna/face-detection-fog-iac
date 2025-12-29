
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { CONFIG, isConfigLoaded } from './config';

// Inicializamos Firebase con los valores del archivo config.ts
const app = initializeApp(CONFIG.firebase);

export const auth = getAuth(app);
export const db = getFirestore(app, CONFIG.firebase.databaseId);
export const storage = getStorage(app);
export const isConfigured = isConfigLoaded();

export default app;
