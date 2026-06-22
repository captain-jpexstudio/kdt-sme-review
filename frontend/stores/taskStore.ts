import { create } from "zustand";

// spec §4.3 stores/taskStore — P3에서 채움 (목록·현재 항목·필터·검색).
interface TaskState {
  currentId: string | null;
  filter: "all" | "pending" | "in_progress" | "completed";
  query: string;
  sort: "seq" | "status" | "recent";
  set: (s: Partial<TaskState>) => void;
}

export const useTaskStore = create<TaskState>((set) => ({
  currentId: null,
  filter: "all",
  query: "",
  sort: "seq",
  set: (s) => set(s),
}));
