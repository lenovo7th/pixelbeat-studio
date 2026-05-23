import { useState, useEffect, useRef } from "react";
import { Track, Pattern, Cell, STEPS } from "./types";
import { createSynth, SynthHandle } from "./instruments";

declare const Tone: any;

export function useSequencer(
  tracks: Track[],
  bpm: number,
  allPatterns: Pattern[],
  chainEnabled: boolean,
  onChainPatternChange?: (patternId: number) => void
) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentStep, setCurrentStep] = useState(-1);
  const [isRecording, setIsRecording] = useState(false);

  const synthsRef = useRef<Map<string, SynthHandle>>(new Map());
  const synthKeyRef = useRef<Map<string, string>>(new Map());
  const sequenceRef = useRef<any>(null);
  const recorderRef = useRef<any>(null);

  const tracksRef = useRef<Track[]>(tracks);
  const allPatternsRef = useRef<Pattern[]>(allPatterns);
  const chainEnabledRef = useRef(chainEnabled);
  const chainIndexRef = useRef(0);
  const bpmRef = useRef(bpm);
  const mergedTracksRef = useRef<Track[] | null>(null);

  useEffect(() => { tracksRef.current = tracks; }, [tracks]);
  useEffect(() => { allPatternsRef.current = allPatterns; }, [allPatterns]);
  useEffect(() => { chainEnabledRef.current = chainEnabled; }, [chainEnabled]);
  useEffect(() => {
    bpmRef.current = bpm;
    try { Tone.Transport.bpm.value = bpm; } catch (_) {}
  }, [bpm]);

  useEffect(() => {
    tracks.forEach(track => {
      const key = `${track.family}:${track.modelId}`;
      if (synthKeyRef.current.get(track.id) !== key) {
        const old = synthsRef.current.get(track.id);
        if (old) old.dispose();
        const handle = createSynth(track.family, track.modelId);
        synthsRef.current.set(track.id, handle);
        synthKeyRef.current.set(track.id, key);
      }
    });
    synthsRef.current.forEach((handle, id) => {
      if (!tracks.find(t => t.id === id)) {
        handle.dispose();
        synthsRef.current.delete(id);
        synthKeyRef.current.delete(id);
      }
    });
  }, [tracks]);

  useEffect(() => {
    return () => {
      if (sequenceRef.current) { try { sequenceRef.current.dispose(); } catch (_) {} }
      synthsRef.current.forEach(h => h.dispose());
    };
  }, []);

  const ensureSynthsForTracks = (mergedTracks: Track[]) => {
    mergedTracks.forEach(track => {
      const key = `${track.family}:${track.modelId}`;
      if (synthKeyRef.current.get(track.id) !== key) {
        const old = synthsRef.current.get(track.id);
        if (old) old.dispose();
        const handle = createSynth(track.family, track.modelId);
        synthsRef.current.set(track.id, handle);
        synthKeyRef.current.set(track.id, key);
      }
    });
  };

  const getActiveTracks = (): Track[] => {
    if (mergedTracksRef.current) return mergedTracksRef.current;
    if (chainEnabledRef.current && allPatternsRef.current.length > 0) {
      return allPatternsRef.current[chainIndexRef.current % allPatternsRef.current.length].tracks;
    }
    return tracksRef.current;
  };

  const triggerNote = (track: Track, note: string, durationSteps: number, time: number) => {
    const handle = synthsRef.current.get(track.id);
    if (!handle) return;
    const vol = Tone.gainToDb(Math.max(0.001, track.volume));
    const durSec = Tone.Time("16n").toSeconds() * durationSteps;

    try {
      if (handle.isDrumKit) {
        const { kick, hihat, snare } = handle.synth;
        kick.volume.value = vol;
        hihat.volume.value = vol;
        snare.volume.value = vol;
        const c = note.charAt(0);
        if (c === "C") { kick.triggerAttackRelease("C1", "8n", time); }
        else if (c === "E" || c === "F") { snare.triggerAttackRelease(Math.min(durSec, 0.2), time); }
        else if (c === "D") { snare.triggerAttackRelease(0.06, time); }
        else { hihat.triggerAttackRelease(Math.min(durSec, 0.15), time); }
      } else {
        handle.synth.volume.value = vol;
        if (typeof handle.synth.triggerAttackRelease === "function") {
          handle.synth.triggerAttackRelease(note, durSec, time);
        } else {
          handle.synth.triggerAttack(note, time);
        }
      }
    } catch (_) {}
  };

  const startInner = async (mergedOverride?: Track[]) => {
    try { await Tone.start(); } catch (_) {}

    if (sequenceRef.current) {
      try { sequenceRef.current.dispose(); } catch (_) {}
      sequenceRef.current = null;
    }
    try { Tone.Transport.stop(); Tone.Transport.cancel(); } catch (_) {}

    chainIndexRef.current = 0;
    mergedTracksRef.current = mergedOverride ?? null;

    if (mergedOverride) ensureSynthsForTracks(mergedOverride);

    Tone.Transport.bpm.value = bpmRef.current;

    sequenceRef.current = new Tone.Sequence(
      (time: number, step: number) => {
        Tone.Draw.schedule(() => {
          setCurrentStep(step);
          if (!mergedTracksRef.current && chainEnabledRef.current && step === STEPS - 1) {
            const next = (chainIndexRef.current + 1) % allPatternsRef.current.length;
            chainIndexRef.current = next;
            onChainPatternChange?.(allPatternsRef.current[next].id);
          }
        }, time);

        const activeTracks = getActiveTracks();
        activeTracks.forEach(track => {
          if (track.muted) return;
          for (let prev = Math.max(0, step - STEPS + 1); prev < step; prev++) {
            const c = track.steps[prev];
            if (c?.active && (c.duration ?? 1) > 1 && prev + (c.duration ?? 1) > step) return;
          }
          const cell = track.steps[step];
          if (!cell?.active) return;
          triggerNote(track, cell.note, cell.duration ?? 1, time);
        });
      },
      Array.from({ length: STEPS }, (_, i) => i),
      "16n"
    );

    sequenceRef.current.start(0);
    Tone.Transport.start();
    setIsPlaying(true);
    setIsPaused(false);
  };

  const play = async () => { await startInner(); };

  const playMerged = async () => {
    const merged = mergeAllPatterns(allPatternsRef.current);
    await startInner(merged);
  };

  const stop = () => {
    try { Tone.Transport.stop(); Tone.Transport.cancel(); } catch (_) {}
    if (sequenceRef.current) {
      try { sequenceRef.current.dispose(); } catch (_) {}
      sequenceRef.current = null;
    }
    mergedTracksRef.current = null;
    setIsPlaying(false);
    setIsPaused(false);
    setCurrentStep(-1);
    chainIndexRef.current = 0;
  };

  const pause = () => {
    try { Tone.Transport.pause(); } catch (_) {}
    setIsPaused(true);
    setIsPlaying(false);
  };

  const resume = () => {
    try { Tone.Transport.start(); } catch (_) {}
    setIsPlaying(true);
    setIsPaused(false);
  };

  // ── Audio recording ──────────────────────────────────────────
  const startRecording = async () => {
    try {
      if (!recorderRef.current) {
        recorderRef.current = new Tone.Recorder();
        Tone.getDestination().connect(recorderRef.current);
      }
      await recorderRef.current.start();
      setIsRecording(true);
    } catch (e) { console.warn("Recorder error", e); }
  };

  const stopAndSave = async () => {
    if (!recorderRef.current) return;
    try {
      const blob = await recorderRef.current.stop();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "pixelbeat-mix.webm";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch (e) { console.warn("Save error", e); }
    setIsRecording(false);
  };

  return { isPlaying, isPaused, currentStep, isRecording, play, playMerged, stop, pause, resume, startRecording, stopAndSave };
}

// ── Merge all patterns into unified track list ────────────────
export function mergeAllPatterns(patterns: Pattern[]): Track[] {
  const trackMap = new Map<string, Track>();

  patterns.forEach(p => {
    p.tracks.forEach(t => {
      const key = `${t.family}:${t.modelId}`;
      if (!trackMap.has(key)) {
        trackMap.set(key, { ...t, steps: t.steps.map((s) => ({ ...s })) });
      } else {
        const existing = trackMap.get(key)!;
        t.steps.forEach((cell, i) => {
          if (cell.active) existing.steps[i] = { ...cell };
        });
      }
    });
  });

  return Array.from(trackMap.values());
}
