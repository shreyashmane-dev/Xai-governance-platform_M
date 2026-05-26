import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyByt0G9K6f8sFUdRWJcBe_rwC_l6RTgwb8',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'e-commerce-dfd65.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'e-commerce-dfd65',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'e-commerce-dfd65.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '1040687151295',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:1040687151295:web:ccfe7470bbe2e4fc926e0a',
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || 'G-22CQ29FCKB',
}

const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
