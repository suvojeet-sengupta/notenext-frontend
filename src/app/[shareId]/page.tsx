'use client';

import React, { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { 
  FileText, Copy, Download, Trash2, 
  ExternalLink, EyeOff, Loader2, Check,
  CornerDownRight, ListOrdered, WrapText
} from 'lucide-react';
import { importKey, decryptData } from '@/lib/crypto';
import { highlightToLines, mapLanguage } from '@/lib/syntax';

interface PageProps {
  params: Promise<{ shareId: string }>;
}

export const runtime = 'edge';

export default function ViewPastePage(props: PageProps) {
  const router = useRouter();
  const { shareId } = use(props.params);

  // States
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<{
    expiresAt: string | null;
    burnAfterRead: boolean;
    sharedBy: string;
    createdAt: string;
    maxReads: number | null;
  } | null>(null);
  
  const [decryptedData, setDecryptedData] = useState<{
    content: string;
    title: string;
    language: string;
  } | null>(null);

  // Custom Display States
  const [showLineNumbers, setShowLineNumbers] = useState(true);
  const [wrapLines, setWrapLines] = useState(true);
  const [fontSize, setFontSize] = useState<12 | 14 | 16 | 18 | 20>(14);
  const [toast, setToast] = useState<{ message: string; type: 'info' | 'error' } | null>(null);
  const [isCreator, setIsCreator] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

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

  // Load and decrypt/decode note on mount
  useEffect(() => {
    const fetchAndDecrypt = async () => {
      try {
        setLoading(true);
        setError(null);

        // 1. Get the key from the URL hash if present
        const hash = window.location.hash;
        const hexKey = hash && hash.length > 1 ? hash.substring(1) : null;

        // 2. Fetch note from local API proxy route (which manages security and cookies)
        const res = await fetch(`/api/notes/${shareId}`);
        if (res.status === 404) {
          throw new Error('This note does not exist or has expired.');
        }
        if (!res.ok) {
          throw new Error(`Failed to fetch note (HTTP ${res.status})`);
        }

        const note = await res.json();
        setMetadata({
          expiresAt: note.expiresAt,
          burnAfterRead: note.burnAfterRead,
          sharedBy: note.sharedBy || 'Anonymous',
          createdAt: note.createdAt || new Date().toISOString(),
          maxReads: note.maxReads,
        });

        // Safe creator checking returned directly by our secure proxy handler
        setIsCreator(!!note.isCreator);

        // 3. Retrieve content (either decrypting or base64 decoding)
        let contentStr = '';
        let noteTitle = 'Raw Paste';
        let noteLang = 'auto';

        if (hexKey) {
          // Encrypted Mode
          try {
            const cryptoKey = await importKey(hexKey);
            contentStr = await decryptData(note.ciphertext, note.iv, cryptoKey);
          } catch (e) {
            throw new Error('Failed to decrypt note. The key in the URL hash is invalid or corrupted.');
          }

          // Parse JSON wrapper for encrypted metadata
          try {
            const parsed = JSON.parse(contentStr);
            contentStr = parsed.content;
            noteTitle = parsed.title || 'Untitled Note';
            noteLang = parsed.language || 'auto';
          } catch {
            // Fallback if data was encrypted as a plain string instead of JSON
          }
        } else {
          // RawData / Base64 Mode (no key in hash)
          contentStr = base64ToUtf8(note.ciphertext);
          
          // Check if decoded content was wrapped in JSON anyway
          try {
            const parsed = JSON.parse(contentStr);
            if (parsed && typeof parsed === 'object' && 'content' in parsed) {
              contentStr = parsed.content;
              noteTitle = parsed.title || 'Untitled Note';
              noteLang = parsed.language || 'auto';
            }
          } catch {
            // normal plain string, use as content
          }
        }

        setDecryptedData({
          content: contentStr,
          title: noteTitle,
          language: noteLang,
        });
      } catch (err: any) {
        console.error(err);
        setError(err.message || 'An error occurred while loading this note.');
      } finally {
        setLoading(false);
      }
    };

    fetchAndDecrypt();
  }, [shareId]);

  const showToast = (message: string, type: 'info' | 'error' = 'info') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 3000);
  };

  const handleCopyLink = () => {
    if (typeof window !== 'undefined') {
      navigator.clipboard.writeText(window.location.href);
      showToast('Share link copied to clipboard!');
    }
  };

  const handleDownload = () => {
    if (!decryptedData) return;
    
    const content = decryptedData.content;
    const title = decryptedData.title.replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'note';
    
    // Extensions mapping
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
    const mappedLang = mapLanguage(decryptedData.language);
    const ext = extensions[mappedLang] || 'txt';
    const filename = `${title}.${ext}`;

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    showToast(`Downloaded as ${filename}`);
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this paste? This action cannot be undone.')) {
      return;
    }
    
    setIsDeleting(true);
    try {
      // Proxy handles deleteToken securely via HttpOnly cookie
      const res = await fetch(`/api/notes/${shareId}`, {
        method: 'DELETE',
      });
      
      if (!res.ok) {
        throw new Error('Failed to delete note. You might not be authorized.');
      }
      
      // Clean local list
      if (typeof window !== 'undefined') {
        const createdNotes = JSON.parse(localStorage.getItem('nn_created_notes') || '[]');
        const filtered = createdNotes.filter((id: string) => id !== shareId);
        localStorage.setItem('nn_created_notes', JSON.stringify(filtered));
      }

      showToast('Note deleted successfully!');
      setTimeout(() => {
        router.push('/');
      }, 1000);
    } catch (err: any) {
      showToast(err.message || 'Failed to delete note.', 'error');
      setIsDeleting(false);
    }
  };

  // Check if content is a URL
  const isUrlContent = decryptedData ? (() => {
    try {
      const url = new URL(decryptedData.content.trim());
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
      return false;
    }
  })() : false;

  // Process and highlight code
  const codeLines = decryptedData ? highlightToLines(
    decryptedData.content, 
    mapLanguage(decryptedData.language)
  ) : [];

  if (loading) {
    return (
      <div className="flex flex-col flex-1 h-full w-full bg-[#212121] items-center justify-center text-white">
        <Loader2 className="h-8 w-8 animate-spin text-[#ff9800] mb-4" />
        <p className="font-bold text-sm">DECRYPTING NOTE SECURELY CLIENT-SIDE...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col flex-1 h-full w-full bg-[#212121] items-center justify-center text-white select-none">
        <div className="max-w-md p-6 bg-[#1a1a1a] border border-zinc-800 rounded text-center">
          <EyeOff className="h-12 w-12 text-[#ff9800] mx-auto mb-4" />
          <h2 className="text-[#ff9800] font-bold text-lg mb-2">ACCESS FAILED</h2>
          <p className="text-zinc-400 text-xs font-bold leading-5 mb-6">{error}</p>
          <a
            href="/"
            className="inline-block px-6 py-2 bg-[#ff9800] text-black font-bold text-xs rounded hover:bg-amber-600 transition-colors"
          >
            CREATE NEW PASTE
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 h-full w-full bg-[#212121] overflow-hidden select-none">
      {/* Header */}
      <header className="flex w-full justify-between items-center py-3 px-6 bg-[#1a1a1a] border-b border-zinc-800">
        <a href="/" className="hover:opacity-90">
          <span className="font-bold text-xl tracking-tight">
            <span className="text-[#ff9800]">&lt;Note</span>Next/&gt;
          </span>
        </a>

        {/* View Options Toolbar & Action Buttons */}
        <div className="flex items-center gap-3 md:gap-5">
          {/* Options: Line numbers, wrapping, font-size */}
          <div className="hidden sm:flex items-center border-r border-zinc-800 pr-4 mr-2 gap-3 text-zinc-400">
            {/* Wrap Toggle */}
            <button
              onClick={() => setWrapLines(!wrapLines)}
              className={`p-1 rounded cursor-pointer transition-colors ${wrapLines ? 'text-[#ff9800] bg-zinc-800' : 'hover:text-white'}`}
              title="Toggle Wrap Lines"
            >
              <WrapText className="h-4 w-4" />
            </button>

            {/* Line Numbers Toggle */}
            <button
              onClick={() => setShowLineNumbers(!showLineNumbers)}
              className={`p-1 rounded cursor-pointer transition-colors ${showLineNumbers ? 'text-[#ff9800] bg-zinc-800' : 'hover:text-white'}`}
              title="Toggle Line Numbers"
            >
              <ListOrdered className="h-4 w-4" />
            </button>

            {/* Font Size Select */}
            <select
              value={fontSize}
              onChange={(e) => setFontSize(Number(e.target.value) as any)}
              className="bg-[#212121] border border-zinc-800 text-xs px-2 py-0.5 rounded text-white outline-none"
              title="Font Size"
            >
              <option value="12">12px</option>
              <option value="14">14px</option>
              <option value="16">16px</option>
              <option value="18">18px</option>
              <option value="20">20px</option>
            </select>
          </div>

          {/* Copy Button */}
          <button
            onClick={handleCopyLink}
            className="p-1.5 text-white hover:text-[#ff9800] hover:bg-zinc-800/50 rounded-sm transition-colors cursor-pointer"
            title="Copy Share Link"
          >
            <Copy className="h-5 w-5" />
          </button>

          {/* Download Button */}
          <button
            onClick={handleDownload}
            className="p-1.5 text-white hover:text-[#ff9800] hover:bg-zinc-800/50 rounded-sm transition-colors cursor-pointer"
            title="Download Paste"
          >
            <Download className="h-5 w-5" />
          </button>

          {/* Raw Button */}
          <a
            href={`/raw/${shareId}${window.location.hash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1.5 text-white hover:text-[#ff9800] hover:bg-zinc-800/50 rounded-sm transition-colors cursor-pointer"
            title="View Raw text"
          >
            <FileText className="h-5 w-5" />
          </a>

          {/* Delete Button (Creator only) */}
          {isCreator && (
            <button
              onClick={handleDelete}
              disabled={isDeleting}
              className="p-1.5 text-red-500 hover:text-red-400 hover:bg-zinc-800/50 rounded-sm transition-colors cursor-pointer"
              title="Delete Note"
            >
              {isDeleting ? (
                <Loader2 className="h-5 w-5 animate-spin text-red-500" />
              ) : (
                <Trash2 className="h-5 w-5" />
              )}
            </button>
          )}
        </div>
      </header>

      {/* Metadata bar */}
      <section className="bg-[#1a1a1a] border-b border-zinc-800 px-6 py-2 flex flex-wrap gap-x-6 gap-y-1.5 text-xs text-zinc-400 font-bold select-none">
        <div>
          <span className="text-[#ff9800]">TITLE:</span>{' '}
          <span className="text-white">{decryptedData?.title}</span>
        </div>
        <div>
          <span className="text-[#ff9800]">LANGUAGE:</span>{' '}
          <span className="text-white uppercase">{decryptedData?.language}</span>
        </div>
        <div>
          <span className="text-[#ff9800]">SHARED BY:</span>{' '}
          <span className="text-white">{metadata?.sharedBy}</span>
        </div>
        <div>
          <span className="text-[#ff9800]">CREATED:</span>{' '}
          <span className="text-white">
            {metadata ? new Date(metadata.createdAt).toLocaleString() : ''}
          </span>
        </div>
        {metadata?.burnAfterRead && (
          <div className="text-[#ff9800] animate-pulse">
            🔥 BURN AFTER READING ENABLED
          </div>
        )}
      </section>

      {/* Main Content Area */}
      <main className="flex-1 w-full h-full relative overflow-auto bg-[#212121] py-4 selection:bg-[#ff9800]/30 select-text">
        {isUrlContent ? (
          // URL Redirection Mode Card
          <div className="w-full h-full flex items-center justify-center select-none px-6">
            <div className="max-w-md w-full p-6 bg-[#1a1a1a] border border-zinc-800 rounded">
              <div className="flex items-center gap-3 text-[#ff9800] mb-4">
                <CornerDownRight className="h-6 w-6" />
                <h3 className="font-bold text-sm">ENCRYPTED REDIRECT URL</h3>
              </div>
              <p className="text-zinc-400 text-xs mb-6 font-bold break-all leading-5">
                {decryptedData?.content}
              </p>
              <a
                href={decryptedData?.content}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full py-2.5 bg-[#ff9800] text-black font-bold text-xs rounded hover:bg-amber-600 transition-colors"
              >
                OPEN EXTERNAL LINK
                <ExternalLink className="h-4 w-4" />
              </a>
            </div>
          </div>
        ) : (
          // Standard Syntax Highlighted Code Viewer
          <div 
            className="px-6 font-mono font-bold leading-6 overflow-x-auto"
            style={{ fontSize: `${fontSize}px` }}
          >
            {codeLines.map((line, lineIdx) => (
              <div key={lineIdx} className="flex select-text min-w-max hover:bg-zinc-800/10">
                {/* Line number column */}
                {showLineNumbers && (
                  <span className="text-zinc-600 select-none text-right pr-6 w-12 flex-shrink-0 border-r border-zinc-800 mr-4">
                    {lineIdx + 1}
                  </span>
                )}
                
                {/* Code line content */}
                <span className={`flex-1 ${wrapLines ? 'whitespace-pre-wrap break-all' : 'whitespace-pre'}`}>
                  {line.length === 0 ? (
                    // empty line spacer
                    <br />
                  ) : (
                    line.map((token, tokenIdx) => (
                      <span 
                        key={tokenIdx} 
                        className={token.type ? `token ${token.type}` : ''}
                      >
                        {token.content}
                      </span>
                    ))
                  )}
                </span>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="font-bold border-t border-zinc-800 bg-[#1a1a1a] z-10 select-none">
        <div className="flex px-6 py-2.5 text-xs justify-between text-[#ff9800]">
          <a href="/" className="hover:underline">
            © 2026 NoteNext
          </a>
        </div>
      </footer>

      {/* Sleek Custom Toast Notifications */}
      {toast && (
        <div
          className={`fixed bottom-12 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded shadow-lg text-xs font-bold text-center border toast-enter ${
            toast.type === 'error'
              ? 'bg-[#1a1a1a] border-[#ff9800] text-[#ff9800]'
              : 'bg-[#ff9800] border-[#ff9800] text-black'
          }`}
        >
          {toast.message}
        </div>
      )}
    </div>
  );
}
