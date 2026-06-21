import { create } from "zustand";

// spec §4.3 stores/authStore — P1에서 채움.
interface AuthState {
  role: "admin" | "reviewer" | null;
  isAgreed: boolean;
  isBatchSubmitted: boolean;
  set: (s: Partial<AuthState>) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  role: null,
  isAgreed: false,
  isBatchSubmitted: false,
  set: (s) => set(s),
}));
