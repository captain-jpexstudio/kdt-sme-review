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
  // 백엔드 REQUIRED_CONSENTS = (security, ip_rights, privacy, tax) — api/auth.py
  checkbox_states: { security: boolean; ip_rights: boolean; privacy: boolean; tax: boolean };
}

export async function postAgreement(p: AgreementPayload): Promise<void> {
  await api.post("/auth/agreement", p);
}
