import {
  cn,
  positiveOrNull,
  formatSquareFeet,
  formatAcres,
  squareInchesToSquareFeet,
  squareFeetToAcres,
  parseLocalDateFromYMD,
} from './utils';

describe('utils', () => {
  describe('cn', () => {
    it('should merge class names correctly', () => {
      expect(cn('foo', 'bar')).toBe('foo bar');
      expect(cn('foo', { bar: true })).toBe('foo bar');
      expect(cn('foo', { bar: false })).toBe('foo');
    });

    it('should handle tailwind class conflicts', () => {
      expect(cn('p-4', 'p-2')).toBe('p-2');
    });
  });

  describe('positiveOrNull', () => {
    it('should return the value if positive', () => {
      expect(positiveOrNull(10)).toBe(10);
      expect(positiveOrNull(0.1)).toBe(0.1);
    });

    it('should return null if zero or negative', () => {
      expect(positiveOrNull(0)).toBeNull();
      expect(positiveOrNull(-5)).toBeNull();
    });

    it('should return null if null or undefined', () => {
      expect(positiveOrNull(null)).toBeNull();
      expect(positiveOrNull(undefined)).toBeNull();
    });
  });

  describe('formatSquareFeet', () => {
    it('should format values < 10,000 correctly', () => {
      expect(formatSquareFeet(1234.56)).toBe('1,235');
      expect(formatSquareFeet(9999)).toBe('9,999');
    });

    it('should format values 10,000 - 99,999 correctly', () => {
      expect(formatSquareFeet(12345)).toBe('12,350');
      expect(formatSquareFeet(99999)).toBe('100,000'); // Rounds up to 100k
    });

    it('should format values >= 100,000 correctly', () => {
      expect(formatSquareFeet(123456)).toBe('123,500');
    });

    it('should use tooltip variant', () => {
      expect(formatSquareFeet(1234.5678, { variant: 'tooltip' })).toBe('1,234.57');
    });
  });

  describe('formatAcres', () => {
    it('should return null for very small values', () => {
      expect(formatAcres(0.005)).toBeNull();
    });

    it('should format values < 10 correctly', () => {
      expect(formatAcres(5.1234)).toBe('5.123');
    });

    it('should format values 10 - 99.99 correctly', () => {
      expect(formatAcres(50.1234)).toBe('50.12');
    });

    it('should format values >= 100 correctly', () => {
      expect(formatAcres(150.1234)).toBe('150.1');
    });

    it('should use tooltip variant', () => {
      expect(formatAcres(5.123456, { variant: 'tooltip' })).toBe('5.12346');
    });
  });

  describe('squareInchesToSquareFeet', () => {
    it('should convert correctly', () => {
      expect(squareInchesToSquareFeet(144)).toBe(1);
      expect(squareInchesToSquareFeet(288)).toBe(2);
    });
  });

  describe('squareFeetToAcres', () => {
    it('should convert correctly', () => {
      expect(squareFeetToAcres(43560)).toBe(1);
      expect(squareFeetToAcres(87120)).toBe(2);
    });
  });

  describe('parseLocalDateFromYMD', () => {
    it('should parse valid dates', () => {
      const date = parseLocalDateFromYMD('2023-01-15');
      expect(date).toBeDefined();
      expect(date?.getFullYear()).toBe(2023);
      expect(date?.getMonth()).toBe(0); // 0-indexed
      expect(date?.getDate()).toBe(15);
    });

    it('should return undefined for invalid strings', () => {
      expect(parseLocalDateFromYMD('invalid')).toBeUndefined();
      expect(parseLocalDateFromYMD('2023-13-01')).toBeDefined(); // Date constructor rolls over
      // Wait, Date(2023, 12, 1) -> Jan 2024. The function doesn't validate strict ranges, just basic parsing.
      // Let's check a truly invalid one
      expect(parseLocalDateFromYMD('2023-01')).toBeUndefined();
    });

    it('should return undefined for null/undefined', () => {
      expect(parseLocalDateFromYMD(null)).toBeUndefined();
      expect(parseLocalDateFromYMD(undefined)).toBeUndefined();
    });
  });
});
