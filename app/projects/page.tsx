"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useFirebaseAuth } from "@/app/context/FirebaseAuthContext";
import { signOut } from "firebase/auth";
import { auth } from "@/app/lib/firebase";
import { Project } from "./types";
import ProjectNavbar from "./components/ProjectNavbar";
import ProjectHeader from "./components/ProjectHeader";
import ProjectSearch from "./components/ProjectSearch";
import ProjectGrid from "./components/ProjectGrid";
import CreateProjectOverlay from "./components/CreateProjectOverlay";
import { loadProjects, saveProjects } from "@/app/lib/projectStorage";

export default function ProjectsPage() {
  const { user: authUser, loading } = useFirebaseAuth();
  const user = authUser ? {
    name: authUser.displayName || "User",
    email: authUser.email || "",
    avatar: authUser.photoURL ? (
      <img src={authUser.photoURL} alt="Avatar" className="w-full h-full rounded-full object-cover" />
    ) : (
      authUser.displayName?.charAt(0) || "U"
    ),
    plan: "beta"
  } : null;

  const router = useRouter();
  const [search, setSearch] = useState("");
  const [projects, setProjects] = useState<Project[]>([]);
  const [isCreateOverlayOpen, setIsCreateOverlayOpen] = useState(false);

  // Load projects from localStorage on mount
  useEffect(() => {
    setProjects(loadProjects());
  }, []);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [user, loading, router]);

  if (loading) return null;

  const filtered = projects.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  function openProject(id: string) {
    // Navigate to the main editor
    router.push(`/editor?project=${id}`);
  }

  function deleteProject(id: string) {
    const updated = projects.filter((p) => p.id !== id);
    setProjects(updated);
    saveProjects(updated);

    // Clean up associated chat data keyed by project id
    try {
      [`chat:sessions:${id}`, `chat:current:${id}`, `chat:memory:${id}`].forEach(
        (key) => localStorage.removeItem(key)
      );
    } catch {
      // ignore storage errors
    }
  }


  async function handleLogout() {
    try {
      await signOut(auth);
      // The useEffect watching `user` will show the login overlay automatically.
    } catch (error) {
      console.error("Error signing out:", error);
    }
  }

  return (
    <div className="min-h-screen bg-gray-900 font-sans text-white relative overflow-hidden">
      <style dangerouslySetInnerHTML={{
        __html: `
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap');
      `}} />
      <ProjectNavbar user={user} onLogout={handleLogout} onSignIn={() => router.push("/login")} />

      <main className="max-w-[1200px] mx-auto px-8 py-12">
        <ProjectHeader 
          projectCount={projects.length} 
          onNewProject={() => setIsCreateOverlayOpen(true)} 
        />
        <ProjectSearch search={search} setSearch={setSearch} />
        <ProjectGrid 
          projects={filtered} 
          onOpenProject={openProject} 
          onDeleteProject={deleteProject}
          onNewProject={() => setIsCreateOverlayOpen(true)}
        />
      </main>

      {isCreateOverlayOpen && (
        <CreateProjectOverlay onClose={() => setIsCreateOverlayOpen(false)} />
      )}
    </div>
  );
}
