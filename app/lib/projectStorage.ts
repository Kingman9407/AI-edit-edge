/**
 * projectStorage.ts
 * ------------------
 * Shared utility for reading/writing the project list from localStorage.
 * Both the projects page and the editor use this so they always stay in sync.
 *
 * Storage layout:
 *   cutai_projects  →  Project[]   (the project list)
 *
 * Chat sessions are stored separately by Chat.tsx itself, keyed by project.id:
 *   chat:sessions:<projectId>  →  ChatSession[]
 *   chat:current:<projectId>   →  string (active session id)
 *   chat:memory:<projectId>    →  ChatMemory
 *
 * The actions inside each ChatSession's messages are stored in message.rawJson
 * as raw JSON strings exactly as the model returned them. The human-readable text
 * goes in message.text. Both fields are preserved as-is — this module does NOT
 * touch chat data at all.
 */

import { Project } from "@/app/projects/types";

const STORAGE_KEY = "cutai_projects";

/** Generate a stable UUID for new projects */
export function generateProjectId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/** Load all projects from localStorage. Returns [] on parse error or SSR. */
export function loadProjects(): Project[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as Project[];
  } catch {
    return [];
  }
}

/** Overwrite the entire project list in localStorage. */
export function saveProjects(projects: Project[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
  } catch {
    // Storage might be full — silently ignore
  }
}

/** Look up a single project by its stable id. Returns null if not found. */
export function getProject(id: string): Project | null {
  const projects = loadProjects();
  return projects.find((p) => p.id === id) ?? null;
}

/**
 * Insert a new project or update an existing one (matched by id).
 * Existing projects are updated in-place; new projects are prepended.
 */
export function upsertProject(project: Project): void {
  const projects = loadProjects();
  const index = projects.findIndex((p) => p.id === project.id);
  if (index >= 0) {
    projects[index] = project;
  } else {
    projects.unshift(project);  // new projects appear first
  }
  saveProjects(projects);
}

/** Format a duration in seconds as "M:SS" (e.g. 83 → "1:23"). */
export function formatDurationString(seconds: number): string {
  if (!seconds || !Number.isFinite(seconds) || seconds <= 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/** Format resolution as "1920×1080". Returns "" if not known. */
export function formatResolutionString(width: number, height: number): string {
  if (!width || !height) return "";
  return `${width}×${height}`;
}
