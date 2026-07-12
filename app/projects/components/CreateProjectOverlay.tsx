import React, { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useProjectFiles } from "@/app/context/ProjectFilesContext";
import { generateProjectId, upsertProject } from "@/app/lib/projectStorage";
import { saveProjectMedia } from "@/app/lib/mediaStorage";

interface CreateProjectOverlayProps {
  onClose: () => void;
}

export default function CreateProjectOverlay({ onClose }: CreateProjectOverlayProps) {
  const router = useRouter();
  const { setPendingFiles } = useProjectFiles();
  const multiInputRef = useRef<HTMLInputElement>(null);
  const [projectName, setProjectName] = useState("");
  const [selectedVideos, setSelectedVideos] = useState<File[]>([]);

  const handleVideoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []).filter((file) =>
      file.type.startsWith("video/")
    );
    if (!files.length) return;
    setSelectedVideos((prev) => [...prev, ...files]);
    event.target.value = "";
  };

  const handleCreate = async () => {
    if (selectedVideos.length === 0) return;

    // Save files to context so the editor can grab them instantly
    setPendingFiles(selectedVideos, []);

    // Generate stable project ID
    const newId = generateProjectId();

    // Persist to IndexedDB so files survive page reloads
    try {
      await saveProjectMedia(newId, selectedVideos);
    } catch (err) {
      console.error("Failed to save media to cache:", err);
    }

    // Generate thumbnail from first video
    const generateThumbnail = (file: File): Promise<string> => {
      return new Promise((resolve) => {
        const video = document.createElement("video");
        video.preload = "metadata";
        video.playsInline = true;
        video.muted = true;
        const objectUrl = URL.createObjectURL(file);
        video.src = objectUrl;

        video.onloadeddata = () => {
          video.currentTime = 0;
        };

        video.onseeked = () => {
          const canvas = document.createElement("canvas");
          canvas.width = 320; // 16:9 thumbnail width
          canvas.height = 180;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            // Draw maintaining aspect ratio and filling canvas
            const scale = Math.max(canvas.width / video.videoWidth, canvas.height / video.videoHeight);
            const w = video.videoWidth * scale;
            const h = video.videoHeight * scale;
            const x = (canvas.width - w) / 2;
            const y = (canvas.height - h) / 2;
            ctx.drawImage(video, x, y, w, h);
            resolve(canvas.toDataURL("image/jpeg", 0.7));
          } else {
            resolve("🎬");
          }
          URL.revokeObjectURL(objectUrl);
        };

        video.onerror = () => {
          resolve("🎬");
          URL.revokeObjectURL(objectUrl);
        };
      });
    };

    let thumbnail = "🎬";
    try {
      thumbnail = await generateThumbnail(selectedVideos[0]);
    } catch (e) {
      console.error("Failed to generate thumbnail", e);
    }

    // Pre-create the project record so it has the custom name
    upsertProject({
      id: newId,
      name: projectName.trim() || "Untitled Project",
      thumbnail: thumbnail,
      updatedAt: new Date().toLocaleDateString(),
      duration: "--:--",
      resolution: "---p",
      status: "draft"
    });

    onClose();
    router.push(`/editor?project=${newId}`);
  };

  return (
    <div
      className="fixed inset-0 z-[999] flex items-center justify-center bg-black/60"
      onClick={onClose}
    >
      <div
        className="bg-gray-900 backdrop-blur-xl border border-white/10 rounded-3xl p-8 w-full max-w-lg shadow-[0_32px_64px_rgba(0,0,0,0.6)] flex flex-col gap-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <h2 className="text-2xl font-bold tracking-tight text-zinc-100 m-0">Create New Project</h2>
            <p className="text-zinc-400 text-sm m-0">Start by naming your project and adding media.</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-white/50 hover:text-white transition-colors"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-semibold text-zinc-300 ml-1">Project Name</label>
          <input
            type="text"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            placeholder="My Awesome Video"
            className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/20 focus:outline-none focus:border-blue-500/50 transition-colors text-sm"
          />
        </div>

        <div className="w-full">
          {/* Video Upload Section */}
          <div className="flex flex-col items-center gap-4 p-8 rounded-2xl border border-dashed border-zinc-700 bg-zinc-900/30 hover:border-blue-500/50 hover:bg-zinc-900/50 transition-all text-center">
            <div className="h-14 w-14 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 shadow-md">
              <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m16 13 5.223 3.482a.5.5 0 0 0 .777-.416V7.934a.5.5 0 0 0-.777-.416L16 11" /><rect width="12" height="10" x="2" y="7" rx="2" /></svg>
            </div>
            <div className="space-y-1">
              <h3 className="font-semibold text-zinc-200 text-lg m-0">Video Clips</h3>
              <p className="text-xs text-zinc-500 m-0">MP4, WebM supported</p>
            </div>
            <label className="cursor-pointer inline-flex items-center justify-center rounded-xl bg-blue-600 px-8 py-3 text-sm font-semibold text-white transition-all hover:bg-blue-500 active:scale-95 shadow-lg shadow-blue-600/20 mt-2">
              <span>{selectedVideos.length > 0 ? `Added ${selectedVideos.length} Videos` : "Browse Files"}</span>
              <input
                ref={multiInputRef}
                type="file"
                accept="video/mp4,video/webm"
                multiple
                className="hidden"
                onChange={handleVideoUpload}
              />
            </label>
          </div>
        </div>

        {selectedVideos.length > 0 && (
          <div className="flex justify-end pt-4 border-t border-zinc-800">
            <button
              onClick={handleCreate}
              className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl transition-all active:scale-95 shadow-lg shadow-blue-600/20"
            >
              Start Editing
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
