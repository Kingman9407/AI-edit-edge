"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/app/ui/context/AuthContext";
import VideoEditorPage from "@/app/ui/pages/VideoEditorPage";

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div style={{
        minHeight: "100vh",
        background: "#0a0a0f",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#fff",
        fontFamily: "system-ui, sans-serif"
      }}>
        <div style={{
          width: "24px",
          height: "24px",
          border: "2px solid rgba(255,255,255,0.1)",
          borderTop: "2px solid #6366f1",
          borderRadius: "50%",
          animation: "spin 0.8s linear infinite"
        }} />
      </div>
    );
  }

  if (!user) return null;

  return <VideoEditorPage />;
}
