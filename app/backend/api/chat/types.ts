export type ModelAction = {
  type: string;
  start?: number | null;
  end?: number | null;
  clip?: number | null;
  reason?: string | null;
  audioFileIndex?: number | null;
  volume?: number | null;
};

