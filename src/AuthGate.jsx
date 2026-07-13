// AuthGate.jsx — gates operator screens behind Firebase Auth
import { useState, useEffect, cloneElement } from "react";
import { auth } from "./firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import Login from "./Login";
import { c, font } from "./theme";

export default function AuthGate({ children }) {
  const [user, setUser] = useState(undefined); // undefined = loading, null = signed out
  useEffect(() => onAuthStateChanged(auth, setUser), []);

  if (user === undefined) {
    return (
      <div style={{ minHeight: "100vh", background: c.bg, color: c.mute, display: "flex",
        alignItems: "center", justifyContent: "center", fontFamily: font.body, fontSize: 13,
        letterSpacing: "0.1em" }}>
        กำลังโหลด…
      </div>
    );
  }

  if (!user) return <Login />;

  return cloneElement(children, { user, uid: user.uid, onSignOut: () => signOut(auth) });
}
