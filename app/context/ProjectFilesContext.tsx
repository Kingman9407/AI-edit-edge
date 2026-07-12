"use client";

import React, { createContext, useContext, useState, ReactNode } from "react";

interface ProjectFilesContextType {
  pendingVideoFiles: File[];
  pendingAudioFiles: File[];
  setPendingFiles: (videos: File[], audios: File[]) => void;
  clearPendingFiles: () => void;
}

const ProjectFilesContext = createContext<ProjectFilesContextType | undefined>(undefined);

export function ProjectFilesProvider({ children }: { children: ReactNode }) {
  const [pendingVideoFiles, setPendingVideoFiles] = useState<File[]>([]);
  const [pendingAudioFiles, setPendingAudioFiles] = useState<File[]>([]);

  const setPendingFiles = (videos: File[], audios: File[]) => {
    setPendingVideoFiles(videos);
    setPendingAudioFiles(audios);
  };

  const clearPendingFiles = () => {
    setPendingVideoFiles([]);
    setPendingAudioFiles([]);
  };

  return (
    <ProjectFilesContext.Provider value={{ pendingVideoFiles, pendingAudioFiles, setPendingFiles, clearPendingFiles }}>
      {children}
    </ProjectFilesContext.Provider>
  );
}

export function useProjectFiles() {
  const context = useContext(ProjectFilesContext);
  if (context === undefined) {
    throw new Error("useProjectFiles must be used within a ProjectFilesProvider");
  }
  return context;
}
