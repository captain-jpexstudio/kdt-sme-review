import axios from "axios";

// spec §4.4 / §12: 쿠키 인증, Base /api/v1
export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost/api/v1",
  withCredentials: true,
});
