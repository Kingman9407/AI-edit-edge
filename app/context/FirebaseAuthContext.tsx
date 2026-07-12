"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "@/app/lib/firebase";

const isDev = process.env.NODE_ENV === "development";
const dbg = isDev ? console.log.bind(console) : () => {};

interface AuthContextType {
  user: User | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({ user: null, loading: true });

export function FirebaseAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    dbg("[FirebaseAuthProvider] Mounting — registering onAuthStateChanged listener");
    dbg("[FirebaseAuthProvider] auth.currentUser at mount time:", auth.currentUser?.email ?? "null");

    const unsubscribe = onAuthStateChanged(
      auth,
      (currentUser) => {
        dbg(
          "[FirebaseAuthProvider] onAuthStateChanged fired:",
          currentUser
            ? `user = ${currentUser.email} (uid=${currentUser.uid})`
            : "user = null (signed out)"
        );
        setUser(currentUser);
        setLoading(false);
        dbg("[FirebaseAuthProvider] loading set to false, user set to:", currentUser?.email ?? "null");
      },
      (error) => {
        console.error("[FirebaseAuthProvider] onAuthStateChanged ERROR:", error);
        setLoading(false);
      }
    );

    return () => {
      dbg("[FirebaseAuthProvider] Unmounting — unsubscribing auth listener");
      unsubscribe();
    };
  }, []);

  dbg("[FirebaseAuthProvider] render — loading:", loading, "user:", user?.email ?? "null");

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useFirebaseAuth() {
  return useContext(AuthContext);
}
