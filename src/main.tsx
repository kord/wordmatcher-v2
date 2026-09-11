import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import './ui/tokens.css'
import './ui/reset.css'
// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
    apiKey: "AIzaSyDrdv8KsWE9LrdYR-J7tPJ_AgjXmtyujAA",
    authDomain: "wordmatcher-v2.firebaseapp.com",
    projectId: "wordmatcher-v2",
    storageBucket: "wordmatcher-v2.firebasestorage.app",
    messagingSenderId: "617974229742",
    appId: "1:617974229742:web:474e9445b6c190a88de1ff",
    measurementId: "G-G8ZNHHS7LM"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
// Started for its side effect only - the handle is never read, and `noUnusedLocals`
// rejects an unused binding.
void getAnalytics(app);

const container = document.getElementById('root')
if (!container) throw new Error('Root element #root is missing from index.html')

createRoot(container).render(
    <StrictMode>
        <App />
    </StrictMode>,
)
