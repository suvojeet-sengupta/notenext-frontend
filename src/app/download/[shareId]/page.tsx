'use client';

import React, { useState, useEffect, use } from 'react';
import { importKey, decryptData } from '@/lib/crypto';
import { mapLanguage } from '@/lib/syntax';
import { Loader2, Download, CheckCircle } from 'lucide-react';

interface DownloadPageProps {
  params: Promise<{ shareId: string }>;
}

export const runtime = 'edge';

export default function DownloadPastePage(props: DownloadPageProps) {
  const { shareId } = use(props.params);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloaded, setDownloaded] = useState(false);

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
    const triggerDownload = async () => {
      try {
        setLoading(true);
        setError(null);

        // 1. Read hash key
        const hash = window.location.hash;
        const hexKey = hash && hash.length > 1 ? hash.substring(1) : null;

        // 2. Fetch note from local proxy
        const res = await fetch(`/api/notes/${shareId}`);
        if (res.status === 404) {
          throw new Error('This note does not exist or has expired.');
        }
        if (!res.ok) {
          throw new Error(`Failed to fetch note (HTTP ${res.status})`);
        }

        const note = await res.json();

        // 3. Decrypt or Decode
        let content = '';
        let title = 'note';
        let language = 'text';

        if (hexKey) {
          try {
            const cryptoKey = await importKey(hexKey);
            content = await decryptData(note.ciphertext, note.iv, cryptoKey);
          } catch (e) {
            throw new Error('Failed to decrypt note. The key in the URL hash is invalid.');
          }

          // Check if data is wrapped in JSON (metadata)
          try {
            const parsed = JSON.parse(content);
            content = parsed.content;
            title = parsed.title || 'note';
            language = parsed.language || 'text';
          } catch {
            // fallback
          }
        } else {
          // RawData / Base64 Mode
          content = base64ToUtf8(note.ciphertext);
          
          try {
            const parsed = JSON.parse(content);
            if (parsed && typeof parsed === 'object' && 'content' in parsed) {
              content = parsed.content;
              title = parsed.title || 'note';
              language = parsed.language || 'text';
            }
          } catch {
            // fallback
          }
        }

        // 4. File extension mapping
        const extensions: Record<string, string> = {
          'text': 'txt',
          'markdown': 'md',
          'javascript': 'js',
          'typescript': 'ts',
          'python': 'py',
          'cpp': 'cpp',
          'c': 'c',
          'go': 'go',
          'rust': 'rs',
          'html': 'html',
          'css': 'css',
          'json': 'json',
          'yaml': 'yaml',
          'sql': 'sql',
          'bash': 'sh',
        };
        const mappedLang = mapLanguage(language);
        const ext = extensions[mappedLang] || 'txt';
        const safeTitle = title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        const filename = `${safeTitle}.${ext}`;

        // 5. Trigger download
        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
        
        setDownloaded(true);
      } catch (err: any) {
        console.error(err);
        setError(err.message || 'Error downloading file.');
      } finally {
        setLoading(false);
      }
    };

    triggerDownload();
  }, [shareId]);

  return (
    <div className="flex flex-col flex-1 h-full w-full bg-[#212121] items-center justify-center text-white select-none p-6">
      <div className="max-w-md w-full p-8 bg-[#1a1a1a] border border-zinc-800 rounded text-center">
        {loading && (
          <>
            <Loader2 className="h-10 w-10 animate-spin text-[#ff9800] mx-auto mb-4" />
            <h2 className="text-[#ff9800] font-bold text-sm">DECRYPTING AND PREPARING DOWNLOAD...</h2>
          </>
        )}
        
        {error && (
          <>
            <Download className="h-10 w-10 text-red-500 mx-auto mb-4" />
            <h2 className="text-red-500 font-bold text-sm mb-2">DOWNLOAD FAILED</h2>
            <p className="text-zinc-400 text-xs leading-5 mb-6">{error}</p>
            <a
              href="/"
              className="inline-block px-6 py-2 bg-[#ff9800] text-black font-bold text-xs rounded hover:bg-amber-600 transition-colors"
            >
              CREATE NEW PASTE
            </a>
          </>
        )}

        {downloaded && (
          <>
            <CheckCircle className="h-10 w-10 text-green-500 mx-auto mb-4" />
            <h2 className="text-green-500 font-bold text-sm mb-2">DOWNLOAD STARTED</h2>
            <p className="text-zinc-400 text-xs leading-5 mb-6">
              Your file is downloading. If it didn't start, please click the button below to retry.
            </p>
            <div className="flex flex-col gap-3">
              <button
                onClick={() => window.location.reload()}
                className="px-6 py-2.5 bg-[#ff9800] text-black font-bold text-xs rounded hover:bg-amber-600 transition-colors cursor-pointer"
              >
                RETRY DOWNLOAD
              </button>
              <a
                href={`/${shareId}${window.location.hash}`}
                className="text-xs text-zinc-500 hover:text-white underline transition-colors"
              >
                Back to paste view
              </a>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
