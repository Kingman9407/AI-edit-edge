"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useFirebaseAuth } from "@/app/context/FirebaseAuthContext";
import { signInWithPopup } from "firebase/auth";
import { auth, googleProvider } from "@/app/lib/firebase";
import { BackgroundMarquee } from "./components/BackgroundMarquee";
import { LoginForm } from "./components/LoginForm";
import { LoginDescription } from "./components/LoginDescription";

// Debug logging is only active in development — stripped from production builds
const isDev = process.env.NODE_ENV === "development";
const dbg = isDev ? console.log.bind(console) : () => { };
const dbgGroup = isDev ? console.group.bind(console) : () => { };
const dbgGroupEnd = isDev ? console.groupEnd.bind(console) : () => { };
const dbgError = isDev ? console.error.bind(console) : () => { };

export default function LoginPage() {
    const router = useRouter();
    const { user, loading } = useFirebaseAuth();
    const [googleLoading, setGoogleLoading] = useState(false);
    const [loginError, setLoginError] = useState<{ code: string; message: string; fullError: string } | null>(null);

    useEffect(() => {
        dbg(`[LoginPage] Auth state changed — loading: ${loading}, user: ${user ? user.email : 'none'}`);
        if (!loading && user) {
            dbg("[LoginPage] ✅ User authenticated, redirecting to /projects");
            router.replace("/projects");
        }
    }, [user, loading, router]);

    function handleGoogleLogin() {
        dbgGroup("[LoginPage] 🔐 handleGoogleLogin");
        dbg("  auth.app.name:", auth.app.name);
        dbg("  auth.app.options.authDomain:", (auth.app.options as any).authDomain);
        dbg("  googleProvider.providerId:", googleProvider.providerId);
        dbg("  current URL:", window.location.href);
        dbgGroupEnd();

        setLoginError(null);
        setGoogleLoading(true);
        dbg("[LoginPage] Calling signInWithPopup …");

        signInWithPopup(auth, googleProvider)
            .then((result) => {
                dbg("[LoginPage] ✅ Popup result success, user:", result.user.email);
                // No need to setGoogleLoading(false) because the useEffect will redirect to /projects
            })
            .catch((error: any) => {
                dbgGroup("[LoginPage] ❌ signInWithPopup FAILED");
                dbg("  code:", error?.code);
                dbg("  message:", error?.message);
                dbgGroupEnd();
                
                // If the user just closed the popup, don't show a big error
                if (error?.code !== 'auth/popup-closed-by-user') {
                    setLoginError({
                        code: error?.code ?? "unknown",
                        message: isDev ? (error?.message ?? "Unknown error") : "Sign-in failed. Please try again.",
                        fullError: isDev ? JSON.stringify({ code: error?.code, message: error?.message, customData: error?.customData }, null, 2) : "",
                    });
                }
                setGoogleLoading(false);
            });
    }

    // Don't render until auth state is ready
    if (loading) return null;

    return (
        <div className="min-h-screen w-full bg-black flex flex-col md:flex-row-reverse relative overflow-hidden text-white font-sans">
            <style dangerouslySetInnerHTML={{
                __html: `
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap');
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}} />

            <BackgroundMarquee />
            <LoginForm 
                googleLoading={googleLoading} 
                loginError={loginError} 
                onGoogleLogin={handleGoogleLogin} 
                onDismissError={() => setLoginError(null)} 
            />
            <LoginDescription />
        </div>
    );
}
