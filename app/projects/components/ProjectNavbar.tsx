import React, { useState } from "react";

interface User {
  name: string;
  email: string;
  avatar: React.ReactNode;
  plan: string;
}

interface ProjectNavbarProps {
  user: User | null;
  onLogout: () => void;
  onSignIn?: () => void;
}

export default function ProjectNavbar({ user, onLogout, onSignIn }: ProjectNavbarProps) {
  const [showUserMenu, setShowUserMenu] = useState(false);

  function handleLogout() {
    setShowUserMenu(false);
    onLogout();
  }

  return (
    <>
      <nav className="flex items-center justify-between px-8 h-[60px] bg-zinc-950/50 border-b border-white/10 sticky top-0 z-50 backdrop-blur-xl">
        <div className="flex items-center gap-2.5">
          <div className="w-[30px] h-[30px] rounded-lg bg-blue-100 flex items-center justify-center shadow-md overflow-hidden">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M4 4l16 8-16 8V4z" fill="#2563eb" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <span className="text-[17px] font-bold text-blue-100 tracking-tight" style={{ fontFamily: "'Outfit', sans-serif" }}>AI Edit</span>
        </div>

        <div className="relative">
          {user ? (
            <>
              {/* Click-outside overlay */}
              {showUserMenu && (
                <div
                  className="fixed inset-0 z-[150]"
                  onClick={() => setShowUserMenu(false)}
                />
              )}
              <div
                className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl cursor-pointer bg-white/5 border border-white/10 transition-colors duration-200 hover:bg-white/10"
                onClick={() => setShowUserMenu((v) => !v)}
              >
                <div className="w-[30px] h-[30px] rounded-full bg-blue-100 flex items-center justify-center text-[11px] font-bold text-blue-600 tracking-wide">
                  {user.avatar}
                </div>
                <div className="flex flex-col gap-[1px]">
                  <span className="text-[13px] font-semibold text-zinc-200 leading-tight">{user.name}</span>
                  <span className="text-[10px] text-zinc-400 font-medium">{user.plan === "pro" ? "✦ Pro" : "Beta User"}</span>
                </div>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </div>

              {showUserMenu && (
                <div className="absolute right-0 top-[calc(100%+8px)] bg-zinc-950/90 border border-white/10 rounded-2xl w-[200px] shadow-[0_20px_40px_rgba(0,0,0,0.5)] overflow-hidden z-[200] backdrop-blur-xl">
                  <div className="px-4 py-3">
                    <span className="text-xs text-white/40">{user.email}</span>
                  </div>
                  <div className="h-px bg-white/5 my-1" />
                  <button type="button" className="flex items-center gap-2.5 w-full px-4 py-2.5 bg-transparent border-none text-white/70 text-[13px] cursor-pointer text-left transition-colors duration-150 hover:bg-white/5 hover:text-white">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                    Profile
                  </button>
                  <button type="button" className="flex items-center gap-2.5 w-full px-4 py-2.5 bg-transparent border-none text-white/70 text-[13px] cursor-pointer text-left transition-colors duration-150 hover:bg-white/5 hover:text-white">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="3" />
                      <path d="M12 2v2m0 16v2M4.22 4.22l1.42 1.42m12.72 12.72l1.42 1.42M2 12h2m16 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
                    </svg>
                    Settings
                  </button>
                  <div className="h-px bg-white/5 my-1" />
                  <button
                    type="button"
                    className="flex items-center gap-2.5 w-full px-4 py-2.5 bg-transparent border-none text-red-400 text-[13px] cursor-pointer text-left transition-colors duration-150 hover:bg-white/5 hover:text-red-300"
                    onClick={handleLogout}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" />
                    </svg>
                    Sign out
                  </button>
                </div>
              )}
            </>
          ) : (
            <button
              onClick={onSignIn}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-[13px] font-semibold cursor-pointer transition-colors shadow-md shadow-blue-600/20"
            >
              Sign In
            </button>
          )}
        </div>
      </nav>
    </>
  );
}
