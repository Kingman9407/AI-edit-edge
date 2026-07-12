export type Project = {
  id: string;           // stable UUID, also used as Chat memoryKey
  name: string;
  thumbnail: string;
  updatedAt: string;
  duration: string;
  resolution: string;
  status: "draft" | "exported" | "processing";
};
