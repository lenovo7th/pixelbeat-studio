import React, { useState, useRef, useEffect, useCallback } from "react";

declare const Tone: any;

interface EffectSettings {
  pitchShift: number;       // -24 to +24 semitones
  autotuneOn: boolean;
  autotuneStrength: number; // window size ms: 0 (robotic) to 1 (natural)
  reverbMix: number;        // 0-1
  reverbDecay: number;      // 0.5-8 sec
  delayTime: number;        // 0-1 sec
  delayFeedback: number;    // 0-0.9
  chorusDepth: number;      // 0-1
  chorusRate: number;       // 0.1-8 hz
  distortion: number;       // 0-1
  outputGain: number;       // 0-2
  bypass: boolean;
}

const DEFAULT_EFFECTS: EffectSettings = {
  pitchShift: 0,
  autotuneOn: false,
  autotuneStrength: 0.2,
  reverbMix: 0.2,
  reverbDecay: 1.5,
  delayTime: 0,
  delayFeedback: 0.3,
  chorusDepth: 0,
  chorusRate: 1.5,
  distortion: 0,
  outputGain: 1,
  bypass: false,
};

export default function VoiceStudio() {
  const [fx, setFx] = useState<EffectSettings>(DEFAULT_EFFECTS);
  const [micEnabled, setMicEnabled] = useState(false);
  const [micError, setMicError] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [recordingBlob, setRecordingBlob] = useState<Blob | null>(null);
  const [playbackUrl, setPlaybackUrl] = useState<string | null>(null);
  const [level, setLevel] = useState(0);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const analyserRef = useRef<AnalyserNode | null>(null);

  // Tone nodes
  const micRef = useRef<any>(null);
  const pitchRef = useRef<any>(null);
  const chorusRef = useRef<any>(null);
  const reverbRef = useRef<any>(null);
  const delayRef = useRef<any>(null);
  const distRef = useRef<any>(null);
  const gainRef = useRef<any>(null);
  const analyserToneRef = useRef<any>(null);

  // MediaRecorder for capture
  const mediaRecRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const fxRef = useRef(fx);
  useEffect(() => { fxRef.current = fx; }, [fx]);

  // ── Build / rebuild the effect chain ─────────────────────────
  const buildChain = useCallback(async () => {
    // Tear down existing
    if (micRef.current) { try { await micRef.current.close(); } catch (_) {} }
    [pitchRef, chorusRef, reverbRef, delayRef, distRef, gainRef, analyserToneRef].forEach(r => {
      if (r.current) { try { r.current.dispose(); } catch (_) {} r.current = null; }
    });

    try {
      await Tone.start();

      const mic = new Tone.UserMedia();
      await mic.open();
      micRef.current = mic;

      const pitch = new Tone.PitchShift({
        pitch: fx.pitchShift,
        windowSize: fx.autotuneOn ? lerp(0.02, 0.2, 1 - fx.autotuneStrength) : 0.1,
        feedback: 0,
        wet: fx.autotuneOn ? 1 : (fx.pitchShift !== 0 ? 1 : 0),
      });
      pitchRef.current = pitch;

      const chorus = new Tone.Chorus({
        rate: fx.chorusRate,
        depth: fx.chorusDepth,
        wet: fx.chorusDepth > 0 ? 0.5 : 0,
      }).start();
      chorusRef.current = chorus;

      const reverb = new Tone.Reverb({ decay: fx.reverbDecay, wet: fx.reverbMix });
      reverbRef.current = reverb;

      const delay = new Tone.FeedbackDelay({
        delayTime: Math.max(0.001, fx.delayTime),
        feedback: fx.delayFeedback,
        wet: fx.delayTime > 0 ? 0.5 : 0,
      });
      delayRef.current = delay;

      const dist = new Tone.Distortion({ distortion: fx.distortion, wet: fx.distortion > 0 ? 1 : 0 });
      distRef.current = dist;

      const gainNode = new Tone.Gain(fx.outputGain);
      gainRef.current = gainNode;

      const analyserTone = new Tone.Analyser({ type: "waveform", size: 256 });
      analyserToneRef.current = analyserTone;

      mic.connect(pitch);
      pitch.connect(chorus);
      chorus.connect(reverb);
      reverb.connect(delay);
      delay.connect(dist);
      dist.connect(gainNode);
      gainNode.connect(analyserTone);

      if (!fx.bypass) gainNode.connect(Tone.getDestination());

      // Also grab the raw audio context analyser for level meter
      const actx = Tone.getContext().rawContext as AudioContext;
      const analyserNode = actx.createAnalyser();
      analyserNode.fftSize = 256;
      analyserRef.current = analyserNode;

      setMicEnabled(true);
      setMicError("");
      startWaveformDraw(analyserTone);
    } catch (e: any) {
      setMicError(e?.message || "Microphone access denied");
      setMicEnabled(false);
    }
  }, []); // eslint-disable-line

  const teardownChain = async () => {
    cancelAnimationFrame(animRef.current);
    if (micRef.current) { try { await micRef.current.close(); } catch (_) {} micRef.current = null; }
    [pitchRef, chorusRef, reverbRef, delayRef, distRef, gainRef, analyserToneRef].forEach(r => {
      if (r.current) { try { r.current.dispose(); } catch (_) {} r.current = null; }
    });
    setMicEnabled(false);
    setLevel(0);
  };

  // ── Waveform draw ─────────────────────────────────────────────
  const startWaveformDraw = (analyser: any) => {
    cancelAnimationFrame(animRef.current);
    const canvas = canvasRef.current;

    const draw = () => {
      animRef.current = requestAnimationFrame(draw);
      if (!canvas) return;
      const ctx = canvas.getContext("2d")!;
      const W = canvas.width, H = canvas.height;

      let values: Float32Array;
      try { values = analyser.getValue() as Float32Array; } catch (_) { return; }

      ctx.fillStyle = "#0a0b0e";
      ctx.fillRect(0, 0, W, H);

      // Grid lines
      ctx.strokeStyle = "rgba(30,34,53,0.8)";
      ctx.lineWidth = 1;
      for (let i = 0; i <= 4; i++) {
        ctx.beginPath();
        ctx.moveTo(0, (H / 4) * i);
        ctx.lineTo(W, (H / 4) * i);
        ctx.stroke();
      }

      // Waveform
      ctx.beginPath();
      ctx.lineWidth = 2;
      ctx.strokeStyle = "#00e5ff";
      const sliceW = W / values.length;
      let maxAmp = 0;
      values.forEach((v, i) => {
        const x = i * sliceW;
        const y = ((v + 1) / 2) * H;
        maxAmp = Math.max(maxAmp, Math.abs(v));
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.shadowColor = "#00e5ff";
      ctx.shadowBlur = 6;
      ctx.stroke();
      ctx.shadowBlur = 0;

      setLevel(maxAmp);
    };
    draw();
  };

  // Cleanup on unmount
  useEffect(() => () => { cancelAnimationFrame(animRef.current); teardownChain(); }, []);

  // ── Live update effects without rebuild ───────────────────────
  useEffect(() => {
    if (!micEnabled) return;
    try {
      if (pitchRef.current) {
        pitchRef.current.pitch = fx.pitchShift;
        pitchRef.current.wet.value = (fx.autotuneOn || fx.pitchShift !== 0) ? 1 : 0;
        if (fx.autotuneOn) {
          pitchRef.current.windowSize = lerp(0.02, 0.2, 1 - fx.autotuneStrength);
        }
      }
      if (chorusRef.current) {
        chorusRef.current.rate.value = fx.chorusRate;
        chorusRef.current.depth = fx.chorusDepth;
        chorusRef.current.wet.value = fx.chorusDepth > 0 ? 0.5 : 0;
      }
      if (reverbRef.current) {
        reverbRef.current.wet.value = fx.reverbMix;
      }
      if (delayRef.current) {
        delayRef.current.delayTime.value = Math.max(0.001, fx.delayTime);
        delayRef.current.feedback.value = fx.delayFeedback;
        delayRef.current.wet.value = fx.delayTime > 0 ? 0.5 : 0;
      }
      if (distRef.current) {
        distRef.current.distortion = fx.distortion;
        distRef.current.wet.value = fx.distortion > 0 ? 1 : 0;
      }
      if (gainRef.current) {
        gainRef.current.gain.value = fx.outputGain;
      }
    } catch (_) {}
  }, [fx, micEnabled]);

  // ── Recording ─────────────────────────────────────────────────
  const startRecording = () => {
    if (!gainRef.current) return;
    try {
      const dest = (Tone.getContext().rawContext as AudioContext).createMediaStreamDestination();
      gainRef.current.connect(new Tone.Gain(1).connect(dest));
      const mr = new MediaRecorder(dest.stream, { mimeType: "audio/webm" });
      chunksRef.current = [];
      mr.ondataavailable = e => chunksRef.current.push(e.data);
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setRecordingBlob(blob);
        if (playbackUrl) URL.revokeObjectURL(playbackUrl);
        setPlaybackUrl(URL.createObjectURL(blob));
      };
      mr.start(100);
      mediaRecRef.current = mr;
      setIsRecording(true);
    } catch (e) { console.warn("Rec error", e); }
  };

  const stopRecording = () => {
    if (mediaRecRef.current?.state !== "inactive") mediaRecRef.current?.stop();
    setIsRecording(false);
  };

  const saveRecording = () => {
    if (!recordingBlob) return;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(recordingBlob);
    a.download = "voice-recording.webm";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const set = (patch: Partial<EffectSettings>) => setFx(prev => ({ ...prev, ...patch }));

  const SCALE_NOTES = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];

  return (
    <div className="voice-studio">
      {/* ── Mic toggle + status ── */}
      <div className="vs-header">
        <div className="vs-title">
          <span className="vs-icon">🎤</span>
          <span>VOICE STUDIO</span>
          <span className="vs-subtitle">Real-time vocal processing</span>
        </div>
        <div className="vs-mic-controls">
          {!micEnabled ? (
            <button className="mic-enable-btn" onClick={buildChain}>
              <span>⊕</span> ENABLE MICROPHONE
            </button>
          ) : (
            <button className="mic-disable-btn" onClick={teardownChain}>
              <span>⊗</span> DISABLE MIC
            </button>
          )}
          {micError && <span className="mic-error">{micError}</span>}
        </div>
      </div>

      {/* ── Waveform visualizer ── */}
      <div className="vs-visualizer">
        <canvas ref={canvasRef} width={900} height={100} className="waveform-canvas" />
        <div className="level-bar-wrap">
          <div className="level-bar" style={{ width: `${Math.min(100, level * 100)}%` }} />
        </div>
      </div>

      {/* ── Effect chain ── */}
      <div className="vs-effects">

        {/* AUTOTUNE / PITCH */}
        <div className="vs-card">
          <div className="vs-card-header">
            <span className="vs-card-title">PITCH / AUTOTUNE</span>
            <label className="fx-toggle">
              <input type="checkbox" checked={fx.autotuneOn} onChange={e => set({ autotuneOn: e.target.checked })} />
              <span className="fx-toggle-track" />
              <span className="fx-toggle-label">{fx.autotuneOn ? "ON" : "OFF"}</span>
            </label>
          </div>
          <div className="vs-knob-row">
            <div className="vs-knob">
              <span className="vk-label">PITCH SHIFT</span>
              <input type="range" min="-24" max="24" step="1" value={fx.pitchShift}
                onChange={e => set({ pitchShift: parseInt(e.target.value) })}
                className="vk-slider" style={{ "--vc": "#00e5ff" } as any} />
              <span className="vk-value">{fx.pitchShift > 0 ? "+" : ""}{fx.pitchShift} st</span>
            </div>
            <div className="vs-knob">
              <span className="vk-label">AUTOTUNE STRENGTH</span>
              <input type="range" min="0" max="1" step="0.01" value={fx.autotuneStrength}
                onChange={e => set({ autotuneStrength: parseFloat(e.target.value) })}
                className="vk-slider" style={{ "--vc": "#d500f9" } as any}
                disabled={!fx.autotuneOn} />
              <span className="vk-value">{Math.round(fx.autotuneStrength * 100)}%</span>
            </div>
          </div>
          {/* Scale note selector */}
          <div className="scale-notes">
            <span className="vk-label">SNAP TO KEY</span>
            <div className="scale-btns">
              {SCALE_NOTES.map(n => (
                <button key={n} className="scale-btn" disabled={!fx.autotuneOn}>{n}</button>
              ))}
            </div>
          </div>
        </div>

        {/* REVERB */}
        <div className="vs-card">
          <div className="vs-card-header"><span className="vs-card-title">REVERB</span></div>
          <div className="vs-knob-row">
            <div className="vs-knob">
              <span className="vk-label">MIX</span>
              <input type="range" min="0" max="1" step="0.01" value={fx.reverbMix}
                onChange={e => set({ reverbMix: parseFloat(e.target.value) })}
                className="vk-slider" style={{ "--vc": "#39ff14" } as any} />
              <span className="vk-value">{Math.round(fx.reverbMix * 100)}%</span>
            </div>
            <div className="vs-knob">
              <span className="vk-label">DECAY</span>
              <input type="range" min="0.3" max="8" step="0.1" value={fx.reverbDecay}
                onChange={e => set({ reverbDecay: parseFloat(e.target.value) })}
                className="vk-slider" style={{ "--vc": "#39ff14" } as any} />
              <span className="vk-value">{fx.reverbDecay.toFixed(1)}s</span>
            </div>
          </div>
        </div>

        {/* DELAY */}
        <div className="vs-card">
          <div className="vs-card-header"><span className="vs-card-title">DELAY / ECHO</span></div>
          <div className="vs-knob-row">
            <div className="vs-knob">
              <span className="vk-label">TIME</span>
              <input type="range" min="0" max="1" step="0.01" value={fx.delayTime}
                onChange={e => set({ delayTime: parseFloat(e.target.value) })}
                className="vk-slider" style={{ "--vc": "#ffb300" } as any} />
              <span className="vk-value">{(fx.delayTime * 1000).toFixed(0)}ms</span>
            </div>
            <div className="vs-knob">
              <span className="vk-label">FEEDBACK</span>
              <input type="range" min="0" max="0.9" step="0.01" value={fx.delayFeedback}
                onChange={e => set({ delayFeedback: parseFloat(e.target.value) })}
                className="vk-slider" style={{ "--vc": "#ffb300" } as any} />
              <span className="vk-value">{Math.round(fx.delayFeedback * 100)}%</span>
            </div>
          </div>
        </div>

        {/* CHORUS */}
        <div className="vs-card">
          <div className="vs-card-header"><span className="vs-card-title">CHORUS</span></div>
          <div className="vs-knob-row">
            <div className="vs-knob">
              <span className="vk-label">DEPTH</span>
              <input type="range" min="0" max="1" step="0.01" value={fx.chorusDepth}
                onChange={e => set({ chorusDepth: parseFloat(e.target.value) })}
                className="vk-slider" style={{ "--vc": "#76ff03" } as any} />
              <span className="vk-value">{Math.round(fx.chorusDepth * 100)}%</span>
            </div>
            <div className="vs-knob">
              <span className="vk-label">RATE</span>
              <input type="range" min="0.1" max="8" step="0.1" value={fx.chorusRate}
                onChange={e => set({ chorusRate: parseFloat(e.target.value) })}
                className="vk-slider" style={{ "--vc": "#76ff03" } as any} />
              <span className="vk-value">{fx.chorusRate.toFixed(1)} Hz</span>
            </div>
          </div>
        </div>

        {/* DISTORTION + GAIN */}
        <div className="vs-card">
          <div className="vs-card-header"><span className="vs-card-title">DISTORTION / GAIN</span></div>
          <div className="vs-knob-row">
            <div className="vs-knob">
              <span className="vk-label">DISTORTION</span>
              <input type="range" min="0" max="1" step="0.01" value={fx.distortion}
                onChange={e => set({ distortion: parseFloat(e.target.value) })}
                className="vk-slider" style={{ "--vc": "#ff4081" } as any} />
              <span className="vk-value">{Math.round(fx.distortion * 100)}%</span>
            </div>
            <div className="vs-knob">
              <span className="vk-label">OUTPUT GAIN</span>
              <input type="range" min="0" max="2" step="0.01" value={fx.outputGain}
                onChange={e => set({ outputGain: parseFloat(e.target.value) })}
                className="vk-slider" style={{ "--vc": "#00e5ff" } as any} />
              <span className="vk-value">{Math.round(fx.outputGain * 100)}%</span>
            </div>
          </div>
        </div>

        {/* BYPASS */}
        <div className="vs-card vs-card-bypass">
          <div className="vs-card-header">
            <span className="vs-card-title">MONITORING</span>
            <label className="fx-toggle">
              <input type="checkbox" checked={!fx.bypass} onChange={e => set({ bypass: !e.target.checked })} />
              <span className="fx-toggle-track" />
              <span className="fx-toggle-label">{!fx.bypass ? "LIVE" : "MUTED"}</span>
            </label>
          </div>
          <div className="vs-note">⚠ Headphones recommended to prevent feedback when monitoring live.</div>
          <button className="reset-fx-btn" onClick={() => setFx(DEFAULT_EFFECTS)}>RESET ALL EFFECTS</button>
        </div>
      </div>

      {/* ── Recording controls ── */}
      <div className="vs-rec-bar">
        <div className="vs-rec-controls">
          {!isRecording ? (
            <button
              className="vs-rec-btn"
              onClick={startRecording}
              disabled={!micEnabled}
              title="Record your processed voice"
            >
              <span className="rec-dot" />
              START RECORDING
            </button>
          ) : (
            <button className="vs-rec-btn vs-rec-active" onClick={stopRecording}>
              <span className="rec-dot rec-pulse" />
              STOP RECORDING
            </button>
          )}
          {recordingBlob && !isRecording && (
            <>
              <button className="vs-save-btn" onClick={saveRecording}>
                <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 12v4a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-4" />
                  <polyline points="7,8 10,11 13,8" />
                  <line x1="10" y1="1" x2="10" y2="11" />
                </svg>
                SAVE RECORDING
              </button>
              {playbackUrl && (
                <audio controls src={playbackUrl} className="vs-playback" />
              )}
            </>
          )}
        </div>
        <div className={`vs-level-indicator${level > 0.05 ? " vs-level-active" : ""}`}>
          <span className="vli-label">INPUT</span>
          {Array.from({ length: 20 }, (_, i) => (
            <div
              key={i}
              className="vli-bar"
              style={{
                background: i < Math.round(level * 20)
                  ? (i < 14 ? "#39ff14" : i < 18 ? "#ffb300" : "#ff4081")
                  : "rgba(255,255,255,0.06)"
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }
