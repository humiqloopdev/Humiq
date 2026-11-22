// src/lib/utils.ts
export function cn(...classes: (string | undefined | false | null)[]) {
  return classes.filter(Boolean).join(' ');
}

/** "Jun 14" */
export function formatShortDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/** "just now", "5m ago", "3h ago", "2d ago" */
export function timeAgo(iso: string) {
  const mins = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  if (mins < 60 * 24) return `${Math.floor(mins / 60)}h ago`;
  return `${Math.floor(mins / 1440)}d ago`;
}

/** "$90–130/hr" */
export function formatRate(from: number | null, to: number | null) {
  if (from == null && to == null) return 'Rate not listed';
  if (from == null || to == null || from === to) return `$${from ?? to}/hr`;
  return `$${from}–${to}/hr`;
}

/** "Acme Corp" -> "AC" */
export function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('');
}

/** Pulls the backend's error message out of an axios error (NestJS sends `message`, adapters send `detail`). */
export function apiErrorMessage(err: unknown, fallback = 'Something went wrong') {
  const e = err as { response?: { data?: { detail?: string; message?: string | string[] } }; request?: unknown; message?: string };
  // No response at all: the API is down, or the browser blocked the call (CORS when the page is opened from an unlisted address).
  if (e && !e.response && e.request && e.message === 'Network Error') {
    return 'Cannot reach the server. Make sure the API is running and open the app at http://localhost:5174.';
  }
  const data = e?.response?.data;
  const message = data?.detail ?? data?.message;
  return Array.isArray(message) ? message.join(', ') : message ?? fallback;
}
