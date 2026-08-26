import { describe, expect, it } from 'vitest';
import { formatBytes, toLocalDatetimeInput } from './format';

describe('formatBytes', () => {
  it('renders 0 bytes as { value: 0, unitKey: "b" }', () => {
    expect(formatBytes(0)).toEqual({ value: 0, unitKey: 'b' });
  });

  it('renders 1023 bytes as bytes, not kilobytes', () => {
    expect(formatBytes(1023)).toEqual({ value: 1023, unitKey: 'b' });
  });

  it('renders 1024 bytes as 1 kilobyte', () => {
    expect(formatBytes(1024)).toEqual({ value: 1, unitKey: 'kb' });
  });

  it('renders 1 MiB as 1 megabyte', () => {
    expect(formatBytes(1024 * 1024)).toEqual({ value: 1, unitKey: 'mb' });
  });

  it('renders 10.5 MiB as 10.5 megabytes', () => {
    expect(formatBytes(10.5 * 1024 * 1024)).toEqual({ value: 10.5, unitKey: 'mb' });
  });
});

describe('toLocalDatetimeInput', () => {
  it('round-trips through a datetime-local-shaped string', () => {
    const date = new Date(2026, 7, 20, 10, 30);

    expect(toLocalDatetimeInput(date)).toBe('2026-08-20T10:30');
  });

  it('zero-pads single-digit month, day, hour, and minute', () => {
    const date = new Date(2026, 0, 5, 9, 5);

    expect(toLocalDatetimeInput(date)).toBe('2026-01-05T09:05');
  });
});
