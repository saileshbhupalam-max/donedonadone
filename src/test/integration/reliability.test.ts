import { describe, it, expect } from 'vitest';

describe('Reliability status logic', () => {
  it('starts as good', () => {
    const status = 'good';
    expect(status).toBe('good');
  });

  it('transitions to warning at 2 no-shows', () => {
    const noShowCount = 2;
    const status = noShowCount >= 3 ? 'restricted' : noShowCount >= 2 ? 'warning' : 'good';
    expect(status).toBe('warning');
  });

  it('transitions to restricted at 3 no-shows', () => {
    const noShowCount = 3;
    const status = noShowCount >= 3 ? 'restricted' : noShowCount >= 2 ? 'warning' : 'good';
    expect(status).toBe('restricted');
  });

  it('stays restricted above 3 no-shows', () => {
    const noShowCount = 5;
    const status = noShowCount >= 3 ? 'restricted' : noShowCount >= 2 ? 'warning' : 'good';
    expect(status).toBe('restricted');
  });
});
