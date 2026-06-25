"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { login, loginWithGoogle } from "@/app/ui/lib/auth";
import { useAuth } from "@/app/ui/context/AuthContext";

export default function LoginPage() {
  const router = useRouter();
  const { user, loading, setUser } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  // Redirect if already logged in
  useEffect(() => {
    if (!loading && user) {
      router.replace("/projects");
    }
  }, [user, loading, router]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setIsLoading(true);
    // Simulate network delay
    await new Promise((r) => setTimeout(r, 600));
    const result = login(email, password);
    setIsLoading(false);
    if ("error" in result) {
      setError(result.error);
    } else {
      setUser(result.user);
      router.push("/projects");
    }
  }

  async function handleGoogleLogin() {
    setGoogleLoading(true);
    await new Promise((r) => setTimeout(r, 900));
    const user = loginWithGoogle();
    setUser(user);
    setGoogleLoading(false);
    router.push("/projects");
  }

  if (loading) return null;

  return (
    <div style={styles.root}>
      {/* Animated background */}
      <div style={styles.bgOrb1} />
      <div style={styles.bgOrb2} />
      <div style={styles.bgOrb3} />

      <div style={styles.card}>
        {/* Logo */}
        <div style={styles.logoRow}>
          <div style={styles.logoIcon}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M5 3l14 9-14 9V3z" fill="white" />
            </svg>
          </div>
          <span style={styles.logoText}>CutAI</span>
        </div>

        <h1 style={styles.heading}>Welcome back</h1>
        <p style={styles.subheading}>Sign in to continue editing</p>

        {/* Google Sign-in */}
        <button
          onClick={handleGoogleLogin}
          disabled={googleLoading}
          style={{
            ...styles.googleBtn,
            opacity: googleLoading ? 0.7 : 1,
          }}
        >
          {googleLoading ? (
            <span style={styles.spinner} />
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
          )}
          <span>{googleLoading ? "Signing in…" : "Continue with Google"}</span>
        </button>

        {/* Divider */}
        <div style={styles.divider}>
          <div style={styles.dividerLine} />
          <span style={styles.dividerText}>or sign in with email</span>
          <div style={styles.dividerLine} />
        </div>

        {/* Form */}
        <form onSubmit={handleLogin} style={styles.form}>
          <div style={styles.field}>
            <label style={styles.label}>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="alex@demo.com"
              required
              style={styles.input}
              onFocus={(e) =>
                Object.assign(e.currentTarget.style, styles.inputFocus)
              }
              onBlur={(e) => {
                e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)";
                e.currentTarget.style.boxShadow = "none";
              }}
            />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Password</label>
            <div style={styles.passwordWrap}>
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                style={{ ...styles.input, paddingRight: "44px" }}
                onFocus={(e) =>
                  Object.assign(e.currentTarget.style, styles.inputFocus)
                }
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)";
                  e.currentTarget.style.boxShadow = "none";
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                style={styles.eyeBtn}
              >
                {showPassword ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/>
                    <line x1="1" y1="1" x2="23" y2="23"/>
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                    <circle cx="12" cy="12" r="3"/>
                  </svg>
                )}
              </button>
            </div>
          </div>

          {error && <p style={styles.errorMsg}>{error}</p>}

          <button
            type="submit"
            disabled={isLoading}
            style={{
              ...styles.submitBtn,
              opacity: isLoading ? 0.7 : 1,
            }}
          >
            {isLoading ? (
              <>
                <span style={styles.spinner} />
                Signing in…
              </>
            ) : (
              "Sign In"
            )}
          </button>
        </form>

        {/* Demo credentials hint */}
        <div style={styles.demoBox}>
          <p style={styles.demoTitle}>🔑 Demo Credentials</p>
          <div style={styles.demoGrid}>
            <div style={styles.demoItem}>
              <span style={styles.demoBadge}>Pro</span>
              <span style={styles.demoEmail}>alex@demo.com</span>
              <span style={styles.demoPass}>demo123</span>
            </div>
            <div style={styles.demoItem}>
              <span style={styles.demoBadge}>Free</span>
              <span style={styles.demoEmail}>sam@demo.com</span>
              <span style={styles.demoPass}>demo123</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  root: {
    minHeight: "100vh",
    background: "#0a0a0f",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "24px",
    position: "relative",
    overflow: "hidden",
    fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
  },
  bgOrb1: {
    position: "absolute",
    top: "-20%",
    left: "-10%",
    width: "500px",
    height: "500px",
    borderRadius: "50%",
    background:
      "radial-gradient(circle, rgba(99,102,241,0.15) 0%, transparent 70%)",
    pointerEvents: "none",
  },
  bgOrb2: {
    position: "absolute",
    bottom: "-20%",
    right: "-10%",
    width: "600px",
    height: "600px",
    borderRadius: "50%",
    background:
      "radial-gradient(circle, rgba(139,92,246,0.12) 0%, transparent 70%)",
    pointerEvents: "none",
  },
  bgOrb3: {
    position: "absolute",
    top: "40%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    width: "300px",
    height: "300px",
    borderRadius: "50%",
    background:
      "radial-gradient(circle, rgba(59,130,246,0.08) 0%, transparent 70%)",
    pointerEvents: "none",
  },
  card: {
    position: "relative",
    zIndex: 1,
    background: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: "20px",
    padding: "40px",
    width: "100%",
    maxWidth: "420px",
    backdropFilter: "blur(20px)",
    boxShadow:
      "0 25px 50px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.06)",
  },
  logoRow: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    marginBottom: "32px",
  },
  logoIcon: {
    width: "36px",
    height: "36px",
    borderRadius: "10px",
    background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 4px 15px rgba(99,102,241,0.4)",
  },
  logoText: {
    fontSize: "20px",
    fontWeight: "700",
    color: "#fff",
    letterSpacing: "-0.5px",
  },
  heading: {
    fontSize: "26px",
    fontWeight: "700",
    color: "#fff",
    margin: "0 0 6px",
    letterSpacing: "-0.5px",
  },
  subheading: {
    fontSize: "14px",
    color: "rgba(255,255,255,0.45)",
    margin: "0 0 28px",
  },
  googleBtn: {
    width: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "10px",
    padding: "12px 20px",
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: "12px",
    color: "#fff",
    fontSize: "14px",
    fontWeight: "600",
    cursor: "pointer",
    transition: "all 0.2s",
    letterSpacing: "0.1px",
  },
  divider: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    margin: "24px 0",
  },
  dividerLine: {
    flex: 1,
    height: "1px",
    background: "rgba(255,255,255,0.08)",
  },
  dividerText: {
    fontSize: "12px",
    color: "rgba(255,255,255,0.3)",
    whiteSpace: "nowrap",
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
  },
  field: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
  label: {
    fontSize: "13px",
    fontWeight: "500",
    color: "rgba(255,255,255,0.6)",
  },
  input: {
    width: "100%",
    padding: "11px 14px",
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: "10px",
    color: "#fff",
    fontSize: "14px",
    outline: "none",
    transition: "border-color 0.2s, box-shadow 0.2s",
    boxSizing: "border-box",
  },
  inputFocus: {
    borderColor: "rgba(99,102,241,0.6)",
    boxShadow: "0 0 0 3px rgba(99,102,241,0.15)",
  },
  passwordWrap: {
    position: "relative",
  },
  eyeBtn: {
    position: "absolute",
    right: "12px",
    top: "50%",
    transform: "translateY(-50%)",
    background: "none",
    border: "none",
    color: "rgba(255,255,255,0.4)",
    cursor: "pointer",
    padding: "2px",
    display: "flex",
    alignItems: "center",
  },
  errorMsg: {
    fontSize: "13px",
    color: "#f87171",
    background: "rgba(248,113,113,0.1)",
    border: "1px solid rgba(248,113,113,0.2)",
    borderRadius: "8px",
    padding: "10px 12px",
    margin: "0",
  },
  submitBtn: {
    width: "100%",
    padding: "13px",
    background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
    border: "none",
    borderRadius: "12px",
    color: "#fff",
    fontSize: "15px",
    fontWeight: "600",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    boxShadow: "0 4px 20px rgba(99,102,241,0.35)",
    transition: "opacity 0.2s, transform 0.1s",
    letterSpacing: "0.1px",
    marginTop: "4px",
  },
  spinner: {
    width: "16px",
    height: "16px",
    border: "2px solid rgba(255,255,255,0.3)",
    borderTop: "2px solid #fff",
    borderRadius: "50%",
    animation: "spin 0.7s linear infinite",
    display: "inline-block",
  },
  demoBox: {
    marginTop: "24px",
    padding: "14px 16px",
    background: "rgba(99,102,241,0.06)",
    border: "1px solid rgba(99,102,241,0.2)",
    borderRadius: "12px",
  },
  demoTitle: {
    fontSize: "12px",
    fontWeight: "600",
    color: "rgba(255,255,255,0.5)",
    margin: "0 0 10px",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
  },
  demoGrid: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  demoItem: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  demoBadge: {
    fontSize: "10px",
    fontWeight: "700",
    padding: "2px 6px",
    borderRadius: "4px",
    background: "rgba(99,102,241,0.3)",
    color: "#a5b4fc",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
    minWidth: "32px",
    textAlign: "center",
  },
  demoEmail: {
    fontSize: "12px",
    color: "rgba(255,255,255,0.6)",
    fontFamily: "monospace",
    flex: 1,
  },
  demoPass: {
    fontSize: "12px",
    color: "rgba(255,255,255,0.35)",
    fontFamily: "monospace",
  },
};
