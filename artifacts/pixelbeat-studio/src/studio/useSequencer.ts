import { useState, useEffect, useRef } from "react";
import { Track, Pattern, STEPS } from "./types";
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

  const synthsRef = useRef<Map<string, SynthHandle>>(new Map());
  const synthKeyRef = useRef<Map<string, string>>(new Map());
  const sequenceRef = useRef<any>(null);

  const tracksRef = useRef<Track[]>(tracks);
  const allPatternsRef = useRef<Pattern[]>(allPatterns);
  const chainEnabledRef = useRef(chainEnabled);
  const chainIndexRef = useRef(0);
  const bpmRef = useRef(bpm);

  useEffect(() => { tracksRef.current = tracks; }, [tracks]);
  useEffect(() => { allPatternsRef.current = allPatterns; }, [allPatterns]);
  useEffect(() => { chainEnabledRef.current = chainEnabled; }, [chainEnabled]);
  useEffect(() => {
    bpmRef.current = bpm;
    try { Tone.Transport.bpm.value = bpm; } catch (_) {}
  }, [bpm]);

  // Recreate synths whenever family/modelId changes on any track
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
    // Remove synths for deleted tracks
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

  const getActiveTracks = (): Track[] => {
    if (chainEnabledRef.current && allPatternsRef.current.length > 0) {
      return allPatternsRef.current[chainIndexRef.current % allPatternsRef.current.length].tracks;
    }
    return tracksRef.current;
  };

  const triggerNote = (track: Track, note: string, durationSteps: number, time: number) => {
    const handle = synthsRef.current.get(track.id);
    if (!handle) return;
    const vol = Tone.gainToDb(Math.max(0.001, track.volume));
    // Duration in seconds = 16n * durationSteps
    const durSec = Tone.Time("16n").toSeconds() * durationSteps;

    try {
      if (handle.isDrumKit) {
        const { kick, hihat, snare } = handle.synth;
        kick.volume.value = vol;
        hihat.volume.value = vol;
        snare.volume.value = vol;
        const c = note.charAt(0);
        if (c === "C") {
          kick.triggerAttackRelease("C1", "8n", time);
        } else if (c === "E" || c === "F") {
          snare.triggerAttackRelease(Math.min(durSec, 0.2), time);
        } else if (c === "D") {
          // clap via snare with short decay
          snare.triggerAttackRelease(0.06, time);
        } else {
          hihat.triggerAttackRelease(Math.min(durSec, 0.15), time);
        }
      } else {
        handle.synth.volume.value = vol;
        if (track.family === "guitar" || track.family === "bass") {
          // PluckSynth only has triggerAttack, regular Synth has triggerAttackRelease
          if (typeof handle.synth.triggerAttackRelease === "function") {
            handle.synth.triggerAttackRelease(note, durSec, time);
          } else {
            handle.synth.triggerAttack(note, time);
          }
        } else {
          handle.synth.triggerAttackRelease(note, durSec, time);
        }
      }
    } catch (_) {}
  };

  const play = async () => {
    try { await Tone.start(); } catch (_) {}

    if (sequenceRef.current) {
      try { sequenceRef.current.dispose(); } catch (_) {}
      sequenceRef.current = null;
    }
    try { Tone.Transport.stop(); Tone.Transport.cancel(); } catch (_) {}

    chainIndexRef.current = 0;
    Tone.Transport.bpm.value = bpmRef.current;

    sequenceRef.current = new Tone.Sequence(
      (time: number, step: number) => {
        Tone.Draw.schedule(() => {
          setCurrentStep(step);
          if (chainEnabledRef.current && step === STEPS - 1) {
            const next = (chainIndexRef.current + 1) % allPatternsRef.current.length;
            chainIndexRef.current = next;
            onChainPatternChange?.(allPatternsRef.current[next].id);
          }
        }, time);

        const activeTracks = getActiveTracks();
        activeTracks.forEach(track => {
          if (track.muted) return;

          // Skip if this step is a "tail" of a stretched note from an earlier step
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

  const stop = () => {
    try { Tone.Transport.stop(); Tone.Transport.cancel(); } catch (_) {}
    if (sequenceRef.current) {
      try { sequenceRef.current.dispose(); } catch (_) {}
      sequenceRef.current = null;
    }
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

  return { isPlaying, isPaused, currentStep, play, stop, pause, resume };
}
