export type PlanId = "free" | "plus" | "pro";

export type PlanConfig = {
  id: PlanId;
  label: string;
  exportLimit: number;
  maxTrimFraction: number;
  nextPlanLabel?: string;
  chat: {
    includeAudio: boolean;
    includeVisual: boolean;
    includeClips: boolean;
    allowSimpleEdits: boolean;
  };
  clips: {
    allowSuggestions: boolean;
    allowAutoApply: boolean;
  };
  mediaBreakdown: "locked" | "audio" | "full";
  analysis: {
    audio: boolean;
    visual: boolean;
  };
};

export const PLAN_CONFIGS: Record<PlanId, PlanConfig> = {
  free: {
    id: "free",
    label: "Free",
    exportLimit: 1,
    maxTrimFraction: 1,
    nextPlanLabel: "Plus",
    chat: {
      includeAudio: false,
      includeVisual: false,
      includeClips: false,
      allowSimpleEdits: true,
    },
    clips: {
      allowSuggestions: false,
      allowAutoApply: false,
    },
    mediaBreakdown: "locked",
    analysis: {
      audio: false,
      visual: false,
    },
  },
  plus: {
    id: "plus",
    label: "Plus",
    exportLimit: 10,
    maxTrimFraction: 0.5,
    nextPlanLabel: "Pro",
    chat: {
      includeAudio: true,
      includeVisual: false,
      includeClips: true,
      allowSimpleEdits: true,
    },
    clips: {
      allowSuggestions: true,
      allowAutoApply: false,
    },
    mediaBreakdown: "audio",
    analysis: {
      audio: true,
      visual: false,
    },
  },
  pro: {
    id: "pro",
    label: "Pro",
    exportLimit: 200,
    maxTrimFraction: 1,
    chat: {
      includeAudio: true,
      includeVisual: true,
      includeClips: true,
      allowSimpleEdits: true,
    },
    clips: {
      allowSuggestions: true,
      allowAutoApply: true,
    },
    mediaBreakdown: "full",
    analysis: {
      audio: true,
      visual: true,
    },
  },
};

export const PLAN_ORDER: PlanId[] = ["free", "plus", "pro"];
