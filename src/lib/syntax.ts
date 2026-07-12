import Prism from 'prismjs';

// Load Prism languages
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-c';
import 'prismjs/components/prism-cpp';
import 'prismjs/components/prism-go';
import 'prismjs/components/prism-rust';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-yaml';
import 'prismjs/components/prism-sql';
import 'prismjs/components/prism-bash';
import 'prismjs/components/prism-markdown';

export interface FlatToken {
  type: string | null;
  content: string;
}

export function flattenTokens(tokens: any, parentType: string | null = null): FlatToken[] {
  const result: FlatToken[] = [];
  
  if (typeof tokens === 'string') {
    result.push({ type: parentType, content: tokens });
  } else if (Array.isArray(tokens)) {
    for (const t of tokens) {
      result.push(...flattenTokens(t, parentType));
    }
  } else if (tokens && typeof tokens === 'object') {
    const type = tokens.type;
    result.push(...flattenTokens(tokens.content, type));
  }
  
  return result;
}

export function splitIntoLines(flatTokens: FlatToken[]): FlatToken[][] {
  const lines: FlatToken[][] = [[]];
  
  for (const token of flatTokens) {
    const parts = token.content.split('\n');
    for (let i = 0; i < parts.length; i++) {
      if (i > 0) {
        lines.push([]);
      }
      if (parts[i] !== '') {
        lines[lines.length - 1].push({
          type: token.type,
          content: parts[i],
        });
      }
    }
  }
  
  // If the last line is empty and we had a trailing newline, remove it
  if (lines.length > 1 && lines[lines.length - 1].length === 0) {
    lines.pop();
  }
  
  return lines;
}

export function highlightToLines(text: string, lang: string): FlatToken[][] {
  const grammar = Prism.languages[lang];
  if (!grammar) {
    // Fallback if language grammar is not loaded/supported
    return splitIntoLines([{ type: null, content: text }]);
  }
  
  const tokens = Prism.tokenize(text, grammar);
  const flat = flattenTokens(tokens);
  return splitIntoLines(flat);
}

// Map common input names to Prism language identifiers
export function mapLanguage(lang: string): string {
  const mapping: Record<string, string> = {
    'auto': 'javascript', // fallback/default
    'text': 'text',
    'plain': 'text',
    'javascript': 'javascript',
    'js': 'javascript',
    'typescript': 'typescript',
    'ts': 'typescript',
    'python': 'python',
    'py': 'python',
    'cpp': 'cpp',
    'c++': 'cpp',
    'c': 'c',
    'go': 'go',
    'rust': 'rust',
    'rs': 'rust',
    'html': 'html',
    'css': 'css',
    'json': 'json',
    'yaml': 'yaml',
    'yml': 'yaml',
    'sql': 'sql',
    'bash': 'bash',
    'sh': 'bash',
    'markdown': 'markdown',
    'md': 'markdown',
  };
  return mapping[lang.toLowerCase()] || 'text';
}
