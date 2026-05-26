import { it, expect } from 'vitest';

import { parseSolveTimeFromFilename } from './useFrameCount';

it('parses solve time from typical cubing filenames', () => {
  expect(parseSolveTimeFromFilename('1 0.688.mp4')).toBe(0.688);
  expect(parseSolveTimeFromFilename('2 1.07.mp4')).toBe(1.07);
  expect(parseSolveTimeFromFilename('2x2 R1 1.07 avg.mp4')).toBe(1.07);
  expect(parseSolveTimeFromFilename('solve 12.345.mov')).toBe(12.345);
  expect(parseSolveTimeFromFilename('5 1:23.45.mp4')).toBe(83.45); // mm:ss takes priority
});

it('handles paths with directories and odd extensions', () => {
  expect(parseSolveTimeFromFilename('Z:/cubing/260523 Liuzhou Open 2026/2x2 R1 1.07 avg.mp4')).toBe(1.07);
  expect(parseSolveTimeFromFilename('C:\\videos\\1 0.688.mp4')).toBe(0.688);
  expect(parseSolveTimeFromFilename('clip-3.14.mkv')).toBe(3.14);
});

it('returns undefined when no time-like number present', () => {
  expect(parseSolveTimeFromFilename('IMG_0123.mp4')).toBeUndefined();
  expect(parseSolveTimeFromFilename('untitled.mp4')).toBeUndefined();
  expect(parseSolveTimeFromFilename('.hidden')).toBeUndefined();
});

it('rejects out-of-range values', () => {
  expect(parseSolveTimeFromFilename('5000.00.mp4')).toBeUndefined();
  expect(parseSolveTimeFromFilename('0.0.mp4')).toBeUndefined();
});
