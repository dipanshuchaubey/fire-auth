// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCbGP2ZqwkT78fwIfTnuYYGXujIfCs7idM",
  authDomain: "carthage-fire.firebaseapp.com",
  projectId: "carthage-fire",
  storageBucket: "carthage-fire.firebasestorage.app",
  messagingSenderId: "294294197391",
  appId: "1:294294197391:web:97b57de803b2d0a791ccfa",
  measurementId: "G-TYRCKSNZD2"
};

// Initialize Firebase
import { getApps, getApp } from "firebase/app";

export const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const analytics = typeof window !== 'undefined' ? getAnalytics(app) : null;