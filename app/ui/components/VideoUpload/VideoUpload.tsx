import React, { ChangeEvent } from "react";
import { Upload } from "lucide-react";

interface VideoUploadProps {
  onFileUpload: (e: ChangeEvent<HTMLInputElement>) => void;
}

export default function VideoUpload({ onFileUpload }: VideoUploadProps) {
  return (
    <div className="flex h-screen w-full items-center justify-center bg-zinc-950 p-4">
      <div className="flex max-w-md flex-col items-center justify-center gap-6 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-12 text-center backdrop-blur-xl">
        <div className="rounded-full bg-blue-500/10 p-6 text-blue-500 ring-1 ring-blue-500/20">
          <Upload size={40} />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold text-zinc-100">Upload a Video</h2>
          <p className="text-zinc-400">Select an MP4 or WebM file to start editing.</p>
        </div>
        <label className="group relative inline-flex cursor-pointer items-center justify-center overflow-hidden rounded-full bg-blue-600 px-8 py-3 font-medium text-white transition-all hover:bg-blue-500 active:scale-95">
          <span>Choose File</span>
          <input
            type="file"
            accept="video/mp4,video/webm"
            className="absolute inset-0 hidden"
            onChange={onFileUpload}
          />
        </label>
      </div>
    </div>
  );
}
