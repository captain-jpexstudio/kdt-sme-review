import { api } from "./api";

export interface AuthState {
  role: "admin" | "reviewer";
  is_agreed: boolean;
  is_batch_submitted: boolean;
}

export async function login(username: string, password: string): Promise<AuthState> {
  const { data } = await api.post<AuthState>("/auth/login", { username, password });
  return data;
}

export async function getMe(): Promise<AuthState> {
  const { data } = await api.get<AuthState>("/auth/me");
  return data;
}

export interface AgreementPayload {
  typed_name: string;
  signature_png: string;
  checkbox_states: { security_copyright: boolean; privacy: boolean; tax: boolean };
}

export async function postAgreement(p: AgreementPayload): Promise<void> {
  await api.post("/auth/agreement", p);
}
