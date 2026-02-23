// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getDatabase } from "firebase/database"; // เพิ่มอันนี้
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBUOuEb5MWvZg2BWka1RPn5Qy4WDSDSO3I",
  authDomain: "basketball-tournament-62372.firebaseapp.com",
  databaseURL: "https://basketball-tournament-62372-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "basketball-tournament-62372",
  storageBucket: "basketball-tournament-62372.firebasestorage.app",
  messagingSenderId: "330183213625",
  appId: "1:330183213625:web:573c280cb9eb1377cec3e8",
  measurementId: "G-7TXBRXF51K"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
export const db = getDatabase(app); // Export db ออกไปใช้