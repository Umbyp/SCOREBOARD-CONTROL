// firebase.js
import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyBUOuEb5MWvZg2BWka1RPn5Qy4WDSDSO3I",
  authDomain: "basketball-tournament-62372.firebaseapp.com",
  databaseURL: "https://basketball-tournament-62372-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "basketball-tournament-62372",
  storageBucket: "basketball-tournament-62372.firebasestorage.app",
  messagingSenderId: "330183213625",
  appId: "1:330183213625:web:573c280cb9eb1377cec3e8",
  measurementId: "G-7TXBRXF51K",
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);