import { useState, useEffect, useRef } from "react";
import { Track } from "./types";
import { createInstruments } from "./instruments";

declare const Tone: any;

export function useSequencer(tracks: Track[], bpm: number) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const synthsRef = useRef<any>(null);
  const sequenceRef = useRef<any>(null);

  useEffect(() => {
    if (!synthsRef.current) {
      synthsRef.current = createInstruments();
    }
    return () => {
      if (synthsRef.current) {
        synthsRef.current.piano.dispose();
        synthsRef.current.violin.dispose();
        synthsRef.current.guitar.dispose();
        synthsRef.current.drums.kick.dispose();
        synthsRef.current.drums.hihat.dispose();
      }
    };
  }, []);

  useEffect(() => {
    Tone.Transport.bpm.value = bpm;
  }, [bpm]);

  const getSynthForTrack = (id: string) => {
    return synthsRef.current[id];
  };

  const play = async () => {
    await Tone.start();
    Tone.Transport.bpm.value = bpm;
    
    if (sequenceRef.current) {
      sequenceRef.current.dispose();
    }

    sequenceRef.current = new Tone.Sequence((time: any, step: number) => {
      Tone.Draw.schedule(() => {
        setCurrentStep(step);
      }, time);

      tracks.forEach(track => {
        if (track.muted) return;
        const cell = track.steps[step];
        if (!cell.active) return;
        
        const synth = getSynthForTrack(track.id);
        
        try {
          if (track.id === "drums") {
            synth.kick.volume.value = Tone.gainToDb(track.volume);
            synth.hihat.volume.value = Tone.gainToDb(track.volume);
            
            if (step % 4 === 0) synth.kick.triggerAttackRelease("C1", "8n", time);
            else synth.hihat.triggerAttackRelease("16n", time);
          } else {
            synth.volume.value = Tone.gainToDb(track.volume);
            if (track.id === "guitar") {
              synth.triggerAttack(cell.note, time);
            } else {
              synth.triggerAttackRelease(cell.note, "8n", time);
            }
          }
        } catch(e) {
           console.error("Playback error:", e);
        }
      });
    }, Array.from({length:16},(_,i)=>i), "16n");

    sequenceRef.current.start(0);
    Tone.Transport.start();
    setIsPlaying(true);
    setIsPaused(false);
  };

  const stop = () => {
    Tone.Transport.stop();
    if (sequenceRef.current) sequenceRef.current.stop(0);
    setIsPlaying(false);
    setIsPaused(false);
    setCurrentStep(0);
  };

  const pause = () => {
    Tone.Transport.pause();
    setIsPaused(true);
    setIsPlaying(false);
  };

  return { isPlaying, isPaused, currentStep, play, stop, pause };
}
