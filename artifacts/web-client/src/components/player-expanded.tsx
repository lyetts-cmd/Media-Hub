import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronDown, SkipBack, SkipForward, Play, Pause,
  Shuffle, Repeat, Repeat1, Volume2, VolumeX, ListMusic,
  RotateCcw, RotateCw, Clock, Zap, SlidersHorizontal, X, GripVertical,
} from "lucide-react";
import { usePlayer, EQ_BANDS, EQ_PRESETS, EqPresetName } from "@/hooks/use-player";
import { getGetAlbumArtUrl } from "@workspace/api-client-react";
import AudioVisualizer from "./audio-visualizer";

function fmt(s: number) {
  if (!isFinite(s)) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

function fmtMs(ms: number) {
  const totalSec = Math.ceil(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];
const SLEEP_OPTIONS = [15, 30, 45, 60] as const;
const EQ_PRESET_LABELS: Record<EqPresetName, string> = {
  flat: "Flat", bass_boost: "Bass+", treble_boost: "Treble+",
  rock: "Rock", jazz: "Jazz", classical: "Classical",
};

// ─── Draggable queue item ─────────────────────────────────────────────────────
interface QueueItemProps {
  track: { title: string; artistName?: string | null };
  index: number;
  isCurrent: boolean;
  onPlay: () => void;
  onRemove: () => void;
  onDragStart: (i: number) => void;
  onDragOver: (i: number) => void;
  onDrop: () => void;
}
function QueueItem({ track, index, isCurrent, onPlay, onRemove, onDragStart, onDragOver, onDrop }: QueueItemProps) {
  return (
    <div
      draggable
      onDragStart={() => onDragStart(index)}
      onDragOver={e => { e.preventDefault(); onDragOver(index); }}
      onDrop={onDrop}
      className={`flex items-center gap-3 px-4 py-2.5 rounded-lg cursor-grab active:cursor-grabbing transition-colors
        ${isCurrent ? "bg-primary/15 border border-primary/30" : "hover:bg-white/5"}`}
    >
      <GripVertical className="w-4 h-4 text-muted-foreground/40 shrink-0" />
      <button onClick={onPlay} className="flex-1 min-w-0 text-left">
        <p className={`text-sm font-medium truncate ${isCurrent ? "text-primary" : "text-foreground"}`}>
          {track.title}
        </p>
        {track.artistName && (
          <p className="text-xs text-muted-foreground truncate">{track.artistName}</p>
        )}
      </button>
      <button onClick={onRemove} className="p-1 rounded text-muted-foreground/50 hover:text-foreground transition-colors shrink-0">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function PlayerExpanded() {
  const {
    currentTrack, isPlaying, currentTime, duration, volume,
    shuffle, shuffleMode, repeat, speed, sleepTimerEnd, crossfadeEnabled, crossfadeDuration,
    eqBands, analyserNode, isExpanded, queue, currentIndex,
    togglePlayPause, prev, next, seek, setVolume,
    cycleShuffleMode, cycleRepeat, setSpeed, setSleepTimer, setCrossfade,
    setEqBand, applyEqPreset, reorderQueue, removeFromQueue, setIsExpanded,
    playTrack,
  } = usePlayer();

  const [showQueue,    setShowQueue]    = useState(false);
  const [showEq,       setShowEq]       = useState(false);
  const [showSleep,    setShowSleep]    = useState(false);
  const [showCrossfade, setShowCrossfade] = useState(false);
  const [sleepRemaining, setSleepRemaining] = useState<number | null>(null);
  const [dragFrom, setDragFrom]         = useState<number | null>(null);
  const [dragOver, setDragOver]         = useState<number | null>(null);
  // Track which duration (in minutes) was last chosen so each button shows its own active state
  const [activeSleepMinutes, setActiveSleepMinutes] = useState<number | null>(null);

  const handleSetSleepTimer = (minutes: number | null) => {
    setSleepTimer(minutes);
    setActiveSleepMinutes(minutes);
  };

  // Clear active selection when timer expires
  useEffect(() => {
    if (!sleepTimerEnd) setActiveSleepMinutes(null);
  }, [sleepTimerEnd]);

  // Sleep timer countdown
  useEffect(() => {
    if (!sleepTimerEnd) { setSleepRemaining(null); return; }
    const tick = () => {
      const rem = sleepTimerEnd - Date.now();
      setSleepRemaining(rem > 0 ? rem : null);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [sleepTimerEnd]);

  if (!currentTrack) return null;

  const artUrl = currentTrack.albumId
    ? getGetAlbumArtUrl(currentTrack.albumId)
    : `${import.meta.env.BASE_URL}images/default-art.png`;

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  const handleDrop = () => {
    if (dragFrom !== null && dragOver !== null && dragFrom !== dragOver) {
      reorderQueue(dragFrom, dragOver);
    }
    setDragFrom(null);
    setDragOver(null);
  };

  return (
    <AnimatePresence>
      {isExpanded && (
        <motion.div
          key="expanded-player"
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ type: "spring", damping: 30, stiffness: 300 }}
          className="fixed inset-0 z-[60] flex overflow-hidden"
          style={{
            background: "linear-gradient(160deg, hsl(var(--background)) 0%, hsl(265 40% 8%) 100%)",
          }}
        >
          {/* ── Main panel ── */}
          <div className="flex-1 flex flex-col overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between p-4 pt-6 shrink-0">
              <button
                onClick={() => setIsExpanded(false)}
                className="p-2 rounded-full hover:bg-white/10 transition-colors text-muted-foreground hover:text-foreground"
              >
                <ChevronDown className="w-6 h-6" />
              </button>
              <span className="text-sm font-semibold text-muted-foreground uppercase tracking-widest">Now Playing</span>
              <button
                onClick={() => { setShowQueue(q => !q); setShowEq(false); }}
                className={`p-2 rounded-full transition-colors ${showQueue ? "text-primary bg-primary/10" : "text-muted-foreground hover:bg-white/10 hover:text-foreground"}`}
              >
                <ListMusic className="w-5 h-5" />
              </button>
            </div>

            {/* Album art */}
            <div className="flex justify-center px-8 mb-6 shrink-0">
              <motion.div
                className="relative w-full max-w-xs aspect-square rounded-2xl overflow-hidden shadow-2xl shadow-black/60"
                animate={isPlaying ? { scale: [1, 1.015, 1] } : { scale: 1 }}
                transition={isPlaying ? { duration: 3, repeat: Infinity, ease: "easeInOut" } : {}}
              >
                <img
                  src={artUrl}
                  alt={currentTrack.albumTitle || "Album art"}
                  className="w-full h-full object-cover"
                  onError={e => { (e.target as HTMLImageElement).src = `${import.meta.env.BASE_URL}images/default-art.png`; }}
                />
                <div className="absolute inset-0 ring-1 ring-white/10 rounded-2xl" />
              </motion.div>
            </div>

            {/* Track info */}
            <div className="text-center px-8 mb-6 shrink-0">
              <h2 className="text-xl font-bold text-foreground truncate">{currentTrack.title}</h2>
              <p className="text-sm text-muted-foreground mt-0.5 truncate">
                {currentTrack.artistName ?? "Unknown Artist"}
              </p>
              {currentTrack.albumTitle && (
                <p className="text-xs text-muted-foreground/60 mt-0.5 truncate">{currentTrack.albumTitle}</p>
              )}
            </div>

            {/* Progress bar */}
            <div className="px-6 mb-4 shrink-0">
              <div className="relative group flex items-center">
                <input
                  type="range" min={0} max={duration || 100} value={currentTime}
                  onChange={e => seek(Number(e.target.value))}
                  className="player-slider relative z-10 w-full bg-transparent"
                />
                <div className="absolute left-0 h-1.5 bg-white/10 rounded-full w-full pointer-events-none overflow-hidden">
                  <div className="h-full bg-primary transition-colors rounded-full" style={{ width: `${progress}%` }} />
                </div>
              </div>
              <div className="flex justify-between text-xs text-muted-foreground mt-1 font-medium">
                <span>{fmt(currentTime)}</span>
                <span>{fmt(duration)}</span>
              </div>
            </div>

            {/* Main controls */}
            <div className="flex items-center justify-center gap-4 px-6 mb-5 shrink-0">
              <button
                onClick={cycleShuffleMode}
                className={`p-2 rounded-full transition-colors relative ${shuffle ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}
                title={shuffleMode === "off" ? "Shuffle off" : shuffleMode === "normal" ? "Normal shuffle" : "Smart shuffle (no repeats)"}
              >
                <Shuffle className="w-5 h-5" />
                {shuffleMode === "smart" && (
                  <span className="absolute -top-0.5 -right-0.5 text-[9px] font-bold text-primary leading-none">S</span>
                )}
              </button>
              <button onClick={prev} className="p-2 rounded-full text-muted-foreground hover:text-foreground transition-colors">
                <SkipBack className="w-6 h-6 fill-current" />
              </button>
              <button
                onClick={() => seek(Math.max(0, currentTime - 15))}
                className="p-2 rounded-full text-muted-foreground hover:text-foreground transition-colors"
                title="Back 15s"
              >
                <RotateCcw className="w-5 h-5" />
              </button>
              <button
                onClick={togglePlayPause}
                className="w-16 h-16 flex items-center justify-center bg-primary text-primary-foreground rounded-full shadow-xl shadow-primary/30 hover:scale-105 active:scale-95 transition-all"
              >
                {isPlaying
                  ? <Pause className="w-7 h-7 fill-current" />
                  : <Play  className="w-7 h-7 fill-current ml-1" />}
              </button>
              <button
                onClick={() => seek(Math.min(duration || 0, currentTime + 15))}
                className="p-2 rounded-full text-muted-foreground hover:text-foreground transition-colors"
                title="Forward 15s"
              >
                <RotateCw className="w-5 h-5" />
              </button>
              <button onClick={next} className="p-2 rounded-full text-muted-foreground hover:text-foreground transition-colors">
                <SkipForward className="w-6 h-6 fill-current" />
              </button>
              <button
                onClick={cycleRepeat}
                className={`p-2 rounded-full transition-colors ${repeat !== "off" ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}
                title={repeat === "off" ? "No repeat" : repeat === "all" ? "Repeat all" : "Repeat one"}
              >
                {repeat === "one" ? <Repeat1 className="w-5 h-5" /> : <Repeat className="w-5 h-5" />}
              </button>
            </div>

            {/* Volume */}
            <div className="flex items-center gap-3 px-8 mb-5 shrink-0">
              <button onClick={() => setVolume(volume === 0 ? 1 : 0)} className="text-muted-foreground hover:text-foreground transition-colors shrink-0">
                {volume === 0 ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
              </button>
              <div className="relative flex-1 group flex items-center">
                <input
                  type="range" min={0} max={1} step={0.01} value={volume}
                  onChange={e => setVolume(Number(e.target.value))}
                  className="player-slider relative z-10 w-full bg-transparent"
                />
                <div className="absolute left-0 h-1.5 bg-white/10 rounded-full w-full pointer-events-none overflow-hidden">
                  <div className="h-full bg-foreground/70 rounded-full" style={{ width: `${volume * 100}%` }} />
                </div>
              </div>
            </div>

            {/* Speed */}
            <div className="flex items-center gap-2 justify-center px-6 mb-5 shrink-0">
              <span className="text-xs text-muted-foreground font-medium mr-1">Speed</span>
              {SPEEDS.map(s => (
                <button
                  key={s}
                  onClick={() => setSpeed(s)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
                    speed === s ? "bg-primary text-primary-foreground" : "bg-white/5 text-muted-foreground hover:bg-white/10 hover:text-foreground"
                  }`}
                >
                  {s}×
                </button>
              ))}
            </div>

            {/* Visualizer */}
            <div className="px-6 mb-4 h-20 shrink-0">
              <AudioVisualizer analyserNode={analyserNode} isPlaying={isPlaying} barCount={48} />
            </div>

            {/* Secondary control buttons */}
            <div className="flex items-center justify-center gap-3 px-6 mb-4 shrink-0 flex-wrap">
              <button
                onClick={() => { setShowEq(e => !e); setShowSleep(false); setShowCrossfade(false); }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  showEq ? "bg-primary/20 text-primary" : "bg-white/5 text-muted-foreground hover:bg-white/10 hover:text-foreground"
                }`}
              >
                <SlidersHorizontal className="w-3.5 h-3.5" /> Equalizer
              </button>
              <button
                onClick={() => { setShowSleep(e => !e); setShowEq(false); setShowCrossfade(false); }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  showSleep ? "bg-primary/20 text-primary" : "bg-white/5 text-muted-foreground hover:bg-white/10 hover:text-foreground"
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                {sleepRemaining ? fmtMs(sleepRemaining) : "Sleep Timer"}
              </button>
              <button
                onClick={() => { setShowCrossfade(e => !e); setShowEq(false); setShowSleep(false); }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  showCrossfade ? "bg-primary/20 text-primary" : "bg-white/5 text-muted-foreground hover:bg-white/10 hover:text-foreground"
                }`}
              >
                <Zap className="w-3.5 h-3.5" /> Crossfade
              </button>
            </div>

            {/* ── EQ Panel ── */}
            <AnimatePresence>
              {showEq && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden px-6 mb-4"
                >
                  <div className="bg-white/5 rounded-2xl p-4">
                    {/* Preset buttons */}
                    <div className="flex flex-wrap gap-2 mb-4">
                      {(Object.keys(EQ_PRESET_LABELS) as EqPresetName[]).map(preset => (
                        <button
                          key={preset}
                          onClick={() => applyEqPreset(preset)}
                          className="px-2.5 py-1 rounded-lg text-xs font-medium bg-white/5 hover:bg-primary/20 hover:text-primary text-muted-foreground transition-colors"
                        >
                          {EQ_PRESET_LABELS[preset]}
                        </button>
                      ))}
                    </div>
                    {/* Band sliders */}
                    <div className="flex items-end justify-between gap-2 h-28">
                      {EQ_BANDS.map((band, i) => (
                        <div key={band.freq} className="flex flex-col items-center gap-1 flex-1">
                          <span className="text-[10px] text-primary font-mono">{eqBands[i] > 0 ? "+" : ""}{eqBands[i]}</span>
                          <div className="relative flex-1 w-full flex justify-center" style={{ height: 80 }}>
                            <input
                              type="range"
                              min={-12} max={12} step={0.5}
                              value={eqBands[i]}
                              onChange={e => setEqBand(i, Number(e.target.value))}
                              className="player-slider"
                              style={{
                                writingMode: "vertical-lr",
                                direction: "rtl",
                                width: 24,
                                height: 80,
                                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                appearance: "slider-vertical" as any,
                                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                WebkitAppearance: "slider-vertical" as any,
                              }}
                            />
                          </div>
                          <span className="text-[10px] text-muted-foreground">{band.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ── Sleep Timer Panel ── */}
            <AnimatePresence>
              {showSleep && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden px-6 mb-4"
                >
                  <div className="bg-white/5 rounded-2xl p-4">
                    <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider mb-3">
                      Pause after…
                    </p>
                    <div className="flex gap-2 flex-wrap">
                      {SLEEP_OPTIONS.map(min => (
                        <button
                          key={min}
                          onClick={() => handleSetSleepTimer(activeSleepMinutes === min ? null : min)}
                          className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors min-w-[60px] ${
                            activeSleepMinutes === min
                              ? "bg-primary/30 text-primary ring-1 ring-primary/50"
                              : "bg-white/5 hover:bg-white/10 text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          {min} min
                        </button>
                      ))}
                      {sleepTimerEnd && (
                        <button
                          onClick={() => handleSetSleepTimer(null)}
                          className="flex-1 py-2 rounded-lg text-sm font-medium bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors min-w-[60px]"
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                    {sleepRemaining && (
                      <p className="text-xs text-primary mt-2 text-center">
                        Pausing in {fmtMs(sleepRemaining)}
                      </p>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ── Crossfade Panel ── */}
            <AnimatePresence>
              {showCrossfade && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden px-6 mb-4"
                >
                  <div className="bg-white/5 rounded-2xl p-4">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">
                        Crossfade between tracks
                      </p>
                      <button
                        onClick={() => setCrossfade(!crossfadeEnabled)}
                        className={`relative w-10 h-5 rounded-full transition-colors ${crossfadeEnabled ? "bg-primary" : "bg-white/20"}`}
                      >
                        <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${crossfadeEnabled ? "translate-x-5" : "translate-x-0.5"}`} />
                      </button>
                    </div>
                    {crossfadeEnabled && (
                      <div className="space-y-2">
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>Duration</span>
                          <span className="text-primary font-medium">{crossfadeDuration}s</span>
                        </div>
                        <div className="relative group flex items-center">
                          <input
                            type="range" min={0} max={12} step={0.5} value={crossfadeDuration}
                            onChange={e => setCrossfade(true, Number(e.target.value))}
                            className="player-slider relative z-10 w-full bg-transparent"
                          />
                          <div className="absolute left-0 h-1.5 bg-white/10 rounded-full w-full pointer-events-none overflow-hidden">
                            <div className="h-full bg-primary rounded-full" style={{ width: `${(crossfadeDuration / 12) * 100}%` }} />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="h-8 shrink-0" />
          </div>

          {/* ── Queue side panel ── */}
          <AnimatePresence>
            {showQueue && (
              <motion.div
                initial={{ x: "100%" }}
                animate={{ x: 0 }}
                exit={{ x: "100%" }}
                transition={{ type: "spring", damping: 30, stiffness: 300 }}
                className="w-full md:w-80 bg-black/30 backdrop-blur-sm border-l border-white/5 flex flex-col absolute md:relative inset-0 md:inset-auto z-10"
              >
                <div className="flex items-center justify-between p-4 border-b border-white/5 shrink-0">
                  <h3 className="font-semibold text-sm">Queue</h3>
                  <button onClick={() => setShowQueue(false)} className="p-1 rounded text-muted-foreground hover:text-foreground">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto py-2 space-y-0.5">
                  {queue.length === 0 ? (
                    <p className="text-center text-muted-foreground text-sm py-8">Queue is empty</p>
                  ) : (
                    queue.map((track, i) => (
                      <QueueItem
                        key={`${track.id}-${i}`}
                        track={track}
                        index={i}
                        isCurrent={i === currentIndex}
                        onPlay={() => playTrack(track, queue)}
                        onRemove={() => removeFromQueue(i)}
                        onDragStart={setDragFrom}
                        onDragOver={setDragOver}
                        onDrop={handleDrop}
                      />
                    ))
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
