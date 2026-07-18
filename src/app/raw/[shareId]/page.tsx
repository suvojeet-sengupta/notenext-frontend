'use client';

import React, { useState, useEffect, use } from 'react';
import { importKey, decryptData } from '@/lib/crypto';
import { fetchNote } from '@/lib/api';
import { Loader2 } from 'lucide-react';

interface RawPageProps {
  params: Promise<{ shareId: string }>;
}

export const runtime = 'edge';

export default function RawPastePage(props: RawPageProps) {
  const { shareId } = use(props.params);
  
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Safe UTF-8 Base64 Decoder
  const base64ToUtf8 = (base64: string) => {
    try {
      return decodeURIComponent(
        atob(base64)
          .split('')
          .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
    } catch (e) {
      return atob(base64); // Fallback
    }
  };

  useEffect(() => {
    const fetchAndDecryptRaw = async () => {
      try {
        setLoading(true);
        setError(null);

        // 1. Read hash key
        const hash = window.location.hash;
        const hexKey = hash && hash.length > 1 ? hash.substring(1) : null;

        // 2. Fetch ciphertext directly from the backend
        const res = await fetchNote(shareId);
        if (res.status === 404) {
          throw new Error('This note does not exist or has expired.');
        }
        if (!res.ok) {
          throw new Error(`Failed to fetch note (HTTP ${res.status})`);
        }

        const note = await res.json();

        // 3. Decrypt or Decode
        let contentStr = '';

        // Check if the API returned plain content directly (no ciphertext)
        if (note.content && !note.ciphertext) {
          contentStr = note.content;
        } else if (hexKey) {
          try {
            const cryptoKey = await importKey(hexKey);
            contentStr = await decryptData(note.ciphertext, note.iv, cryptoKey);
          } catch (e) {
            throw new Error('Failed to decrypt note. The key in the URL hash is invalid.');
          }

          // Check if data is wrapped in JSON (for Title/Language metadata support)
          try {
            const parsed = JSON.parse(contentStr);
            if (parsed && typeof parsed === 'object' && 'content' in parsed) {
              contentStr = parsed.content;
            }
          } catch {
            // Raw text fallback
          }
        } else {
          // RawData / Base64 Mode
          contentStr = base64ToUtf8(note.ciphertext);
          
          try {
            const parsed = JSON.parse(contentStr);
            if (parsed && typeof parsed === 'object' && 'content' in parsed) {
              contentStr = parsed.content;
            }
          } catch {
            // Raw text fallback
          }
        }

        setContent(contentStr);
      } catch (err: any) {
        console.error(err);
        setError(err.message || 'Error loading raw content.');
      } finally {
        setLoading(false);
      }
    };

    fetchAndDecryptRaw();
  }, [shareId]);

  if (loading) {
    return (
      <div className="flex h-full w-full bg-[#1e1e1e] items-center justify-center text-zinc-400 font-mono p-6">
        <Loader2 className="h-5 w-5 animate-spin mr-3 text-[#ff9800]" />
        <span>Loading raw content...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full w-full bg-[#1e1e1e] text-red-400 font-mono p-6 whitespace-pre-wrap">
        Error: {error}
      </div>
    );
  }

  return (
    <pre 
      className="h-full w-full bg-[#1e1e1e] text-white font-mono p-6 whitespace-pre-wrap break-all overflow-auto selection:bg-[#ff9800]/30 select-text"
      style={{ fontFamily: 'monospace', fontSize: '14px', lineHeight: '20px' }}
    >
      {content}
    </pre>
  );
}
