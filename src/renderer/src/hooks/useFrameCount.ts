import { useCallback, useMemo, useState } from 'react';
import i18n from 'i18next';

import type { SegmentBase, StateSegment, UpdateSegAtIndex } from '../types';
import type { HandleError } from '../contexts';


export const FRAME_COUNT_TAG_INPUT = 'framecount.inputTime';
export const FRAME_COUNT_TAG_FPS = 'framecount.fps';
export const FRAME_COUNT_TAG_INDEX = 'framecount.solveIndex';


export interface FrameCountSolve {
  segment: StateSegment,
  index: number, // index in cutSegments
  solveIndex: number, // from tag, 1-based, monotonic per file
  inputTime: number, // seconds (as displayed on timer)
  fps: number,
  startTime: number,
  stopTime: number,
}


export function isFrameCountSegment(segment: { tags?: Record<string, string> | undefined }) {
  return segment.tags?.[FRAME_COUNT_TAG_INPUT] != null;
}


function parseInputTimeString(raw: string): number | undefined {
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  // accept "1.07", "01.07", or "mm:ss.ss"
  if (trimmed.includes(':')) {
    const parts = trimmed.split(':');
    if (parts.length !== 2) return undefined;
    const m = Number(parts[0]);
    const s = Number(parts[1]);
    if (!Number.isFinite(m) || !Number.isFinite(s)) return undefined;
    return m * 60 + s;
  }
  const n = Number(trimmed);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}


export default function useFrameCount({
  enabled,
  getRelevantTime,
  detectedFps,
  cutSegments,
  loadCutSegments,
  removeSegment,
  updateSegAtIndex,
  fileDuration,
  handleError,
}: {
  enabled: boolean,
  getRelevantTime: () => number,
  detectedFps: number | undefined,
  cutSegments: StateSegment[],
  loadCutSegments: (opts: {
    segments: SegmentBase[],
    append: boolean,
    clampDuration?: number,
    getNextCurrentSegIndex?: (newEdl: SegmentBase[]) => number,
  }) => void,
  removeSegment: (index: number, wholeSegment?: true) => void,
  updateSegAtIndex: UpdateSegAtIndex,
  fileDuration: number | undefined,
  handleError: HandleError,
}) {
  const [inputTimeStr, setInputTimeStr] = useState('');

  const solves = useMemo<FrameCountSolve[]>(() => (
    cutSegments.flatMap((segment, index) => {
      const { tags } = segment;
      if (!tags || tags[FRAME_COUNT_TAG_INPUT] == null) return [];
      const inputTime = Number(tags[FRAME_COUNT_TAG_INPUT]);
      const fps = Number(tags[FRAME_COUNT_TAG_FPS]);
      const solveIndex = Number(tags[FRAME_COUNT_TAG_INDEX]);
      if (!Number.isFinite(inputTime) || !Number.isFinite(fps) || !Number.isFinite(solveIndex)) return [];
      const startTime = segment.start;
      const stopTime = segment.end ?? segment.start;
      return [{ segment, index, solveIndex, inputTime, fps, startTime, stopTime }];
    })
  ), [cutSegments]);

  const nextSolveIndex = useMemo<number>(() => (
    solves.reduce<number>((max, s) => Math.max(max, s.solveIndex), 0) + 1
  ), [solves]);

  const addSolve = useCallback(() => {
    if (!enabled) return;
    try {
      const inputTime = parseInputTimeString(inputTimeStr);
      if (inputTime == null) {
        throw new Error(i18n.t('Please enter the solve time (seconds) first, e.g. 1.07'));
      }
      const fps = detectedFps;
      if (fps == null || !Number.isFinite(fps) || fps <= 0) {
        throw new Error(i18n.t('Could not detect video frame rate; open a video first'));
      }
      const stopTime = getRelevantTime();
      const framesBack = Math.round(inputTime * fps);
      const startTime = Math.max(0, stopTime - framesBack / fps);

      const newSolveIndex = nextSolveIndex;
      const name = `Solve ${newSolveIndex} (${inputTime}s)`;
      // loadCutSegments' segment type doesn't statically declare `tags`, but
      // tags are honored at runtime (createSegment forwards them through).
      const segmentWithTags = {
        start: startTime,
        end: stopTime,
        name,
        tags: {
          [FRAME_COUNT_TAG_INPUT]: String(inputTime),
          [FRAME_COUNT_TAG_FPS]: String(fps),
          [FRAME_COUNT_TAG_INDEX]: String(newSolveIndex),
        },
      };
      loadCutSegments({
        segments: [segmentWithTags as SegmentBase],
        append: true,
        ...(fileDuration != null && { clampDuration: fileDuration }),
        getNextCurrentSegIndex: (edl) => edl.length - 1,
      });
      setInputTimeStr('');
    } catch (err) {
      handleError({ err, title: i18n.t('Failed to add solve') });
    }
  }, [enabled, inputTimeStr, detectedFps, getRelevantTime, nextSolveIndex, loadCutSegments, fileDuration, handleError]);

  const removeSolve = useCallback((solveIndex: number) => {
    const idx = cutSegments.findIndex((s) => s.tags?.[FRAME_COUNT_TAG_INDEX] === String(solveIndex));
    if (idx !== -1) removeSegment(idx, true);
  }, [cutSegments, removeSegment]);

  const updateSolveTime = useCallback((solveIndex: number, newInputTimeStr: string) => {
    try {
      const newInputTime = parseInputTimeString(newInputTimeStr);
      if (newInputTime == null) {
        throw new Error(i18n.t('Please enter a valid solve time'));
      }
      const idx = cutSegments.findIndex((s) => s.tags?.[FRAME_COUNT_TAG_INDEX] === String(solveIndex));
      if (idx === -1) return;
      const seg = cutSegments[idx];
      if (!seg || seg.end == null || !seg.tags) return;
      const fps = Number(seg.tags[FRAME_COUNT_TAG_FPS]);
      if (!Number.isFinite(fps) || fps <= 0) return;
      const stopTime = seg.end;
      const framesBack = Math.round(newInputTime * fps);
      const newStart = Math.max(0, stopTime - framesBack / fps);
      updateSegAtIndex(idx, {
        start: newStart,
        name: `Solve ${solveIndex} (${newInputTime}s)`,
        tags: { ...seg.tags, [FRAME_COUNT_TAG_INPUT]: String(newInputTime) },
      });
    } catch (err) {
      handleError({ err, title: i18n.t('Failed to update solve') });
    }
  }, [cutSegments, updateSegAtIndex, handleError]);

  return {
    inputTimeStr,
    setInputTimeStr,
    solves,
    nextSolveIndex,
    addSolve,
    removeSolve,
    updateSolveTime,
  };
}
