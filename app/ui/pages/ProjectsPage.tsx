"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/app/ui/context/AuthContext";

type Project = {
  id: string;
  name: string;
  thumbnail: string;
  updatedAt: string;
  duration: string;
  resolution: string;
  status: "draft" | "exported" | "processing";
};

// Storage key for user projects
const STORAGE_KEY = "cutai_projects";

const STATUS_COLORS = {
  draft: { bg: "rgba(251,191,36,0.12)", text: "#fbbf24", label: "Draft" },
  exported: { bg: "rgba(52,211,153,0.12)", text: "#34d399", label: "Exported" },
  processing: { bg: "rgba(99,102,241,0.15)", text: "#a5b4fc", label: "Processing" },
};

export default function ProjectsPage() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);
  const [hoveredBtn, setHoveredBtn] = useState<string | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);

  // Load projects from localStorage (starts empty as requested)
  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        try {
          setProjects(JSON.parse(stored));
        } catch {
          setProjects([]);
        }
      } else {
        // Initialize as empty to remove unwanted projects
        setProjects([]);
        localStorage.setItem(STORAGE_KEY, JSON.stringify([]));
      }
    }
  }, []);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [user, loading, router]);

  if (loading || !user) return null;

  const filtered = projects.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  function openProject(id: string) {
    // Navigate to the main editor
    router.push(`/?project=${id}`);
  }

  function deleteProject(id: string) {
    const updated = projects.filter((p) => p.id !== id);
    setProjects(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  }

  function handleLogout() {
    logout();
    router.push("/login");
  }

  return (
    <div style={styles.root}>
      {/* Navbar */}
      <nav style={styles.navbar}>
        <div style={styles.navBrand}>
          <div style={styles.logoIcon}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M5 3l14 9-14 9V3z" fill="white" />
            </svg>
          </div>
          <span style={styles.logoText}>CutAI</span>
        </div>

        <div style={styles.navRight}>
          <div style={styles.userBtn} onClick={() => setShowUserMenu((v) => !v)}>
            <div style={styles.avatar}>{user.avatar}</div>
            <div style={styles.userInfo}>
              <span style={styles.userName}>{user.name}</span>
              <span style={styles.userPlan}>{user.plan === "pro" ? "✦ Pro" : "Free"}</span>
            </div>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </div>

          {showUserMenu && (
            <div style={styles.dropdown}>
              <div style={styles.dropdownHeader}>
                <span style={styles.dropdownEmail}>{user.email}</span>
              </div>
              <div style={styles.dropdownDivider} />
              <button style={styles.dropdownItem}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
                Profile
              </button>
              <button style={styles.dropdownItem}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M12 2v2m0 16v2M4.22 4.22l1.42 1.42m12.72 12.72l1.42 1.42M2 12h2m16 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
                </svg>
                Settings
              </button>
              <div style={styles.dropdownDivider} />
              <button
                style={{ ...styles.dropdownItem, color: "#f87171" }}
                onClick={handleLogout}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" />
                </svg>
                Sign out
              </button>
            </div>
          )}
        </div>
      </nav>

      {/* Page body */}
      <main style={styles.main}>
        {/* Header row */}
        <div style={styles.header}>
          <div>
            <h1 style={styles.pageTitle}>My Projects</h1>
            <p style={styles.pageSubtitle}>{projects.length} projects</p>
          </div>
          <button
            style={{
              ...styles.newBtn,
              ...(hoveredBtn === "new" ? styles.newBtnHover : {}),
            }}
            onMouseEnter={() => setHoveredBtn("new")}
            onMouseLeave={() => setHoveredBtn(null)}
            onClick={() => router.push("/")}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            New Project
          </button>
        </div>

        {/* Search */}
        <div style={styles.searchWrap}>
          <svg
            style={styles.searchIcon}
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="rgba(255,255,255,0.3)"
            strokeWidth="2"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder="Search projects…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={styles.searchInput}
          />
        </div>

        {/* Stats bar */}
        <div style={styles.statsBar}>
          {[
            { label: "Total", value: projects.length, color: "#e2e8f0" },
            { label: "Drafts", value: projects.filter(p => p.status === "draft").length, color: "#fbbf24" },
            { label: "Exported", value: projects.filter(p => p.status === "exported").length, color: "#34d399" },
            { label: "Processing", value: projects.filter(p => p.status === "processing").length, color: "#a5b4fc" },
          ].map((stat) => (
            <div key={stat.label} style={styles.statItem}>
              <span style={{ ...styles.statValue, color: stat.color }}>{stat.value}</span>
              <span style={styles.statLabel}>{stat.label}</span>
            </div>
          ))}
        </div>

        {/* Project grid */}
        {filtered.length === 0 ? (
          <div style={styles.emptyState}>
            <span style={{ fontSize: "48px" }}>🎬</span>
            <p style={styles.emptyText}>No projects found</p>
          </div>
        ) : (
          <div style={styles.grid}>
            {filtered.map((project) => {
              const status = STATUS_COLORS[project.status];
              const isHovered = hoveredCard === project.id;
              return (
                <div
                  key={project.id}
                  style={{
                    ...styles.card,
                    ...(isHovered ? styles.cardHover : {}),
                  }}
                  onMouseEnter={() => setHoveredCard(project.id)}
                  onMouseLeave={() => setHoveredCard(null)}
                  onClick={() => openProject(project.id)}
                >
                  {/* Thumbnail */}
                  <div style={styles.thumbnail}>
                    <span style={styles.thumbnailEmoji}>{project.thumbnail}</span>
                    <div style={styles.duration}>{project.duration}</div>
                    {isHovered && (
                      <div style={styles.playOverlay}>
                        <div style={styles.playCircle}>
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                            <path d="M5 3l14 9-14 9V3z" />
                          </svg>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div style={styles.cardBody}>
                    <div style={styles.cardTop}>
                      <h3 style={styles.cardTitle}>{project.name}</h3>
                      <button
                        style={{
                          ...styles.deleteBtn,
                          color: hoveredCard === project.id ? "rgba(248, 113, 113, 0.8)" : "rgba(255, 255, 255, 0.3)"
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm(`Are you sure you want to delete "${project.name}"?`)) {
                            deleteProject(project.id);
                          }
                        }}
                        title="Delete Project"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="3 6 5 6 21 6"></polyline>
                          <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"></path>
                        </svg>
                      </button>
                    </div>

                    <div style={styles.cardMeta}>
                      <span style={styles.metaItem}>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
                        </svg>
                        {project.resolution}
                      </span>
                      <span style={styles.metaDot}>·</span>
                      <span style={styles.metaItem}>{project.updatedAt}</span>
                    </div>

                    <div style={styles.cardFooter}>
                      <span
                        style={{
                          ...styles.statusBadge,
                          background: status.bg,
                          color: status.text,
                        }}
                      >
                        {status.label}
                      </span>
                      <span style={styles.openHint}>Open →</span>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* New project card */}
            <div
              style={{
                ...styles.card,
                ...styles.newCard,
                ...(hoveredCard === "new-proj" ? styles.newCardHover : {}),
              }}
              onMouseEnter={() => setHoveredCard("new-proj")}
              onMouseLeave={() => setHoveredCard(null)}
              onClick={() => router.push("/")}
            >
              <div style={styles.newCardInner}>
                <div style={styles.plusCircle}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="rgba(99,102,241,0.8)" strokeWidth="2">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                </div>
                <p style={styles.newCardText}>New Project</p>
                <p style={styles.newCardSub}>Start editing a video</p>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Close menu on outside click */}
      {showUserMenu && (
        <div
          style={styles.menuBackdrop}
          onClick={() => setShowUserMenu(false)}
        />
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  root: {
    minHeight: "100vh",
    background: "#0a0a0f",
    fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
    color: "#fff",
  },
  navbar: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0 32px",
    height: "60px",
    background: "rgba(255,255,255,0.02)",
    borderBottom: "1px solid rgba(255,255,255,0.06)",
    position: "sticky",
    top: 0,
    zIndex: 100,
    backdropFilter: "blur(12px)",
  },
  navBrand: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
  },
  logoIcon: {
    width: "30px",
    height: "30px",
    borderRadius: "8px",
    background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 2px 10px rgba(99,102,241,0.4)",
  },
  logoText: {
    fontSize: "17px",
    fontWeight: "700",
    color: "#fff",
    letterSpacing: "-0.5px",
  },
  navRight: {
    position: "relative",
  },
  userBtn: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "6px 12px",
    borderRadius: "10px",
    cursor: "pointer",
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.08)",
    transition: "background 0.2s",
  },
  avatar: {
    width: "30px",
    height: "30px",
    borderRadius: "50%",
    background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "11px",
    fontWeight: "700",
    color: "#fff",
    letterSpacing: "0.5px",
  },
  userInfo: {
    display: "flex",
    flexDirection: "column",
    gap: "1px",
  },
  userName: {
    fontSize: "13px",
    fontWeight: "600",
    color: "#fff",
    lineHeight: 1.2,
  },
  userPlan: {
    fontSize: "10px",
    color: "#a5b4fc",
    fontWeight: "500",
  },
  dropdown: {
    position: "absolute",
    right: 0,
    top: "calc(100% + 8px)",
    background: "#1a1a2e",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: "12px",
    width: "200px",
    boxShadow: "0 20px 40px rgba(0,0,0,0.4)",
    overflow: "hidden",
    zIndex: 200,
  },
  dropdownHeader: {
    padding: "12px 16px",
  },
  dropdownEmail: {
    fontSize: "12px",
    color: "rgba(255,255,255,0.4)",
  },
  dropdownDivider: {
    height: "1px",
    background: "rgba(255,255,255,0.07)",
    margin: "4px 0",
  },
  dropdownItem: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    width: "100%",
    padding: "10px 16px",
    background: "none",
    border: "none",
    color: "rgba(255,255,255,0.7)",
    fontSize: "13px",
    cursor: "pointer",
    textAlign: "left",
    transition: "background 0.15s",
  },
  menuBackdrop: {
    position: "fixed",
    inset: 0,
    zIndex: 99,
  },
  main: {
    maxWidth: "1200px",
    margin: "0 auto",
    padding: "48px 32px",
  },
  header: {
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "space-between",
    marginBottom: "28px",
  },
  pageTitle: {
    fontSize: "28px",
    fontWeight: "700",
    color: "#fff",
    margin: "0 0 4px",
    letterSpacing: "-0.5px",
  },
  pageSubtitle: {
    fontSize: "14px",
    color: "rgba(255,255,255,0.35)",
    margin: 0,
  },
  newBtn: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "10px 20px",
    background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
    border: "none",
    borderRadius: "10px",
    color: "#fff",
    fontSize: "14px",
    fontWeight: "600",
    cursor: "pointer",
    boxShadow: "0 4px 15px rgba(99,102,241,0.3)",
    transition: "transform 0.15s, box-shadow 0.15s",
  },
  newBtnHover: {
    transform: "translateY(-1px)",
    boxShadow: "0 6px 20px rgba(99,102,241,0.45)",
  },
  searchWrap: {
    position: "relative",
    marginBottom: "24px",
  },
  searchIcon: {
    position: "absolute",
    left: "14px",
    top: "50%",
    transform: "translateY(-50%)",
    pointerEvents: "none",
  },
  searchInput: {
    width: "100%",
    padding: "11px 14px 11px 42px",
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: "10px",
    color: "#fff",
    fontSize: "14px",
    outline: "none",
    boxSizing: "border-box",
    maxWidth: "380px",
  },
  statsBar: {
    display: "flex",
    gap: "32px",
    marginBottom: "32px",
    padding: "16px 24px",
    background: "rgba(255,255,255,0.02)",
    border: "1px solid rgba(255,255,255,0.06)",
    borderRadius: "12px",
    width: "fit-content",
  },
  statItem: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "2px",
  },
  statValue: {
    fontSize: "22px",
    fontWeight: "700",
    lineHeight: 1,
  },
  statLabel: {
    fontSize: "11px",
    color: "rgba(255,255,255,0.35)",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
    fontWeight: "500",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
    gap: "20px",
  },
  card: {
    background: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(255,255,255,0.07)",
    borderRadius: "16px",
    overflow: "hidden",
    cursor: "pointer",
    transition: "transform 0.2s, border-color 0.2s, box-shadow 0.2s",
  },
  cardHover: {
    transform: "translateY(-3px)",
    borderColor: "rgba(99,102,241,0.3)",
    boxShadow: "0 12px 30px rgba(0,0,0,0.3)",
  },
  thumbnail: {
    height: "150px",
    background:
      "linear-gradient(135deg, rgba(99,102,241,0.12) 0%, rgba(139,92,246,0.08) 100%)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    borderBottom: "1px solid rgba(255,255,255,0.05)",
  },
  thumbnailEmoji: {
    fontSize: "48px",
    filter: "drop-shadow(0 4px 8px rgba(0,0,0,0.3))",
  },
  duration: {
    position: "absolute",
    bottom: "10px",
    right: "10px",
    background: "rgba(0,0,0,0.6)",
    color: "#fff",
    fontSize: "11px",
    fontWeight: "600",
    padding: "3px 8px",
    borderRadius: "6px",
    backdropFilter: "blur(4px)",
  },
  playOverlay: {
    position: "absolute",
    inset: 0,
    background: "rgba(0,0,0,0.35)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  playCircle: {
    width: "44px",
    height: "44px",
    borderRadius: "50%",
    background: "rgba(99,102,241,0.9)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 4px 15px rgba(99,102,241,0.5)",
  },
  cardBody: {
    padding: "14px 16px 16px",
  },
  cardTop: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: "6px",
    gap: "8px",
  },
  cardTitle: {
    fontSize: "14px",
    fontWeight: "600",
    color: "#fff",
    margin: 0,
    lineHeight: 1.3,
  },
  deleteBtn: {
    background: "none",
    border: "none",
    cursor: "pointer",
    padding: "4px",
    borderRadius: "6px",
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    transition: "color 0.2s, background 0.2s",
  },
  cardMeta: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    marginBottom: "12px",
  },
  metaItem: {
    fontSize: "11px",
    color: "rgba(255,255,255,0.35)",
    display: "flex",
    alignItems: "center",
    gap: "4px",
  },
  metaDot: {
    fontSize: "11px",
    color: "rgba(255,255,255,0.2)",
  },
  cardFooter: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },
  statusBadge: {
    fontSize: "11px",
    fontWeight: "600",
    padding: "3px 10px",
    borderRadius: "20px",
    letterSpacing: "0.2px",
  },
  openHint: {
    fontSize: "12px",
    color: "rgba(99,102,241,0.6)",
    fontWeight: "500",
  },
  newCard: {
    border: "2px dashed rgba(99,102,241,0.2)",
    background: "rgba(99,102,241,0.02)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "240px",
  },
  newCardHover: {
    borderColor: "rgba(99,102,241,0.4)",
    background: "rgba(99,102,241,0.05)",
    transform: "translateY(-3px)",
  },
  newCardInner: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "8px",
  },
  plusCircle: {
    width: "52px",
    height: "52px",
    borderRadius: "50%",
    background: "rgba(99,102,241,0.1)",
    border: "2px solid rgba(99,102,241,0.2)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: "4px",
  },
  newCardText: {
    fontSize: "15px",
    fontWeight: "600",
    color: "rgba(255,255,255,0.7)",
    margin: 0,
  },
  newCardSub: {
    fontSize: "12px",
    color: "rgba(255,255,255,0.3)",
    margin: 0,
  },
  emptyState: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "12px",
    padding: "80px 0",
    color: "rgba(255,255,255,0.3)",
  },
  emptyText: {
    fontSize: "16px",
    margin: 0,
  },
};
