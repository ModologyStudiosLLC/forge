import { create } from "zustand";

export type SelectionMode = "vertex" | "edge" | "face" | "body";

export interface SelectedFace {
  id: string;
  area?: number;
  normal?: [number, number, number];
  center?: [number, number, number];
}

export interface DFMIssue {
  severity: "fail" | "warn" | "info";
  message: string;
  faceId?: string;
}

interface ForgeState {
  // Model
  modelName: string | null;
  stepUrl: string | null;        // object URL for loaded STEP file
  stepBuffer: ArrayBuffer | null;

  // Selection
  selectionMode: SelectionMode;
  selectedFaceId: string | null;
  selectedFace: SelectedFace | null;

  // Measurement
  measurements: Record<string, { width: number; height: number; depth: number }>;

  // DFM
  dfmIssues: DFMIssue[];

  // Push/pull
  pushPullActive: boolean;

  // AI Rail
  aiSuggestions: Record<string, string>;  // faceId → suggestion text
  aiLoading: boolean;

  // Actions
  loadStepFile: (file: File) => void;
  setSelectionMode: (mode: SelectionMode) => void;
  selectFace: (face: SelectedFace | null) => void;
  setMeasurements: (faceId: string, dims: { width: number; height: number; depth: number }) => void;
  setPushPullActive: (active: boolean) => void;
  setDFMIssues: (issues: DFMIssue[]) => void;
  setAISuggestion: (faceId: string, text: string) => void;
  setAILoading: (loading: boolean) => void;
  clearModel: () => void;
}

export const useForgeStore = create<ForgeState>((set, get) => ({
  modelName: null,
  stepUrl: null,
  stepBuffer: null,
  selectionMode: "face",
  selectedFaceId: null,
  selectedFace: null,
  measurements: {},
  dfmIssues: [],
  pushPullActive: false,
  aiSuggestions: {},
  aiLoading: false,

  loadStepFile: (file: File) => {
    const prev = get().stepUrl;
    if (prev) URL.revokeObjectURL(prev);

    file.arrayBuffer().then(buf => {
      const url = URL.createObjectURL(new Blob([buf], { type: "application/octet-stream" }));
      set({
        modelName: file.name,
        stepUrl: url,
        stepBuffer: buf,
        selectedFaceId: null,
        selectedFace: null,
        dfmIssues: [],
      });
    });
  },

  setSelectionMode: (mode) => set({ selectionMode: mode }),

  selectFace: (face) => set({
    selectedFaceId: face?.id ?? null,
    selectedFace: face,
  }),

  setMeasurements: (faceId, dims) => set(state => ({
    measurements: { ...state.measurements, [faceId]: dims },
  })),

  setPushPullActive: (active) => set({ pushPullActive: active }),

  setDFMIssues: (issues) => set({ dfmIssues: issues }),

  setAISuggestion: (faceId, text) => set(state => ({
    aiSuggestions: { ...state.aiSuggestions, [faceId]: text },
  })),

  setAILoading: (loading) => set({ aiLoading: loading }),

  clearModel: () => {
    const prev = get().stepUrl;
    if (prev) URL.revokeObjectURL(prev);
    set({
      modelName: null,
      stepUrl: null,
      stepBuffer: null,
      selectedFaceId: null,
      selectedFace: null,
      measurements: {},
      dfmIssues: [],
      aiSuggestions: {},
      aiLoading: false,
    });
  },
}));
