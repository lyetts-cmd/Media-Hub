import React, {
  createContext, useContext, useState, useEffect, useRef, useCallback,
} from "react";
import { Track, getStreamTrackUrl } from "@workspace/api-client-react";

// ─── Types ──────────────────────────────────────────────────────────────────

export type RepeatMode = "off" | "one" | "all";
export type EqPresetName = "flat" | "bass_boost" | "treble_boost" | "rock" | "jazz" | "classical";

export const EQ_BANDS = [
  { freq: 60,    label: "60 Hz",  type: "lowshelf"  as BiquadFilterType },
  { freq: 250,   label: "250 Hz", type: "peaking"   as BiquadFilterType },
  { freq: 1000,  label: "1 kHz",  type: "peaking"   as BiquadFilterType },
  { freq: 4000,  label: "4 kHz",  type: "peaking"   as BiquadFilterType },
  { freq: 12000, label: "12 kHz", type: "highshelf" as BiquadFilterType },
];

export const EQ_PRESETS: Record<EqPresetName, number[]> = {
  flat:         [ 0,  0,  0,  0,  0],
  bass_boost:   [ 6,  4,  0, -1, -1],
  treble_boost: [-1, -1,  0,  2,  5],
  rock:         [ 4,  2, -1,  2,  4],
  jazz:         [ 3,  2,  0,  1,  3],
  classical:    [ 4,  2, -2,  2,  4],
};

// ─── Persistence ────────────────────────────────────────────────────────────

const STORAGE_KEY = "cadence_player_state";

interface PersistedState {
  volume: number;
  shuffle: boolean;
  repeat: RepeatMode;
  speed: number;
  eqBands: number[];
  crossfadeEnabled: boolean;
  crossfadeDuration: number;
  queue: Track[];
  currentIndex: number;
  currentTime: number;
}

function loadState(): Partial<PersistedState> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Partial<PersistedState>) : {};
  } catch { return {}; }
}

function persistState(s: PersistedState) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch {}
}

// ─── Context type ────────────────────────────────────────────────────────────

interface PlayerContextType {
  queue: Track[];
  currentTrack: Track | null;
  currentIndex: number;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  shuffle: boolean;
  repeat: RepeatMode;
  speed: number;
  sleepTimerEnd: number | null;
  crossfadeEnabled: boolean;
  crossfadeDuration: number;
  eqBands: number[];
  analyserNode: AnalyserNode | null;
  isExpanded: boolean;
  playTrack: (track: Track, newQueue?: Track[]) => void;
  pause: () => void;
  resume: () => void;
  next: () => void;
  prev: () => void;
  seek: (time: number) => void;
  setVolume: (v: number) => void;
  togglePlayPause: () => void;
  toggleShuffle: () => void;
  cycleRepeat: () => void;
  setSpeed: (v: number) => void;
  setSleepTimer: (minutes: number | null) => void;
  setCrossfade: (enabled: boolean, duration?: number) => void;
  setEqBand: (index: number, gain: number) => void;
  applyEqPreset: (preset: EqPresetName) => void;
  reorderQueue: (from: number, to: number) => void;
  removeFromQueue: (index: number) => void;
  setIsExpanded: (v: boolean) => void;
}

const PlayerContext = createContext<PlayerContextType | null>(null);

// ─── Provider ────────────────────────────────────────────────────────────────

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const persisted = useRef(loadState()).current;

  // ── Core state ────────────────────────────────────────────────────────────
  const [queue, setQueue]               = useState<Track[]>(persisted.queue ?? []);
  const [currentIndex, setCurrentIndex] = useState(persisted.currentIndex ?? -1);
  const [isPlaying, setIsPlaying]       = useState(false);
  const [currentTime, setCurrentTime]   = useState(0);
  const [duration, setDuration]         = useState(0);
  const [volume, setVolumeState]        = useState(persisted.volume ?? 1);
  // ── Extended state ────────────────────────────────────────────────────────
  const [shuffle, setShuffleSt]         = useState(persisted.shuffle ?? false);
  const [repeat, setRepeatSt]           = useState<RepeatMode>(persisted.repeat ?? "off");
  const [speed, setSpeedSt]             = useState(persisted.speed ?? 1);
  const [sleepTimerEnd, setSleepTimerEnd] = useState<number | null>(null);
  const [crossfadeEnabled, setCfEnabled]  = useState(persisted.crossfadeEnabled ?? false);
  const [crossfadeDuration, setCfDur]     = useState(persisted.crossfadeDuration ?? 3);
  const [eqBands, setEqBandsSt]          = useState<number[]>(persisted.eqBands ?? [0,0,0,0,0]);
  const [analyserNode, setAnalyserNode]   = useState<AnalyserNode | null>(null);
  const [isExpanded, setIsExpanded]       = useState(false);

  // ── Audio element & Web Audio refs ────────────────────────────────────────
  const audioRef         = useRef<HTMLAudioElement | null>(null);
  const audioCtxRef      = useRef<AudioContext | null>(null);
  const crossfadeGainRef = useRef<GainNode | null>(null);
  const eqFiltersRef     = useRef<BiquadFilterNode[]>([]);
  const analyserRef      = useRef<AnalyserNode | null>(null);
  const crossfadingRef   = useRef(false);

  // ── Mutable refs for event-handler closures (avoid stale captures) ────────
  const queueRef           = useRef(queue);
  const currentIndexRef    = useRef(currentIndex);
  const repeatRef          = useRef(repeat);
  const shuffleRef         = useRef(shuffle);
  const cfEnabledRef       = useRef(crossfadeEnabled);
  const cfDurRef           = useRef(crossfadeDuration);
  const sleepTimerEndRef   = useRef<number | null>(null);
  const isPlayingRef       = useRef(false);
  const volumeRef          = useRef(persisted.volume ?? 1);

  useEffect(() => { queueRef.current        = queue; },           [queue]);
  useEffect(() => { currentIndexRef.current = currentIndex; },   [currentIndex]);
  useEffect(() => { repeatRef.current       = repeat; },         [repeat]);
  useEffect(() => { shuffleRef.current      = shuffle; },        [shuffle]);
  useEffect(() => { cfEnabledRef.current    = crossfadeEnabled; },[crossfadeEnabled]);
  useEffect(() => { cfDurRef.current        = crossfadeDuration; },[crossfadeDuration]);
  useEffect(() => { sleepTimerEndRef.current = sleepTimerEnd; },  [sleepTimerEnd]);
  useEffect(() => { isPlayingRef.current    = isPlaying; },      [isPlaying]);
  useEffect(() => { volumeRef.current       = volume; },         [volume]);

  // ── Save to localStorage (throttled) ─────────────────────────────────────
  const saveTimer = useRef<ReturnType<typeof setTimeout>>();
  const scheduleSave = useCallback(() => {
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      persistState({
        volume: volumeRef.current,
        shuffle: shuffleRef.current,
        repeat: repeatRef.current,
        speed: audioRef.current?.playbackRate ?? 1,
        eqBands: eqFiltersRef.current.map(f => f.gain.value),
        crossfadeEnabled: cfEnabledRef.current,
        crossfadeDuration: cfDurRef.current,
        queue: queueRef.current,
        currentIndex: currentIndexRef.current,
        currentTime: audioRef.current?.currentTime ?? 0,
      });
    }, 2000);
  }, []);

  // ── Web Audio pipeline init (lazy, on first play) ─────────────────────────
  const initAudioContext = useCallback(() => {
    if (audioCtxRef.current || !audioRef.current) return;
    const ctx = new AudioContext();
    audioCtxRef.current = ctx;

    const source = ctx.createMediaElementSource(audioRef.current);

    const normGain = ctx.createGain();
    normGain.gain.value = 1;

    const xfGain = ctx.createGain();
    xfGain.gain.value = 1;
    crossfadeGainRef.current = xfGain;

    const filters = EQ_BANDS.map((band, i) => {
      const f = ctx.createBiquadFilter();
      f.type = band.type;
      f.frequency.value = band.freq;
      f.gain.value = eqFiltersRef.current[i]?.gain.value ?? (persisted.eqBands?.[i] ?? 0);
      if (band.type === "peaking") f.Q.value = 1;
      return f;
    });
    eqFiltersRef.current = filters;

    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.8;
    analyserRef.current = analyser;

    // Chain: source → normGain → xfGain → eq[0..4] → analyser → destination
    let node: AudioNode = source;
    node.connect(normGain); node = normGain;
    node.connect(xfGain);   node = xfGain;
    for (const f of filters) { node.connect(f); node = f; }
    node.connect(analyser);
    analyser.connect(ctx.destination);

    setAnalyserNode(analyser);
  }, []);

  // ── Audio element: create once on mount ───────────────────────────────────
  useEffect(() => {
    const audio = new Audio();
    audio.volume     = persisted.volume ?? 1;
    audio.playbackRate = persisted.speed ?? 1;
    audioRef.current = audio;

    // Restore track src so position can be resumed
    if ((persisted.queue?.length ?? 0) > 0 && (persisted.currentIndex ?? -1) >= 0) {
      const track = persisted.queue![persisted.currentIndex!];
      const url = (track as Track & { streamUrl?: string }).streamUrl
        ?? getStreamTrackUrl(track.id);
      audio.src = url;
      audio.currentTime = persisted.currentTime ?? 0;
      setCurrentTime(persisted.currentTime ?? 0);
    }

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
      scheduleSave();

      // Crossfade detection
      if (cfEnabledRef.current && !crossfadingRef.current) {
        const remaining = audio.duration - audio.currentTime;
        const fade = cfDurRef.current;
        if (!isNaN(remaining) && remaining > 0 && remaining <= fade) {
          crossfadingRef.current = true;
          const ctx = audioCtxRef.current;
          const g   = crossfadeGainRef.current;
          if (ctx && g) {
            g.gain.cancelScheduledValues(ctx.currentTime);
            g.gain.setValueAtTime(g.gain.value, ctx.currentTime);
            g.gain.linearRampToValueAtTime(0, ctx.currentTime + remaining);
          }
        }
      }

      // Sleep timer
      const end = sleepTimerEndRef.current;
      if (end && Date.now() >= end) {
        audio.pause();
        setSleepTimerEnd(null);
      }
    };

    const handleDurationChange = () => setDuration(audio.duration);
    const handlePlay           = () => setIsPlaying(true);
    const handlePause          = () => setIsPlaying(false);

    const handleEnded = () => {
      const q   = queueRef.current;
      const idx = currentIndexRef.current;
      const rep = repeatRef.current;
      const shf = shuffleRef.current;

      if (rep === "one") {
        audio.currentTime = 0;
        audio.play().catch(console.error);
        return;
      }
      if (shf && q.length > 1) {
        let newIdx: number;
        do { newIdx = Math.floor(Math.random() * q.length); }
        while (newIdx === idx);
        setCurrentIndex(newIdx);
        return;
      }
      if (idx < q.length - 1) {
        setCurrentIndex(i => i + 1);
      } else if (rep === "all") {
        setCurrentIndex(0);
      } else {
        setIsPlaying(false);
        setCurrentTime(0);
      }
    };

    audio.addEventListener("timeupdate",     handleTimeUpdate);
    audio.addEventListener("durationchange", handleDurationChange);
    audio.addEventListener("ended",          handleEnded);
    audio.addEventListener("play",           handlePlay);
    audio.addEventListener("pause",          handlePause);

    return () => {
      audio.removeEventListener("timeupdate",     handleTimeUpdate);
      audio.removeEventListener("durationchange", handleDurationChange);
      audio.removeEventListener("ended",          handleEnded);
      audio.removeEventListener("play",           handlePlay);
      audio.removeEventListener("pause",          handlePause);
      audio.pause();
      audio.src = "";
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Track change: load + play ──────────────────────────────────────────────
  const currentTrack = currentIndex >= 0 && currentIndex < queue.length
    ? queue[currentIndex] : null;

  useEffect(() => {
    if (!currentTrack || !audioRef.current) return;
    const audio = audioRef.current;

    initAudioContext();

    const url = (currentTrack as Track & { streamUrl?: string }).streamUrl
      ?? getStreamTrackUrl(currentTrack.id);
    audio.src = url;
    audio.playbackRate = audioRef.current.playbackRate; // preserve speed

    // Restore crossfade gain
    const ctx = audioCtxRef.current;
    const g   = crossfadeGainRef.current;
    if (ctx && g) {
      if (cfEnabledRef.current && crossfadingRef.current) {
        g.gain.cancelScheduledValues(ctx.currentTime);
        g.gain.setValueAtTime(0, ctx.currentTime);
        g.gain.linearRampToValueAtTime(1, ctx.currentTime + cfDurRef.current);
      } else {
        g.gain.cancelScheduledValues(ctx.currentTime);
        g.gain.setValueAtTime(1, ctx.currentTime);
      }
      crossfadingRef.current = false;
    }

    if (ctx?.state === "suspended") ctx.resume().catch(console.error);

    audio.play().catch(console.error);
    updateMediaSession(currentTrack);
    scheduleSave();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex]);

  // ── Media Session ──────────────────────────────────────────────────────────
  function updateMediaSession(track: Track) {
    if (!("mediaSession" in navigator)) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title:  track.title,
      artist: track.artistName ?? "",
      album:  track.albumTitle ?? "",
      artwork: track.albumId
        ? [{ src: `/api/music/art/${track.albumId}`, sizes: "512x512", type: "image/jpeg" }]
        : [],
    });
    navigator.mediaSession.setActionHandler("play",          () => audioRef.current?.play().catch(console.error));
    navigator.mediaSession.setActionHandler("pause",         () => audioRef.current?.pause());
    navigator.mediaSession.setActionHandler("previoustrack", () => prevFnRef.current());
    navigator.mediaSession.setActionHandler("nexttrack",     () => nextFnRef.current());
    navigator.mediaSession.setActionHandler("seekbackward",  ({ seekOffset }) => {
      if (audioRef.current) seek(Math.max(0, audioRef.current.currentTime - (seekOffset ?? 10)));
    });
    navigator.mediaSession.setActionHandler("seekforward", ({ seekOffset }) => {
      if (audioRef.current) seek(Math.min(audioRef.current.duration ?? 0, audioRef.current.currentTime + (seekOffset ?? 10)));
    });
  }

  // ── Player actions ────────────────────────────────────────────────────────
  const pause  = useCallback(() => audioRef.current?.pause(), []);
  const resume = useCallback(() => {
    initAudioContext();
    if (audioCtxRef.current?.state === "suspended") audioCtxRef.current.resume().catch(console.error);
    audioRef.current?.play().catch(console.error);
  }, [initAudioContext]);

  const togglePlayPause = useCallback(() => {
    if (isPlayingRef.current) pause();
    else resume();
  }, [pause, resume]);

  const seek = useCallback((time: number) => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = time;
    setCurrentTime(time);
  }, []);

  const setVolume = useCallback((vol: number) => {
    const clamped = Math.max(0, Math.min(1, vol));
    if (audioRef.current) audioRef.current.volume = clamped;
    setVolumeState(clamped);
    volumeRef.current = clamped;
    scheduleSave();
  }, [scheduleSave]);

  const next = useCallback(() => {
    const q   = queueRef.current;
    const idx = currentIndexRef.current;
    const rep = repeatRef.current;
    const shf = shuffleRef.current;

    if (shf && q.length > 1) {
      let newIdx: number;
      do { newIdx = Math.floor(Math.random() * q.length); }
      while (newIdx === idx);
      setCurrentIndex(newIdx);
      return;
    }
    if (idx < q.length - 1) setCurrentIndex(i => i + 1);
    else if (rep === "all") setCurrentIndex(0);
  }, []);

  const prev = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.currentTime > 3) { seek(0); return; }
    const idx = currentIndexRef.current;
    if (idx > 0) setCurrentIndex(i => i - 1);
    else seek(0);
  }, [seek]);

  // Stable refs so event handlers can call latest version
  const nextFnRef = useRef(next);
  const prevFnRef = useRef(prev);
  useEffect(() => { nextFnRef.current = next; }, [next]);
  useEffect(() => { prevFnRef.current = prev; }, [prev]);

  const playTrack = useCallback((track: Track, newQueue?: Track[]) => {
    if (newQueue) {
      setQueue(newQueue);
      const idx = newQueue.findIndex(t => t.id === track.id);
      setCurrentIndex(idx >= 0 ? idx : 0);
    } else {
      const q   = queueRef.current;
      const idx = q.findIndex(t => t.id === track.id);
      if (q.length === 0) {
        setQueue([track]);
        setCurrentIndex(0);
      } else if (idx >= 0) {
        setCurrentIndex(idx);
      } else {
        setQueue(prev => [...prev, track]);
        setCurrentIndex(q.length);
      }
    }
  }, []);

  const toggleShuffle = useCallback(() => {
    setShuffleSt(s => { const n = !s; scheduleSave(); return n; });
  }, [scheduleSave]);

  const cycleRepeat = useCallback(() => {
    setRepeatSt(r => {
      const next = r === "off" ? "all" : r === "all" ? "one" : "off";
      scheduleSave();
      return next;
    });
  }, [scheduleSave]);

  const setSpeed = useCallback((v: number) => {
    if (audioRef.current) audioRef.current.playbackRate = v;
    setSpeedSt(v);
    scheduleSave();
  }, [scheduleSave]);

  const setSleepTimer = useCallback((minutes: number | null) => {
    const end = minutes ? Date.now() + minutes * 60 * 1000 : null;
    setSleepTimerEnd(end);
    sleepTimerEndRef.current = end;
  }, []);

  const setCrossfade = useCallback((enabled: boolean, dur?: number) => {
    setCfEnabled(enabled);
    if (dur !== undefined) setCfDur(dur);
    scheduleSave();
  }, [scheduleSave]);

  const setEqBand = useCallback((index: number, gain: number) => {
    const f = eqFiltersRef.current[index];
    if (f) f.gain.value = gain;
    setEqBandsSt(prev => {
      const next = [...prev];
      next[index] = gain;
      return next;
    });
    scheduleSave();
  }, [scheduleSave]);

  const applyEqPreset = useCallback((preset: EqPresetName) => {
    const gains = EQ_PRESETS[preset];
    gains.forEach((g, i) => {
      const f = eqFiltersRef.current[i];
      if (f) f.gain.value = g;
    });
    setEqBandsSt([...gains]);
    scheduleSave();
  }, [scheduleSave]);

  const reorderQueue = useCallback((from: number, to: number) => {
    setQueue(q => {
      const next = [...q];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      // Adjust current index
      const ci = currentIndexRef.current;
      if (ci === from) setCurrentIndex(to);
      else if (from < ci && to >= ci) setCurrentIndex(i => i - 1);
      else if (from > ci && to <= ci) setCurrentIndex(i => i + 1);
      return next;
    });
  }, []);

  const removeFromQueue = useCallback((index: number) => {
    setQueue(q => {
      const next = q.filter((_, i) => i !== index);
      const ci = currentIndexRef.current;
      if (index < ci) setCurrentIndex(i => i - 1);
      else if (index === ci && index >= next.length) setCurrentIndex(next.length - 1);
      return next;
    });
  }, []);

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  const keyHandlerRef = useRef<(e: KeyboardEvent) => void>();
  keyHandlerRef.current = (e: KeyboardEvent) => {
    const target = e.target as HTMLElement;
    if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) return;
    switch (e.key) {
      case " ":
        e.preventDefault();
        if (isPlayingRef.current) pause(); else resume();
        break;
      case "ArrowLeft":
        if (e.shiftKey) { e.preventDefault(); prevFnRef.current(); }
        else if (audioRef.current) { e.preventDefault(); seek(Math.max(0, audioRef.current.currentTime - 10)); }
        break;
      case "ArrowRight":
        if (e.shiftKey) { e.preventDefault(); nextFnRef.current(); }
        else if (audioRef.current) { e.preventDefault(); seek(Math.min(audioRef.current.duration ?? 0, audioRef.current.currentTime + 10)); }
        break;
      case "m": case "M":
        setVolume(volumeRef.current === 0 ? 1 : 0);
        break;
    }
  };

  useEffect(() => {
    const h = (e: KeyboardEvent) => keyHandlerRef.current?.(e);
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <PlayerContext.Provider value={{
      queue, currentTrack, currentIndex, isPlaying, currentTime, duration, volume,
      shuffle, repeat, speed, sleepTimerEnd, crossfadeEnabled, crossfadeDuration,
      eqBands, analyserNode, isExpanded,
      playTrack, pause, resume, next, prev, seek, setVolume, togglePlayPause,
      toggleShuffle, cycleRepeat, setSpeed, setSleepTimer, setCrossfade,
      setEqBand, applyEqPreset, reorderQueue, removeFromQueue, setIsExpanded,
    }}>
      {children}
    </PlayerContext.Provider>
  );
}

export function usePlayer() {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error("usePlayer must be used within PlayerProvider");
  return ctx;
}
