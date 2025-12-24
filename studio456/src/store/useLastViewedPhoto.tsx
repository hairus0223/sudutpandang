import { create } from "zustand";

interface StoreProps {
  lastViewedPhoto: number | null;
  setLastViewedPhoto: (id: number | null) => void;
}

export const useLastViewedPhoto = create<StoreProps>((set) => ({
  lastViewedPhoto: null,
  setLastViewedPhoto: (id) => set({ lastViewedPhoto: id }),
}));
