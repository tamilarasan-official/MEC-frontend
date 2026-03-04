import { API_ORIGIN } from '../services/api';

export function resolveImageUrl(url?: string | null): string | null {
  if (!url) return null;
  if (url.includes('/placeholder')) return null;
  if (url.startsWith('http')) return url;
  return `${API_ORIGIN}${url}`;
}

export function resolveAvatarUrl(url?: string | null): string | null {
  if (!url) return null;
  if (url.startsWith('http')) return url;
  return `${API_ORIGIN}${url}`;
}
