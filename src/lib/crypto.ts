// Client-side AES-GCM encryption utility for zero-knowledge NoteNext note sharing.
// These functions use the Web Crypto API, which is only available in browser environments.

export async function generateKey(): Promise<CryptoKey> {
  if (typeof window === 'undefined') {
    throw new Error('Web Crypto is only available in the browser.');
  }
  return window.crypto.subtle.generateKey(
    {
      name: 'AES-GCM',
      length: 256,
    },
    true, // extractable
    ['encrypt', 'decrypt']
  );
}

// Encodes the key in Base64url to shorten the URL hash fragment
export async function exportKey(key: CryptoKey): Promise<string> {
  const exported = await window.crypto.subtle.exportKey('raw', key);
  return arrayBufferToBase64Url(exported);
}

// Imports the key supporting both modern Base64url (43 chars) and legacy Hex (64 chars)
export async function importKey(keyString: string): Promise<CryptoKey> {
  if (typeof window === 'undefined') {
    throw new Error('Web Crypto is only available in the browser.');
  }
  
  let keyBuffer: ArrayBuffer;
  
  if (keyString.length === 64 && /^[0-9a-fA-F]{64}$/.test(keyString)) {
    // Legacy Hex key
    const byteLen = keyString.length / 2;
    const arr = new Uint8Array(byteLen);
    for (let i = 0; i < byteLen; i++) {
      arr[i] = parseInt(keyString.substring(i * 2, (i * 2) + 2), 16);
    }
    keyBuffer = arr.buffer;
  } else if (keyString.length === 43) {
    // Modern Base64url key
    keyBuffer = base64UrlToArrayBuffer(keyString);
  } else {
    throw new Error('Invalid key format. Expected a 43-character base64url or 64-character hex string.');
  }
  
  return window.crypto.subtle.importKey(
    'raw',
    keyBuffer,
    {
      name: 'AES-GCM',
    },
    true,
    ['encrypt', 'decrypt']
  );
}

export async function encryptData(
  plaintext: string,
  key: CryptoKey
): Promise<{ ciphertext: string; iv: string }> {
  const encoder = new TextEncoder();
  const data = encoder.encode(plaintext);
  
  // AES-GCM recommended IV length is 12 bytes
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  
  const encryptedBuffer = await window.crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv,
    },
    key,
    data
  );
  
  return {
    ciphertext: arrayBufferToBase64(encryptedBuffer),
    iv: arrayBufferToBase64(iv.buffer),
  };
}

export async function decryptData(
  ciphertextBase64: string,
  ivBase64: string,
  key: CryptoKey
): Promise<string> {
  const encryptedBuffer = base64ToArrayBuffer(ciphertextBase64);
  const ivBuffer = base64ToArrayBuffer(ivBase64);
  
  const decryptedBuffer = await window.crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: new Uint8Array(ivBuffer),
    },
    key,
    encryptedBuffer
  );
  
  const decoder = new TextDecoder();
  return decoder.decode(decryptedBuffer);
}

// Helper to convert ArrayBuffer to Base64
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return typeof window !== 'undefined' ? window.btoa(binary) : Buffer.from(binary, 'binary').toString('base64');
}

// Helper to convert Base64 to ArrayBuffer
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = typeof window !== 'undefined' ? window.atob(base64) : Buffer.from(base64, 'base64').toString('binary');
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

// Helper to convert ArrayBuffer to Base64url (no padding, url safe)
function arrayBufferToBase64Url(buffer: ArrayBuffer): string {
  const base64 = arrayBufferToBase64(buffer);
  return base64
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

// Helper to convert Base64url to ArrayBuffer
function base64UrlToArrayBuffer(base64url: string): ArrayBuffer {
  let base64 = base64url
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  
  // Re-add padding
  while (base64.length % 4) {
    base64 += '=';
  }
  return base64ToArrayBuffer(base64);
}
