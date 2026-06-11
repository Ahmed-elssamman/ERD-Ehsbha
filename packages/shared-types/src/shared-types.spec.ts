import { describe, it, expect } from 'vitest'
import { brand, isBrand, unsafeBrand } from './brand'
import {
  MoneyPiastres, DistanceMeters, DurationSeconds,
  isMoneyPiastres, isDistanceMeters, isDurationSeconds,
} from './units'
import { isLocale, parseLocale, getLocales } from './locale'
import {
  isIanaTimezone, isUtcInstant, isCalendarDate,
  validateIanaTimezone, validateUtcInstant, validateCalendarDate,
} from './time'

describe('brand', () => {
  it('creates a branded value', () => {
    const id = brand<string, 'TestId'>('abc')
    expect(id).toBe('abc')
  })

  it('isBrand returns true for valid guard match', () => {
    const strGuard = (v: unknown): v is string => typeof v === 'string'
    expect(isBrand('hello', strGuard)).toBe(true)
  })

  it('isBrand returns false for guard mismatch', () => {
    const strGuard = (v: unknown): v is string => typeof v === 'string'
    expect(isBrand(42, strGuard)).toBe(false)
  })

  it('unsafeBrand casts without validation', () => {
    const id = unsafeBrand<string, 'UnsafeId'>('xyz')
    expect(id).toBe('xyz')
  })
})

describe('units', () => {
  it('MoneyPiastres accepts safe integers', () => {
    expect(MoneyPiastres(0)).toBe(0)
    expect(MoneyPiastres(100)).toBe(100)
    expect(MoneyPiastres(Number.MAX_SAFE_INTEGER)).toBe(Number.MAX_SAFE_INTEGER)
  })

  it('MoneyPiastres rejects non-safe integers', () => {
    expect(() => MoneyPiastres(1.5)).toThrow()
    expect(() => MoneyPiastres(NaN)).toThrow()
    expect(() => MoneyPiastres(Infinity)).toThrow()
  })

  it('DistanceMeters accepts safe integers', () => {
    expect(DistanceMeters(0)).toBe(0)
    expect(DistanceMeters(500)).toBe(500)
  })

  it('DistanceMeters rejects non-safe integers', () => {
    expect(() => DistanceMeters(3.14)).toThrow()
  })

  it('DurationSeconds accepts safe integers', () => {
    expect(DurationSeconds(0)).toBe(0)
    expect(DurationSeconds(3600)).toBe(3600)
  })

  it('DurationSeconds rejects non-safe integers', () => {
    expect(() => DurationSeconds(-1.5)).toThrow()
  })

  it('isMoneyPiastres guards correctly', () => {
    expect(isMoneyPiastres(100)).toBe(true)
    expect(isMoneyPiastres(1.5)).toBe(false)
  })

  it('isDistanceMeters guards correctly', () => {
    expect(isDistanceMeters(0)).toBe(true)
    expect(isDistanceMeters('foo')).toBe(false)
  })

  it('isDurationSeconds guards correctly', () => {
    expect(isDurationSeconds(30)).toBe(true)
    expect(isDurationSeconds(null)).toBe(false)
  })
})

describe('locale', () => {
  it('isLocale returns true for ar and en', () => {
    expect(isLocale('ar')).toBe(true)
    expect(isLocale('en')).toBe(true)
  })

  it('isLocale returns false for other values', () => {
    expect(isLocale('fr')).toBe(false)
    expect(isLocale('')).toBe(false)
  })

  it('parseLocale returns locale for valid input', () => {
    expect(parseLocale('ar')).toBe('ar')
    expect(parseLocale('en')).toBe('en')
  })

  it('parseLocale throws for invalid input', () => {
    expect(() => parseLocale('fr')).toThrow()
  })

  it('getLocales returns both locales', () => {
    expect(getLocales()).toEqual(['ar', 'en'])
  })
})

describe('time', () => {
  describe('IANA timezone', () => {
    it('validates common timezones', () => {
      expect(isIanaTimezone('UTC')).toBe(true)
      expect(isIanaTimezone('Africa/Cairo')).toBe(true)
      expect(isIanaTimezone('Asia/Riyadh')).toBe(true)
      expect(isIanaTimezone('America/New_York')).toBe(true)
    })

    it('rejects invalid timezones', () => {
      expect(isIanaTimezone('')).toBe(false)
      expect(isIanaTimezone('Invalid/Zone')).toBe(false)
    })

    it('validateIanaTimezone returns the value for valid input', () => {
      expect(validateIanaTimezone('UTC')).toBe('UTC')
    })

    it('validateIanaTimezone throws for invalid input', () => {
      expect(() => validateIanaTimezone('Bogus/Place')).toThrow()
    })
  })

  describe('UTC instant', () => {
    it('accepts valid ISO-8601 UTC strings', () => {
      expect(isUtcInstant('2026-06-11T12:00:00Z')).toBe(true)
      expect(isUtcInstant('2026-06-11T12:00:00.000Z')).toBe(true)
      expect(isUtcInstant('2026-06-11T12:00:00+02:00')).toBe(true)
    })

    it('rejects invalid UTC strings', () => {
      expect(isUtcInstant('')).toBe(false)
      expect(isUtcInstant('not-a-date')).toBe(false)
      expect(isUtcInstant('2026-13-01T00:00:00Z')).toBe(false)
    })

    it('validateUtcInstant returns value for valid input', () => {
      expect(validateUtcInstant('2026-06-11T12:00:00Z')).toBe('2026-06-11T12:00:00Z')
    })

    it('validateUtcInstant throws for invalid input', () => {
      expect(() => validateUtcInstant('bad')).toThrow()
    })
  })

  describe('calendar date', () => {
    it('accepts valid YYYY-MM-DD dates', () => {
      expect(isCalendarDate('2026-06-11')).toBe(true)
      expect(isCalendarDate('2026-01-01')).toBe(true)
      expect(isCalendarDate('2026-12-31')).toBe(true)
    })

    it('rejects invalid calendar dates', () => {
      expect(isCalendarDate('')).toBe(false)
      expect(isCalendarDate('2026-13-01')).toBe(false)
      expect(isCalendarDate('2026-00-15')).toBe(false)
      expect(isCalendarDate('2026-02-30')).toBe(false)
    })

    it('validateCalendarDate returns value for valid input', () => {
      expect(validateCalendarDate('2026-06-11')).toBe('2026-06-11')
    })

    it('validateCalendarDate throws for invalid input', () => {
      expect(() => validateCalendarDate('2026-02-30')).toThrow()
    })
  })
})
