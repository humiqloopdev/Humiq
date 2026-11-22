// src/api/auth/authApi.ts
// Adapts the Auth.js (cookie session) + NestJS backend to the shape the auth store expects.
import { AxiosResponse } from 'axios';
import http from '@/lib/http';
import type { RegisterPayload, User, UserRole } from '@/types';

export interface AuthSession {
  user: User;
}

interface ApiUser {
  id: string;
  email: string;
  fullName: string;
  role: string;
  [key: string]: unknown;
}

const toUser = ({ fullName, role, ...rest }: ApiUser): User => ({
  ...rest,
  name: fullName,
  role: (role.endsWith('ADMIN') ? 'admin' : role.toLowerCase()) as UserRole, // ADMIN and SUPER_ADMIN share the admin UI
});

/** Current user, or a 401 when there is no session. */
export const me = async (): Promise<AxiosResponse<User>> => {
  const res = await http.get<ApiUser>('/users/me');
  return { ...res, data: toUser(res.data) };
};

/** Auth.js credentials sign-in: fetch a CSRF token, post the form, then read the user behind the new cookie. */
export const login = async (email: string, password: string): Promise<AxiosResponse<AuthSession>> => {
  const { data: csrf } = await http.get<{ csrfToken: string }>('/auth/csrf');
  const { data } = await http.post<{ url?: string }>(
    '/auth/callback/credentials',
    new URLSearchParams({ csrfToken: csrf.csrfToken, email, password }),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-Auth-Return-Redirect': '1' } }
  );
  if (!data.url || data.url.includes('error=')) {
    throw { response: { status: 401, data: { detail: 'Invalid email or password.' } } };
  }
  const user = await me();
  return { ...user, data: { user: user.data } };
};

export const register = async (payload: RegisterPayload): Promise<AxiosResponse<AuthSession>> => {
  if (payload.role === 'admin') throw new Error('Admin accounts cannot be self-registered.');
  await http.post(`/auth/${payload.role}/signup`, {
    fullName: payload.name,
    email: payload.email,
    password: payload.password,
  });
  return login(payload.email, payload.password);
};

export const logout = async (): Promise<AxiosResponse<void>> => {
  const { data: csrf } = await http.get<{ csrfToken: string }>('/auth/csrf');
  return http.post(
    '/auth/signout',
    new URLSearchParams({ csrfToken: csrf.csrfToken }),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-Auth-Return-Redirect': '1' } }
  );
};

/** The backend has no per-device sessions, so signing out everywhere is the same as signing out. */
export const logoutAll = logout;

// Not built on the backend yet (no email service / OAuth credentials): these calls will return 404.
export const forgotPassword = (email: string): Promise<AxiosResponse<{ detail: string }>> =>
  http.post('/auth/password/reset/', { email });

export const resetPassword = (token: string, newPwd: string): Promise<AxiosResponse<{ detail: string }>> =>
  http.post('/auth/password/reset/confirm/', { token, new_password: newPwd });

export const googleOAuth = (accessToken: string): Promise<AxiosResponse<AuthSession>> =>
  http.post('/auth/google/', { access_token: accessToken });

export const linkedinOAuth = (code: string): Promise<AxiosResponse<AuthSession>> =>
  http.post('/auth/linkedin/', { code });
