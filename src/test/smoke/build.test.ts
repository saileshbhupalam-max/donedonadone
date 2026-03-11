import { describe, it, expect } from 'vitest';
import { existsSync } from 'fs';
import { resolve } from 'path';

describe('Build artifacts', () => {
  it('has package.json', () => {
    expect(existsSync(resolve(__dirname, '../../../package.json'))).toBe(true);
  });

  it('has index.html', () => {
    expect(existsSync(resolve(__dirname, '../../../index.html'))).toBe(true);
  });

  it('has main entry point', () => {
    expect(existsSync(resolve(__dirname, '../../main.tsx'))).toBe(true);
  });

  it('has App component', () => {
    expect(existsSync(resolve(__dirname, '../../App.tsx'))).toBe(true);
  });
});

describe('Critical files exist', () => {
  const criticalFiles = [
    'src/lib/personality.ts',
    'src/lib/antifragile.ts',
    'src/lib/growth.ts',
    'src/lib/types.ts',
    'src/lib/ranks.ts',
    'src/hooks/useGeolocation.ts',
    'src/contexts/AuthContext.tsx',
    'src/contexts/PersonalityContext.tsx',
    'src/components/session/CheckInButton.tsx',
    'src/components/ui/PersonalityLoader.tsx',
  ];

  criticalFiles.forEach(file => {
    it(`${file} exists`, () => {
      expect(existsSync(resolve(__dirname, '../../../', file))).toBe(true);
    });
  });
});
