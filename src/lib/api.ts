// Central backend API configuration.
//
// The browser talks to the backend directly (no server-side proxy), so this
// value must be reachable from the client. Override it per-environment with
// the NEXT_PUBLIC_API_BASE_URL build-time env var.
//
// NOTE: because calls are cross-origin now, the backend must send CORS headers
// (Access-Control-Allow-Origin for the frontend origin, plus the methods and
// headers used below) or the browser will block the requests.
export const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_BASE_URL || 'https://api-notenext.suvojeetsengupta.in'
).replace(/\/$/, '');

// LocalStorage helpers for the note delete-token (creator proof).
const tokenKey = (shareId: string) => `nn_delete_token_${shareId}`;

export function saveDeleteToken(shareId: string, token: string) {
  if (typeof window === 'undefined' || !token) return;
  localStorage.setItem(tokenKey(shareId), token);
  const created = JSON.parse(localStorage.getItem('nn_created_notes') || '[]');
  if (!created.includes(shareId)) {
    created.push(shareId);
    localStorage.setItem('nn_created_notes', JSON.stringify(created));
  }
}

export function getDeleteToken(shareId: string): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(tokenKey(shareId));
}

export function isCreator(shareId: string): boolean {
  if (typeof window === 'undefined') return false;
  if (localStorage.getItem(tokenKey(shareId))) return true;
  const created = JSON.parse(localStorage.getItem('nn_created_notes') || '[]');
  return created.includes(shareId);
}

export function clearDeleteToken(shareId: string) {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(tokenKey(shareId));
  const created = JSON.parse(localStorage.getItem('nn_created_notes') || '[]');
  localStorage.setItem(
    'nn_created_notes',
    JSON.stringify(created.filter((id: string) => id !== shareId))
  );
}

// Fetch a note directly from the backend.
export async function fetchNote(shareId: string): Promise<Response> {
  return fetch(`${API_BASE_URL}/api/notes/${shareId}`);
}

// Delete a note directly from the backend using the stored delete token.
export async function deleteNote(shareId: string): Promise<Response> {
  const token = getDeleteToken(shareId) || '';
  if (!token) {
    // Mimic the old proxy's 403 so callers keep their existing error handling.
    return new Response(
      JSON.stringify({ error: 'Only the creator of this note can delete it.' }),
      { status: 403, headers: { 'Content-Type': 'application/json' } }
    );
  }
  return fetch(
    `${API_BASE_URL}/api/notes/${shareId}?token=${encodeURIComponent(token)}&deleteToken=${encodeURIComponent(token)}`,
    {
      method: 'DELETE',
      headers: {
        'X-Delete-Token': token,
        'Delete-Token': token,
        accept: '*/*',
      },
    }
  );
}
