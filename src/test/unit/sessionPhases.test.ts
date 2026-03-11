import { describe, it, expect } from 'vitest';
import {
  STRUCTURED_4HR_PHASES,
  STRUCTURED_2HR_PHASES,
  getFormatPhases,
  getFormatLabel,
} from '@/lib/sessionPhases';

describe('sessionPhases', () => {
  describe('STRUCTURED_4HR_PHASES', () => {
    it('has 5 phases', () => {
      expect(STRUCTURED_4HR_PHASES).toHaveLength(5);
    });

    it('totals 240 minutes', () => {
      const total = STRUCTURED_4HR_PHASES.reduce((sum, p) => sum + p.duration_minutes, 0);
      expect(total).toBe(240);
    });

    it('starts with icebreaker and ends with wrap-up', () => {
      expect(STRUCTURED_4HR_PHASES[0].phase_type).toBe('icebreaker');
      expect(STRUCTURED_4HR_PHASES[4].phase_type).toBe('wrap_up');
    });

    it('has sequential phase_order from 1 to 5', () => {
      STRUCTURED_4HR_PHASES.forEach((p, i) => {
        expect(p.phase_order).toBe(i + 1);
      });
    });
  });

  describe('STRUCTURED_2HR_PHASES', () => {
    it('has 5 phases', () => {
      expect(STRUCTURED_2HR_PHASES).toHaveLength(5);
    });

    it('totals 120 minutes', () => {
      const total = STRUCTURED_2HR_PHASES.reduce((sum, p) => sum + p.duration_minutes, 0);
      expect(total).toBe(120);
    });

    it('starts with icebreaker and ends with wrap-up', () => {
      expect(STRUCTURED_2HR_PHASES[0].phase_type).toBe('icebreaker');
      expect(STRUCTURED_2HR_PHASES[4].phase_type).toBe('wrap_up');
    });

    it('has sequential phase_order from 1 to 5', () => {
      STRUCTURED_2HR_PHASES.forEach((p, i) => {
        expect(p.phase_order).toBe(i + 1);
      });
    });
  });

  describe('getFormatPhases', () => {
    it('returns 4hr phases for structured_4hr', () => {
      expect(getFormatPhases('structured_4hr')).toBe(STRUCTURED_4HR_PHASES);
    });

    it('returns 2hr phases for structured_2hr', () => {
      expect(getFormatPhases('structured_2hr')).toBe(STRUCTURED_2HR_PHASES);
    });

    it('returns empty array for casual', () => {
      expect(getFormatPhases('casual')).toEqual([]);
    });

    it('returns empty array for unknown format', () => {
      expect(getFormatPhases('something_else')).toEqual([]);
    });
  });

  describe('getFormatLabel', () => {
    it('returns "Structured 4hr" for structured_4hr', () => {
      expect(getFormatLabel('structured_4hr')).toBe('Structured 4hr');
    });

    it('returns "Structured 2hr" for structured_2hr', () => {
      expect(getFormatLabel('structured_2hr')).toBe('Structured 2hr');
    });

    it('returns "Casual" for casual', () => {
      expect(getFormatLabel('casual')).toBe('Casual');
    });

    it('returns "Casual" for null', () => {
      expect(getFormatLabel(null)).toBe('Casual');
    });

    it('returns "Casual" for unknown format', () => {
      expect(getFormatLabel('unknown')).toBe('Casual');
    });
  });
});
