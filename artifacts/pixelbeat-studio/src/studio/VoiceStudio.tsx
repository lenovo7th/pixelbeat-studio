import React, { useState, useRef, useEffect, useCallback } from "react";

declare const Tone: any;

// ─── Types ──────────────────────────────────────────────────────────────────
interface FxState {
  // Compressor
  compEnabled: boolean;
  compThreshold: number;  // -60 to 0 dB
  compRatio: number;      // 1 to 20
  compAttack: number;     // 0.001 to 0.5 s
  compRelease: number;    // 0.01 to 1 s
  compKnee: number;       // 0 to 40 dB

  // 3-band EQ
  eqLow: number;       // -15 to +15 dB
  eqLowFreq: number;   // Hz
  eqMid: number;
  eqMidFreq: number;
  eqMidQ: number;
  eqHigh: number;
  eqHighFreq: number;

  // Pitch / autotune
  pitchShift: number;       // -24 to +24 semitones
  autotuneOn: boolean;
  autotuneStrength: number; // 0 = robotic, 1 = natural

  // Reverb
  reverbMix: number;
  reverbDecay: number;

  // Delay
  delayTime: number;
  delayFeedback: number;
  delayMix: number;

  // Chorus
  chorusDepth: number;
  chorusRate: number;
  chorusMix: number;

  // Distortion
  distortion: number;
  distortionMix: number;

  // Master
  outputGain: number;
  monitor: boolean;
}

const DEFAULTS: FxState = {
  compEnabled: true,
  compThreshold: -24,
  compRatio: 4,
  compAttack: 0.003,
  compRelease: 0.15,
  compKnee: 10,

  eqLow: 0, eqLowFreq: 120,
  eqMid: 0, eqMidFreq: 2500, eqMidQ: 1,
  eqHigh: 0, eqHighFreq: 8000,

  pitchShift: 0,
  autotuneOn: false,
  autotuneStrength: 0.5,

  reverbMix: 0.15,
  reverbDecay: 1.5,

  delayTime: 0,
  delayFeedback: 0.35,
  delayMix: 0.3,

  chorusDepth: 0,
  chorusRate: 1.5,
  chorusMix: 0.4,

  distortion: 0,
  distortionMix: 1,

  outputGain: 1,
  monitor: true,
};

// ─── Presets ─────────────────────────────────────────────────────────────────
const PRESETS: Record<string, Partial<FxState>> = {
  "Clean":      { compThreshold:-22, compRatio:3, eqLow:1, eqMid:2, eqHigh:1.5, pitchShift:0, autotuneOn:false, reverbMix:0.05, delayTime:0, chorusDepth:0, distortion:0 },
  "Warm Hall":  { compThreshold:-20, compRatio:4, eqLow:3, eqMid:-1, eqHigh:1, reverbMix:0.5, reverbDecay:2.8, delayTime:0, chorusDepth:0.15, chorusRate:0.8, distortion:0 },
  "Stadium":    { compThreshold:-18, compRatio:5, eqLow:2, eqMid:1, eqHigh:2, reverbMix:0.75, reverbDecay:5.5, delayTime:0.38, delayFeedback:0.45, delayMix:0.35, chorusDepth:0.1, distortion:0 },
  "Radio":      { compThreshold:-14, compRatio:8, compKnee:3, eqLow:-8, eqLowFreq:250, eqMid:4, eqMidFreq:3000, eqHigh:2, reverbMix:0, delayTime:0, chorusDepth:0, distortion:0.08, distortionMix:0.4 },
  "T-Pain":     { compThreshold:-20, compRatio:4, pitchShift:0, autotuneOn:true, autotuneStrength:0.05, reverbMix:0.2, delayTime:0.12, delayFeedback:0.3, chorusDepth:0.3, chorusRate:0.5, distortion:0 },
  "Lo-Fi":      { compThreshold:-16, compRatio:6, eqLow:-4, eqLowFreq:200, eqMid:3, eqMidFreq:2000, eqHigh:-10, eqHighFreq:5000, reverbMix:0.2, reverbDecay:0.8, delayTime:0.06, delayFeedback:0.4, distortion:0.35, distortionMix:0.6 },
  "Deep Bass":  { pitchShift:-6, compThreshold:-22, compRatio:5, eqLow:5, eqLowFreq:80, eqMid:-2, eqHigh:-3, reverbMix:0.1, chorusDepth:0.2, distortion:0 },
  "Chipmunk":   { pitchShift:8, autotuneOn:false, compRatio:3, eqHigh:3, reverbMix:0.1 },
};

// ─── Component ───────────────────────────────────────────────────────────────
export default function VoiceStudio() {
  const [fx, setFx] = useState<FxState>(DEFAULTS);
  const [micEnabled, setMicEnabled] = useState(false);
  const [micError, setMicError] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [recordingBlob, setRecordingBlob] = useState<Blob | null>(null);
  const [playbackUrl, setPlaybackUrl] = useState<string | null>(null);
  const [buildStatus, setBuildStatus] = useState("");
  const [inputLevel, setInputLevel] = useState(0);
  const [outputLevel, setOutputLevel] = useState(0);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const fxRef = useRef(fx);

  // Tone.js node refs
  const nodesRef = useRef<{
    mic: any; comp: any; eq3: any; pitch: any;
    chorus: any; reverb: any; delay: any; dist: any;
    masterGain: any; analyserWave: any; analyserFft: any; inputAnalyser: any;
  } | null>(null);

  // MediaRecorder
  const mediaRecRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  useEffect(() => { fxRef.current = fx; }, [fx]);

  // ── Build effect chain ─────────────────────────────────────────────────────
  const buildChain = useCallback(async () => {
    setBuildStatus("Requesting microphone…");
    setMicError("");

    // Tear down any existing chain
    await teardownChain(false);

    try {
      await Tone.start();

      setBuildStatus("Building effects chain…");

      const mic = new Tone.UserMedia();
      await mic.open();

      // Input level analyser (pre-effects)
      const inputAnalyser = new Tone.Analyser({ type: "waveform", size: 512 });

      // Compressor
      const comp = new Tone.Compressor({
        threshold: fx.compThreshold,
        ratio: fx.compRatio,
        attack: fx.compAttack,
        release: fx.compRelease,
        knee: fx.compKnee,
      });

      // 3-band EQ
      const eq3 = new Tone.EQ3({
        low: fx.eqLow,
        mid: fx.eqMid,
        high: fx.eqHigh,
        lowFrequency: fx.eqLowFreq,
        highFrequency: fx.eqHighFreq,
      });

      // Pitch shift — ALWAYS wet:1, pitch controls amount
      const pitch = new Tone.PitchShift({
        pitch: fx.pitchShift,
        windowSize: mapAutotuneWindow(fx.autotuneStrength),
        wet: (fx.autotuneOn || fx.pitchShift !== 0) ? 1 : 0,
      });

      // Chorus
      const chorus = new Tone.Chorus({
        rate: fx.chorusRate,
        depth: fx.chorusDepth,
        wet: fx.chorusMix * (fx.chorusDepth > 0 ? 1 : 0),
      }).start();

      // Reverb — MUST await .ready before connecting
      const reverb = new Tone.Reverb({ decay: fx.reverbDecay, wet: fx.reverbMix });
      setBuildStatus("Generating reverb impulse…");
      await reverb.ready;

      // Delay
      const delay = new Tone.FeedbackDelay({
        delayTime: Math.max(0.001, fx.delayTime),
        feedback: fx.delayFeedback,
        wet: fx.delayMix * (fx.delayTime > 0 ? 1 : 0),
      });

      // Distortion with proper WaveShaper
      const dist = new Tone.Chebyshev(1); // Starts clean
      dist.wet.value = fx.distortionMix * (fx.distortion > 0 ? 1 : 0);
      dist.order = Math.max(1, Math.round(fx.distortion * 50));

      // Master gain
      const masterGain = new Tone.Gain(fx.outputGain);

      // Analysers for visualizer
      const analyserWave = new Tone.Analyser({ type: "waveform", size: 1024 });
      const analyserFft  = new Tone.Analyser({ type: "fft", size: 512, smoothing: 0.82 });

      // Wire: mic → inputAnalyser → comp → eq3 → pitch → chorus → reverb → delay → dist → masterGain → [analysers] → destination
      mic.connect(inputAnalyser);
      mic.connect(fx.compEnabled ? comp : eq3);

      if (fx.compEnabled) comp.connect(eq3);
      eq3.connect(pitch);
      pitch.connect(chorus);
      chorus.connect(reverb);
      reverb.connect(delay);
      delay.connect(dist);
      dist.connect(masterGain);
      masterGain.connect(analyserWave);
      masterGain.connect(analyserFft);

      if (fx.monitor) masterGain.connect(Tone.getDestination());

      nodesRef.current = { mic, comp, eq3, pitch, chorus, reverb, delay, dist, masterGain, analyserWave, analyserFft, inputAnalyser };

      setMicEnabled(true);
      setBuildStatus("");
      startVisualizer(analyserWave, analyserFft, inputAnalyser);

    } catch (e: any) {
      setMicError(e?.message || "Microphone access denied");
      setBuildStatus("");
      setMicEnabled(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Teardown ──────────────────────────────────────────────────────────────
  const teardownChain = async (updateState = true) => {
    cancelAnimationFrame(animRef.current);
    const n = nodesRef.current;
    if (n) {
      try { await n.mic.close(); } catch (_) {}
      [n.comp, n.eq3, n.pitch, n.chorus, n.reverb, n.delay, n.dist, n.masterGain, n.analyserWave, n.analyserFft, n.inputAnalyser]
        .forEach(node => { try { node.dispose(); } catch (_) {} });
      nodesRef.current = null;
    }
    if (updateState) { setMicEnabled(false); setInputLevel(0); setOutputLevel(0); }
  };

  useEffect(() => () => { cancelAnimationFrame(animRef.current); teardownChain(); }, []);

  // ── Live parameter update (no rebuild needed) ─────────────────────────────
  useEffect(() => {
    const n = nodesRef.current;
    if (!n || !micEnabled) return;
    try {
      // Compressor
      n.comp.threshold.value = fx.compThreshold;
      n.comp.ratio.value = fx.compRatio;
      n.comp.attack.value = fx.compAttack;
      n.comp.release.value = fx.compRelease;

      // EQ
      n.eq3.low.value = fx.eqLow;
      n.eq3.mid.value = fx.eqMid;
      n.eq3.high.value = fx.eqHigh;
      n.eq3.lowFrequency.value = fx.eqLowFreq;
      n.eq3.highFrequency.value = fx.eqHighFreq;

      // Pitch
      n.pitch.pitch = fx.pitchShift;
      n.pitch.windowSize = mapAutotuneWindow(fx.autotuneStrength);
      n.pitch.wet.value = (fx.autotuneOn || fx.pitchShift !== 0) ? 1 : 0;

      // Chorus
      n.chorus.rate.value = fx.chorusRate;
      n.chorus.depth = fx.chorusDepth;
      n.chorus.wet.value = fx.chorusMix * (fx.chorusDepth > 0 ? 1 : 0);

      // Reverb
      n.reverb.wet.value = fx.reverbMix;

      // Delay
      n.delay.delayTime.value = Math.max(0.001, fx.delayTime);
      n.delay.feedback.value = fx.delayFeedback;
      n.delay.wet.value = fx.delayMix * (fx.delayTime > 0 ? 1 : 0);

      // Distortion
      n.dist.order = Math.max(1, Math.round(fx.distortion * 50));
      n.dist.wet.value = fx.distortionMix * (fx.distortion > 0 ? 1 : 0);

      // Master
      n.masterGain.gain.value = fx.outputGain;
    } catch (_) {}
  }, [fx, micEnabled]);

  // Monitor toggle (needs reconnect)
  useEffect(() => {
    const n = nodesRef.current;
    if (!n || !micEnabled) return;
    try {
      if (fx.monitor) {
        n.masterGain.connect(Tone.getDestination());
      } else {
        n.masterGain.disconnect(Tone.getDestination());
      }
    } catch (_) {}
  }, [fx.monitor, micEnabled]);

  // ── Dual visualizer: waveform + FFT spectrum ──────────────────────────────
  const startVisualizer = (waveAnalyser: any, fftAnalyser: any, inputAnalyser: any) => {
    cancelAnimationFrame(animRef.current);

    const draw = () => {
      animRef.current = requestAnimationFrame(draw);
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d")!;
      const W = canvas.width, H = canvas.height;
      const MID = Math.floor(H * 0.42); // split between FFT (bottom) and waveform (top)

      ctx.fillStyle = "#080910";
      ctx.fillRect(0, 0, W, H);

      // ── FFT spectrum (lower portion) ──
      let fftVals: Float32Array;
      try { fftVals = fftAnalyser.getValue() as Float32Array; } catch (_) { return; }

      const barW = Math.max(2, (W / fftVals.length) * 2);
      const fftBars = Math.floor(W / barW);
      for (let i = 0; i < fftBars; i++) {
        const idx = Math.floor((i / fftBars) * fftVals.length);
        const dB = Math.max(-100, fftVals[idx]);
        const norm = (dB + 100) / 100;  // 0 at -100dB, 1 at 0dB
        const barH = norm * (H - MID - 4);
        const x = i * barW;

        // Color: cyan → purple by frequency
        const hue = 180 + (i / fftBars) * 120;
        const alpha = 0.6 + norm * 0.4;
        ctx.fillStyle = `hsla(${hue}, 100%, 55%, ${alpha})`;
        ctx.fillRect(x, H - barH, barW - 1, barH);

        // Glow cap
        if (norm > 0.1) {
          ctx.fillStyle = `hsla(${hue}, 100%, 80%, 0.9)`;
          ctx.fillRect(x, H - barH - 1, barW - 1, 2);
        }
      }

      // FFT divider line
      ctx.strokeStyle = "rgba(0,229,255,0.12)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, MID); ctx.lineTo(W, MID);
      ctx.stroke();

      // Label
      ctx.fillStyle = "rgba(0,229,255,0.25)";
      ctx.font = "9px monospace";
      ctx.fillText("SPECTRUM", 6, MID - 4);

      // ── Waveform (upper portion) ──
      let waveVals: Float32Array;
      try { waveVals = waveAnalyser.getValue() as Float32Array; } catch (_) { return; }

      // Center line
      ctx.strokeStyle = "rgba(255,255,255,0.06)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, MID / 2); ctx.lineTo(W, MID / 2);
      ctx.stroke();

      // Fill under waveform
      ctx.beginPath();
      const step = W / waveVals.length;
      let maxOut = 0;
      ctx.moveTo(0, MID / 2);
      waveVals.forEach((v, i) => {
        maxOut = Math.max(maxOut, Math.abs(v));
        const x = i * step;
        const y = MID / 2 + v * (MID / 2) * 0.9;
        ctx.lineTo(x, y);
      });
      ctx.lineTo(W, MID / 2);
      ctx.closePath();
      ctx.fillStyle = "rgba(0,229,255,0.05)";
      ctx.fill();

      // Waveform stroke
      ctx.beginPath();
      waveVals.forEach((v, i) => {
        const x = i * step;
        const y = MID / 2 + v * (MID / 2) * 0.9;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      ctx.strokeStyle = "#00e5ff";
      ctx.lineWidth = 1.5;
      ctx.shadowColor = "#00e5ff";
      ctx.shadowBlur = 8;
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Level meters
      let inLevel = 0;
      try { const iv = inputAnalyser.getValue() as Float32Array; iv.forEach(v => { inLevel = Math.max(inLevel, Math.abs(v)); }); } catch (_) {}
      setInputLevel(inLevel);
      setOutputLevel(maxOut);
    };
    draw();
  };

  // ── Recording ─────────────────────────────────────────────────────────────
  const startRecording = () => {
    const n = nodesRef.current;
    if (!n) return;
    try {
      const actx = Tone.getContext().rawContext as AudioContext;
      const dest = actx.createMediaStreamDestination();
      n.masterGain.connect(dest);
      const mr = new MediaRecorder(dest.stream);
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
    } catch (e) { console.warn("Record error:", e); }
  };

  const stopRecording = () => {
    if (mediaRecRef.current?.state !== "inactive") mediaRecRef.current?.stop();
    setIsRecording(false);
  };

  const saveRecording = () => {
    if (!recordingBlob) return;
    const url = URL.createObjectURL(recordingBlob);
    const a = document.createElement("a"); a.href = url; a.download = "voice-studio.webm";
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  };

  const applyPreset = (name: string) => {
    setFx(prev => ({ ...prev, ...PRESETS[name] }));
  };

  const set = (patch: Partial<FxState>) => setFx(prev => ({ ...prev, ...patch }));

  // ── VU bar helper ──────────────────────────────────────────────────────────
  const VUBar = ({ level, label }: { level: number; label: string }) => (
    <div className="vu-bar-group">
      <span className="vu-label">{label}</span>
      <div className="vu-bar-track">
        <div className="vu-bar-fill" style={{
          width: `${Math.min(100, level * 100)}%`,
          background: level > 0.85 ? "var(--neon-pink)" : level > 0.6 ? "var(--neon-amber)" : "var(--neon-green)"
        }} />
      </div>
      <span className="vu-db">{level > 0.001 ? `${(20 * Math.log10(level)).toFixed(0)} dB` : "-∞"}</span>
    </div>
  );

  // ── Knob helper ────────────────────────────────────────────────────────────
  const Knob = ({ label, min, max, step = 0.01, value, onChange, color, fmt }:
    { label: string; min: number; max: number; step?: number; value: number; onChange: (v: number) => void; color: string; fmt?: (v: number) => string }) => (
    <div className="vs-knob">
      <span className="vk-label">{label}</span>
      <input type="range" min={min} max={max} step={step}
        value={value} onChange={e => onChange(parseFloat(e.target.value))}
        className="vk-slider" style={{ "--vc": color } as any} />
      <span className="vk-value">{fmt ? fmt(value) : value.toFixed(2)}</span>
    </div>
  );

  return (
    <div className="voice-studio">

      {/* ── Header + mic ── */}
      <div className="vs-header">
        <div className="vs-title">
          <span className="vs-icon">🎤</span> VOICE STUDIO
          <span className="vs-subtitle">Professional Vocal Processing</span>
        </div>
        <div className="vs-header-right">
          {buildStatus && <span className="vs-status">{buildStatus}</span>}
          {!micEnabled ? (
            <button className="mic-enable-btn" onClick={buildChain}>⊕ ENABLE MICROPHONE</button>
          ) : (
            <button className="mic-disable-btn" onClick={() => teardownChain()}>⊗ DISCONNECT MIC</button>
          )}
          {micError && <span className="mic-error">{micError}</span>}
        </div>
      </div>

      {/* ── Presets ── */}
      <div className="vs-presets">
        <span className="vs-preset-label">PRESETS:</span>
        {Object.keys(PRESETS).map(name => (
          <button key={name} className="preset-btn" onClick={() => applyPreset(name)}>{name}</button>
        ))}
        <button className="preset-btn preset-reset" onClick={() => setFx(DEFAULTS)}>↺ Reset</button>
      </div>

      {/* ── Visualizer ── */}
      <div className="vs-visualizer">
        <canvas ref={canvasRef} width={1100} height={160} className="waveform-canvas" />
        <div className="vs-vu-meters">
          <VUBar level={inputLevel} label="IN" />
          <VUBar level={outputLevel} label="OUT" />
        </div>
      </div>

      {/* ── Signal chain ── */}
      <div className="vs-chain-label">
        <span>MIC</span><span className="chain-arrow">→</span>
        <span className={fx.compEnabled ? "chain-active" : "chain-off"}>COMP</span><span className="chain-arrow">→</span>
        <span className={fx.eqLow !== 0 || fx.eqMid !== 0 || fx.eqHigh !== 0 ? "chain-active" : ""}>EQ</span><span className="chain-arrow">→</span>
        <span className={fx.pitchShift !== 0 || fx.autotuneOn ? "chain-active" : ""}>PITCH</span><span className="chain-arrow">→</span>
        <span className={fx.chorusDepth > 0 ? "chain-active" : ""}>CHORUS</span><span className="chain-arrow">→</span>
        <span className={fx.reverbMix > 0 ? "chain-active" : ""}>REVERB</span><span className="chain-arrow">→</span>
        <span className={fx.delayTime > 0 ? "chain-active" : ""}>DELAY</span><span className="chain-arrow">→</span>
        <span className={fx.distortion > 0 ? "chain-active" : ""}>DIST</span><span className="chain-arrow">→</span>
        <span className="chain-active">OUT</span>
      </div>

      {/* ── Effects grid ── */}
      <div className="vs-effects">

        {/* COMPRESSOR */}
        <div className={`vs-card${!fx.compEnabled ? " vs-card-dim" : ""}`}>
          <div className="vs-card-header">
            <span className="vs-card-title" style={{ color: "#ff9100" }}>COMPRESSOR</span>
            <label className="fx-toggle">
              <input type="checkbox" checked={fx.compEnabled} onChange={e => set({ compEnabled: e.target.checked })} />
              <span className="fx-toggle-track" style={{ "--tc": "#ff9100" } as any} />
              <span className="fx-toggle-label">{fx.compEnabled ? "ON" : "OFF"}</span>
            </label>
          </div>
          <div className="vs-knob-row">
            <Knob label="THRESHOLD" min={-60} max={0} step={1} value={fx.compThreshold}
              onChange={v => set({ compThreshold: v })} color="#ff9100" fmt={v => `${v} dB`} />
            <Knob label="RATIO" min={1} max={20} step={0.5} value={fx.compRatio}
              onChange={v => set({ compRatio: v })} color="#ff9100" fmt={v => `${v.toFixed(1)}:1`} />
          </div>
          <div className="vs-knob-row">
            <Knob label="ATTACK" min={0.001} max={0.5} step={0.001} value={fx.compAttack}
              onChange={v => set({ compAttack: v })} color="#ffb300" fmt={v => `${(v * 1000).toFixed(1)}ms`} />
            <Knob label="RELEASE" min={0.01} max={1} step={0.01} value={fx.compRelease}
              onChange={v => set({ compRelease: v })} color="#ffb300" fmt={v => `${(v * 1000).toFixed(0)}ms`} />
            <Knob label="KNEE" min={0} max={40} step={1} value={fx.compKnee}
              onChange={v => set({ compKnee: v })} color="#ffb300" fmt={v => `${v} dB`} />
          </div>
        </div>

        {/* 3-BAND EQ */}
        <div className="vs-card">
          <div className="vs-card-header"><span className="vs-card-title" style={{ color: "#76ff03" }}>3-BAND EQ</span></div>
          <div className="vs-eq-row">
            <div className="vs-eq-band">
              <span className="vk-label">LOW</span>
              <input type="range" min={-15} max={15} step={0.5} value={fx.eqLow}
                onChange={e => set({ eqLow: parseFloat(e.target.value) })}
                className="vk-slider vk-vertical" orient="vertical" style={{ "--vc": "#76ff03" } as any} />
              <span className="vk-value">{fx.eqLow > 0 ? "+" : ""}{fx.eqLow.toFixed(1)}</span>
              <input type="range" min={60} max={400} step={10} value={fx.eqLowFreq}
                onChange={e => set({ eqLowFreq: parseFloat(e.target.value) })}
                className="vk-freq-slider" style={{ "--vc": "#76ff03" } as any} />
              <span className="vk-freq">{fx.eqLowFreq}Hz</span>
            </div>
            <div className="vs-eq-band">
              <span className="vk-label">MID</span>
              <input type="range" min={-15} max={15} step={0.5} value={fx.eqMid}
                onChange={e => set({ eqMid: parseFloat(e.target.value) })}
                className="vk-slider vk-vertical" orient="vertical" style={{ "--vc": "#76ff03" } as any} />
              <span className="vk-value">{fx.eqMid > 0 ? "+" : ""}{fx.eqMid.toFixed(1)}</span>
              <input type="range" min={500} max={5000} step={100} value={fx.eqMidFreq}
                onChange={e => set({ eqMidFreq: parseFloat(e.target.value) })}
                className="vk-freq-slider" style={{ "--vc": "#76ff03" } as any} />
              <span className="vk-freq">{fx.eqMidFreq >= 1000 ? `${(fx.eqMidFreq/1000).toFixed(1)}k` : `${fx.eqMidFreq}`}Hz</span>
            </div>
            <div className="vs-eq-band">
              <span className="vk-label">HIGH</span>
              <input type="range" min={-15} max={15} step={0.5} value={fx.eqHigh}
                onChange={e => set({ eqHigh: parseFloat(e.target.value) })}
                className="vk-slider vk-vertical" orient="vertical" style={{ "--vc": "#76ff03" } as any} />
              <span className="vk-value">{fx.eqHigh > 0 ? "+" : ""}{fx.eqHigh.toFixed(1)}</span>
              <input type="range" min={3000} max={16000} step={500} value={fx.eqHighFreq}
                onChange={e => set({ eqHighFreq: parseFloat(e.target.value) })}
                className="vk-freq-slider" style={{ "--vc": "#76ff03" } as any} />
              <span className="vk-freq">{(fx.eqHighFreq/1000).toFixed(1)}kHz</span>
            </div>
          </div>
        </div>

        {/* PITCH / AUTOTUNE */}
        <div className="vs-card">
          <div className="vs-card-header">
            <span className="vs-card-title" style={{ color: "#d500f9" }}>PITCH / AUTOTUNE</span>
            <label className="fx-toggle">
              <input type="checkbox" checked={fx.autotuneOn} onChange={e => set({ autotuneOn: e.target.checked })} />
              <span className="fx-toggle-track" style={{ "--tc": "#d500f9" } as any} />
              <span className="fx-toggle-label">{fx.autotuneOn ? "AUTO" : "MANUAL"}</span>
            </label>
          </div>
          <div className="vs-knob-row">
            <Knob label="PITCH SHIFT" min={-24} max={24} step={1} value={fx.pitchShift}
              onChange={v => set({ pitchShift: v })} color="#d500f9"
              fmt={v => `${v > 0 ? "+" : ""}${v} st`} />
            <Knob label={fx.autotuneOn ? "CORRECTION" : "WINDOW"} min={0} max={1} step={0.01} value={fx.autotuneStrength}
              onChange={v => set({ autotuneStrength: v })} color="#d500f9"
              fmt={v => fx.autotuneOn ? (v < 0.2 ? "Robotic" : v > 0.7 ? "Natural" : "Medium") : `${Math.round(v * 100)}%`} />
          </div>
          {fx.autotuneOn && (
            <div className="vs-note" style={{ color: "rgba(213,0,249,0.7)" }}>
              Autotune is ON — low "Correction" = more robotic (T-Pain), high = more transparent (Melodyne-style)
            </div>
          )}
        </div>

        {/* REVERB */}
        <div className="vs-card">
          <div className="vs-card-header"><span className="vs-card-title" style={{ color: "#00e5ff" }}>REVERB</span></div>
          <div className="vs-knob-row">
            <Knob label="MIX" min={0} max={1} step={0.01} value={fx.reverbMix}
              onChange={v => set({ reverbMix: v })} color="#00e5ff" fmt={v => `${Math.round(v * 100)}%`} />
            <Knob label="DECAY" min={0.3} max={10} step={0.1} value={fx.reverbDecay}
              onChange={v => set({ reverbDecay: v })} color="#00e5ff" fmt={v => `${v.toFixed(1)}s`} />
          </div>
          <div className="vs-note">⚠ Changing decay rebuilds the reverb IR — click "Rebuild" to apply.</div>
          <button className="vs-rebuild-btn" onClick={buildChain} disabled={!micEnabled}>↺ Rebuild Reverb</button>
        </div>

        {/* DELAY */}
        <div className="vs-card">
          <div className="vs-card-header"><span className="vs-card-title" style={{ color: "#ffb300" }}>DELAY / ECHO</span></div>
          <div className="vs-knob-row">
            <Knob label="TIME" min={0} max={1} step={0.01} value={fx.delayTime}
              onChange={v => set({ delayTime: v })} color="#ffb300" fmt={v => `${(v * 1000).toFixed(0)}ms`} />
            <Knob label="FEEDBACK" min={0} max={0.9} step={0.01} value={fx.delayFeedback}
              onChange={v => set({ delayFeedback: v })} color="#ffb300" fmt={v => `${Math.round(v * 100)}%`} />
            <Knob label="MIX" min={0} max={1} step={0.01} value={fx.delayMix}
              onChange={v => set({ delayMix: v })} color="#ffb300" fmt={v => `${Math.round(v * 100)}%`} />
          </div>
        </div>

        {/* CHORUS */}
        <div className="vs-card">
          <div className="vs-card-header"><span className="vs-card-title" style={{ color: "#39ff14" }}>CHORUS / DOUBLE</span></div>
          <div className="vs-knob-row">
            <Knob label="DEPTH" min={0} max={1} step={0.01} value={fx.chorusDepth}
              onChange={v => set({ chorusDepth: v })} color="#39ff14" fmt={v => `${Math.round(v * 100)}%`} />
            <Knob label="RATE" min={0.1} max={8} step={0.1} value={fx.chorusRate}
              onChange={v => set({ chorusRate: v })} color="#39ff14" fmt={v => `${v.toFixed(1)} Hz`} />
            <Knob label="MIX" min={0} max={1} step={0.01} value={fx.chorusMix}
              onChange={v => set({ chorusMix: v })} color="#39ff14" fmt={v => `${Math.round(v * 100)}%`} />
          </div>
        </div>

        {/* DISTORTION */}
        <div className="vs-card">
          <div className="vs-card-header"><span className="vs-card-title" style={{ color: "#ff4081" }}>SATURATION / DIST</span></div>
          <div className="vs-knob-row">
            <Knob label="DRIVE" min={0} max={1} step={0.01} value={fx.distortion}
              onChange={v => set({ distortion: v })} color="#ff4081"
              fmt={v => v < 0.1 ? "Clean" : v < 0.4 ? "Warm" : v < 0.7 ? "Gritty" : "Destroyed"} />
            <Knob label="MIX" min={0} max={1} step={0.01} value={fx.distortionMix}
              onChange={v => set({ distortionMix: v })} color="#ff4081" fmt={v => `${Math.round(v * 100)}%`} />
          </div>
        </div>

        {/* MASTER */}
        <div className="vs-card">
          <div className="vs-card-header">
            <span className="vs-card-title" style={{ color: "#fff" }}>MASTER</span>
            <label className="fx-toggle">
              <input type="checkbox" checked={fx.monitor} onChange={e => set({ monitor: e.target.checked })} />
              <span className="fx-toggle-track" style={{ "--tc": "#00e5ff" } as any} />
              <span className="fx-toggle-label">{fx.monitor ? "🔊 LIVE" : "🔇 MUTED"}</span>
            </label>
          </div>
          <Knob label="OUTPUT GAIN" min={0} max={2} step={0.01} value={fx.outputGain}
            onChange={v => set({ outputGain: v })} color="#ffffff" fmt={v => `${Math.round(v * 100)}%`} />
          <div className="vs-note" style={{ marginTop: 6 }}>
            ⚠ Use headphones when monitoring live to prevent feedback.
          </div>
        </div>

      </div>

      {/* ── Recording bar ── */}
      <div className="vs-rec-bar">
        <div className="vs-rec-controls">
          {!isRecording ? (
            <button className="vs-rec-btn" onClick={startRecording} disabled={!micEnabled}>
              <span className="rec-dot" /> START RECORDING
            </button>
          ) : (
            <button className="vs-rec-btn vs-rec-active" onClick={stopRecording}>
              <span className="rec-dot rec-pulse" /> STOP RECORDING
            </button>
          )}
          {recordingBlob && !isRecording && (
            <>
              <button className="vs-save-btn" onClick={saveRecording}>
                ↓ SAVE RECORDING
              </button>
              {playbackUrl && <audio controls src={playbackUrl} className="vs-playback" />}
            </>
          )}
        </div>
        <div className="vs-vu-meters-horiz">
          <VUBar level={inputLevel} label="IN" />
          <VUBar level={outputLevel} label="OUT" />
        </div>
      </div>

    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────
// Lower window = more robotic/stepped autotune; higher = more transparent
function mapAutotuneWindow(strength: number): number {
  return 0.015 + strength * 0.185; // 15ms (robotic) to 200ms (natural)
}
