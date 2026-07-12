import type { FC } from "react";
import { useRouter } from "next/navigation";

interface LoginFormProps {
    googleLoading: boolean;
    loginError: { code: string; message: string; fullError: string } | null;
    onGoogleLogin: () => void;
    onDismissError: () => void;
}

export const LoginForm: FC<LoginFormProps> = ({ googleLoading, loginError, onGoogleLogin, onDismissError }) => {
    const router = useRouter();

    return (
        <div className="w-full md:w-[40%] flex items-center justify-center p-6 md:p-10 relative z-10 shrink-0">
            <div
                className="bg-zinc-950/50 border border-white/10 rounded-3xl p-10 md:p-12 w-full max-w-[440px] backdrop-blur-xl shadow-[0_30px_60px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.05)] flex flex-col"
                style={{ animation: 'fadeUp 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards' }}
            >
                {/* Replaced gradient box with a flat blue-100 box */}
                <div className="w-14 h-14 bg-blue-100 rounded-2xl flex items-center justify-center mb-6 shadow-md relative overflow-hidden">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M4 4l16 8-16 8V4z" fill="#2563eb" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                </div>

                <h1 className="text-[32px] font-bold mb-2 tracking-tight text-blue-100" style={{ fontFamily: "'Outfit', sans-serif" }}>Sign in to AI Edit</h1>
                <p className="text-[15px] text-zinc-300 mb-10 leading-relaxed">Sign in to access your complete AI editing workspace. Manage your projects, run on-device AI models, and unlock professional-grade video tools without leaving your browser.</p>

                <button
                    className="w-full flex items-center justify-center gap-3 py-3.5 px-6 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-2xl text-white text-[16px] font-medium cursor-pointer transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_8px_20px_rgba(0,0,0,0.2)] disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none relative overflow-hidden group"
                    onClick={onGoogleLogin}
                    disabled={googleLoading}
                >
                    {googleLoading ? (
                        <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                    ) : (
                        <svg width="22" height="22" viewBox="0 0 48 48">
                            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                        </svg>
                    )}
                    <span className="relative z-10">{googleLoading ? "Signing in..." : "Continue with Google"}</span>
                </button>

                {/* Divider */}
                <div className="flex items-center gap-3 my-4">
                    <div className="flex-1 h-px bg-white/10" />
                    <span className="text-[12px] text-white/30 font-medium">or</span>
                    <div className="flex-1 h-px bg-white/10" />
                </div>

                {/* Guest bypass button */}
                <button
                    onClick={() => {
                        sessionStorage.setItem("guestMode", "true");
                        router.push("/editor");
                    }}
                    className="w-full flex items-center justify-center gap-2 py-3 px-6 bg-transparent border border-white/10 hover:border-white/20 hover:bg-white/5 rounded-2xl text-white/50 hover:text-white/80 text-[14px] font-medium cursor-pointer transition-all duration-300 hover:-translate-y-0.5"
                >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-60">
                        <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
                        <circle cx="12" cy="7" r="4" />
                    </svg>
                    Continue as Guest
                </button>

                {/* ─── Debug: visible error panel ─── */}
                {loginError && (
                    <div className="mt-4 p-4 rounded-xl border border-red-500/40 bg-red-950/40 text-left">
                        <p className="text-red-400 font-semibold text-sm mb-1">❌ Login failed</p>
                        <p className="text-red-300 text-xs font-mono mb-2">Code: {loginError.code}</p>
                        <p className="text-red-200 text-xs mb-3">{loginError.message}</p>
                        <details className="text-xs text-red-300">
                            <summary className="cursor-pointer select-none opacity-70">Full error (for debugging)</summary>
                            <pre className="mt-2 whitespace-pre-wrap break-all opacity-80">{loginError.fullError}</pre>
                        </details>
                        <button
                            onClick={onDismissError}
                            className="mt-3 text-xs text-red-400 hover:text-red-200 transition-colors underline"
                        >Dismiss</button>
                    </div>
                )}
            </div>
        </div>
    );
};
