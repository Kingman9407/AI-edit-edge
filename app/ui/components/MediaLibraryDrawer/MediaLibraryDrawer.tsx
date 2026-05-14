import React from "react";
import { X, Video, Music, Plus, Library, ChevronRight } from "lucide-react";

interface MediaLibraryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onOpen: () => void;
  multiFiles: File[];
  audioFiles: File[];
  activeIndex: number;
  onSelectFile: (index: number) => void;
  onRemoveFile: (index: number) => void;
  onRemoveAudioFile: (index: number) => void;
  onAddVideo: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onAddAudio: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

export default function MediaLibraryDrawer({
  isOpen,
  onClose,
  onOpen,
  multiFiles,
  audioFiles,
  activeIndex,
  onSelectFile,
  onRemoveFile,
  onRemoveAudioFile,
  onAddVideo,
  onAddAudio,
}: MediaLibraryDrawerProps) {
  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity duration-300"
          onClick={onClose}
        />
      )}

      {/* Drawer */}
      <div className={`fixed left-0 top-0 z-50 h-full w-80 transform bg-zinc-950 border-r border-zinc-800 shadow-2xl transition-transform duration-500 ease-out ${isOpen ? "translate-x-0" : "-translate-x-full"}`}>
        
        {/* Toggle Button (Attached to right edge) */}
        <div className="absolute left-full top-1/2 -translate-y-1/2 ml-[-1px]">
          <button
            onClick={isOpen ? onClose : onOpen}
            className="flex flex-col items-center gap-3 rounded-r-2xl bg-zinc-950 border-y border-r border-zinc-800 p-3 text-xs font-bold text-zinc-300 shadow-2xl backdrop-blur-xl transition-all hover:bg-zinc-900 hover:text-white group"
          >
            <div className="relative">
              <Library size={22} className="text-emerald-500 group-hover:scale-110 transition-transform" />
              <div className={`absolute -right-2 -bottom-2 transform transition-transform duration-500 ${isOpen ? "rotate-180" : "rotate-0"}`}>
                <ChevronRight size={14} className="text-zinc-500" />
              </div>
            </div>
            
            <span className="[writing-mode:vertical-lr] rotate-180 py-1 tracking-widest uppercase text-[9px] text-zinc-500 group-hover:text-zinc-300 transition-colors">Media Library</span>
            
            {(multiFiles.length + audioFiles.length > 0) && (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-[10px] font-black text-black ring-2 ring-zinc-950">
                {multiFiles.length + audioFiles.length}
              </span>
            )}
          </button>
        </div>

        <div className="flex h-full flex-col">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-zinc-800 p-6">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 ring-1 ring-emerald-500/20">
                <Video size={16} className="text-emerald-500" />
              </div>
              <h2 className="text-lg font-bold text-zinc-100">Media Library</h2>
            </div>
            <button
              onClick={onClose}
              className="rounded-full p-2 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-100 transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-8">
            {/* Video Clips Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Video Clips</span>
                <label className="flex cursor-pointer items-center gap-1.5 text-[10px] font-bold text-emerald-500 hover:text-emerald-400">
                  <Plus size={12} /> ADD NEW
                  <input
                    type="file"
                    accept="video/mp4,video/webm"
                    multiple
                    className="hidden"
                    onChange={(e) => { onAddVideo(e); e.currentTarget.value = ""; }}
                  />
                </label>
              </div>

              <div className="grid grid-cols-1 gap-3">
                {multiFiles.map((file, i) => (
                  <div
                    key={`v-${file.name}-${file.size}-${file.lastModified}-${i}`}
                    onClick={() => onSelectFile(i)}
                    className={`group relative flex items-center gap-3 rounded-xl border p-2 cursor-pointer transition-all ${
                      activeIndex === i
                        ? "border-emerald-500 bg-emerald-500/5 ring-1 ring-emerald-500/30"
                        : "border-zinc-800 bg-zinc-900/30 hover:border-zinc-700"
                    }`}
                  >
                    <div className="h-12 w-20 flex-shrink-0 overflow-hidden rounded-lg bg-black ring-1 ring-white/10">
                      <video src={URL.createObjectURL(file)} className="h-full w-full object-cover opacity-60 group-hover:opacity-100 transition-opacity" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold text-zinc-100 truncate">{file.name}</div>
                      <div className="text-[10px] text-zinc-500">Clip #{i + 1}</div>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); onRemoveFile(i); }}
                      className="opacity-0 group-hover:opacity-100 p-1.5 text-zinc-500 hover:text-red-500 transition-all"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Audio Files Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Audio Assets</span>
                <label className="flex cursor-pointer items-center gap-1.5 text-[10px] font-bold text-purple-500 hover:text-purple-400">
                  <Plus size={12} /> ADD NEW
                  <input
                    type="file"
                    accept="audio/*"
                    multiple
                    className="hidden"
                    onChange={(e) => { onAddAudio(e); e.currentTarget.value = ""; }}
                  />
                </label>
              </div>

              <div className="space-y-2">
                {audioFiles.map((file, i) => (
                  <div
                    key={`a-${file.name}-${file.size}-${file.lastModified}-${i}`}
                    className="group flex items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-900/30 p-2.5 transition-all hover:border-purple-500/30"
                  >
                    <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded bg-purple-500/10 text-purple-400 ring-1 ring-purple-500/20">
                      <Music size={14} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[11px] font-bold text-zinc-200 truncate">{file.name}</div>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); onRemoveAudioFile(i); }}
                      className="opacity-0 group-hover:opacity-100 p-1 text-zinc-500 hover:text-red-500 transition-all"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
