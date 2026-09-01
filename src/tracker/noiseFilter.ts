export const DEFAULT_NOISE_PATTERNS = [
  'node_modules/**',
  '**/*.lock',
  'package-lock.json',
  'pnpm-lock.yaml',
  'yarn.lock',
  'Cargo.lock',
  'poetry.lock',
  '**/.env*',
  'dist/**',
  'build/**',
  'out/**',
  '.next/**',
  '.nuxt/**',
  '.git/**',
];

export function globToRegex(pattern: string): RegExp {
  const normPattern = pattern.replace(/\\/g, '/');
  let reStr = normPattern
    .replace(/\./g, '\\.')
    .replace(/\*\*\//g, '(?:.*/)?')
    .replace(/\*\*/g, '.*')
    .replace(/\*/g, '[^/]*');

  if (!normPattern.startsWith('/') && !normPattern.startsWith('(?:.*/)?') && !normPattern.startsWith('.*')) {
    reStr = '(?:^|.*/)' + reStr;
  } else if (!reStr.startsWith('^')) {
    reStr = '^' + reStr;
  }
  if (!reStr.endsWith('$')) {
    reStr = reStr + '$';
  }
  return new RegExp(reStr, 'i');
}

export function isNoiseFile(filePath: string, patterns: string[] = DEFAULT_NOISE_PATTERNS): boolean {
  if (!filePath) return false;
  const norm = filePath.replace(/\\/g, '/');
  const basename = norm.split('/').pop() || '';

  for (const pattern of patterns) {
    if (pattern === 'node_modules/**' || pattern.includes('node_modules')) {
      if (norm.includes('/node_modules/') || norm.startsWith('node_modules/') || norm === 'node_modules') return true;
    }
    if (pattern === 'package-lock.json' && basename === 'package-lock.json') return true;
    if (pattern === 'pnpm-lock.yaml' && basename === 'pnpm-lock.yaml') return true;
    if (pattern === 'yarn.lock' && basename === 'yarn.lock') return true;
    if (pattern === 'Cargo.lock' && basename === 'Cargo.lock') return true;
    if (pattern === 'poetry.lock' && basename === 'poetry.lock') return true;

    try {
      const rx = globToRegex(pattern);
      if (rx.test(norm) || rx.test(basename)) return true;
    } catch {
      if (norm.includes(pattern.replace(/\*/g, ''))) return true;
    }
  }

  return false;
}
