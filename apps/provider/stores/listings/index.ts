import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

// ── Types ──────────────────────────────────────────────────────────────────────

type ListingCategory = "hotel" | "apartment" | "car";

interface ListingWizardState {
  draftId: string | null;
  draftCategory: ListingCategory | null;
  activeStep: number;
  isDirty: boolean;
  lastSavedAt: string | null;
}

interface ListingStore extends ListingWizardState {
  setDraft: (id: string, category: ListingCategory) => void;
  setActiveStep: (step: number) => void;
  markDirty: () => void;
  markSaved: () => void;
  resetWizard: () => void;
}

// ── Initial state ──────────────────────────────────────────────────────────────

const initial: ListingWizardState = {
  draftId: null,
  draftCategory: null,
  activeStep: 0,
  isDirty: false,
  lastSavedAt: null,
};

// ── Store ──────────────────────────────────────────────────────────────────────

export const useListingStore = create<ListingStore>()(
  persist(
    (set) => ({
      ...initial,

      setDraft: (id, category) =>
        set({ draftId: id, draftCategory: category }),

      setActiveStep: (step) => set({ activeStep: step }),

      markDirty: () => set({ isDirty: true }),

      markSaved: () =>
        set({
          isDirty: false,
          lastSavedAt: new Date().toISOString(),
        }),

      resetWizard: () => set(initial),
    }),
    {
      name: "zika:listing-wizard",
      storage: createJSONStorage(() => sessionStorage),
    },
  ),
);
