import React, { useRef, useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, Play, Pause, Volume2, VolumeX, Maximize, Minimize,
  Subtitles, ChevronDown, Zap,
} from "lucide-react";
import { usePlayer } from "@/hooks/use-player";
import { getStreamVideoUrl, getGetSubtitlesUrl, TranscodingStatus, SubtitleTrack } from "@workspace/api-client-react";

function fmt(s: number) {
  if (!isFinite(s)) return "0:00";
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

function QualityBadge({ status }: { status: TranscodingStatus }) {
  if (status === TranscodingStatus.none) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
        Native
      </span>
    );
  }
  if (status === TranscodingStatus.done) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
        <Zap className="w-3 h-3" /> Transcoded
      </span>
    );
  }
  if (status === TranscodingStatus.processing) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-500/20 text-blue-300 border border-blue-500/30">
        <Zap className="w-3 h-3 animate-pulse" /> Transcoding…
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-muted text-muted-foreground">
      Pending
    </span>
  );
}

interface SubtitlePickerProps {
  tracks: SubtitleTrack[];
  selectedTrackId: string | null;
  onSelect: (trackId: string | null) => void;
}

function SubtitlePicker({ tracks, selectedTrackId, onSelect }: SubtitlePickerProps) {
  const [open, setOpen] = useState(false);

  if (tracks.length === 0) return null;

  const selected = tracks.find((t) => t.id === selectedTrackId);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
          selectedTrackId
            ? "bg-primary/20 text-primary"
            : "bg-white/10 text-white/70 hover:bg-white/20 hover:text-white"
        }`}
        title="Subtitles"
      >
        <Subtitles className="w-4 h-4" />
        <span className="hidden sm:inline">{selected ? selected.label : "Subtitles"}</span>
        <ChevronDown className={`w-3 h-3 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className="absolute bottom-full mb-2 right-0 min-w-[180px] bg-black/90 backdrop-blur-sm border border-white/10 rounded-xl shadow-2xl overflow-hidden z-10"
          >
            <div className="p-1">
              <button
                onClick={() => { onSelect(null); setOpen(false); }}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                  !selectedTrackId ? "bg-primary/20 text-primary font-medium" : "text-white/70 hover:bg-white/10 hover:text-white"
                }`}
              >
                Off
              </button>
              {tracks.map((track) => (
                <button
                  key={track.id}
                  onClick={() => { onSelect(track.id); setOpen(false); }}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                    selectedTrackId === track.id ? "bg-primary/20 text-primary font-medium" : "text-white/70 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  {track.label}
                  {track.language && <span className="text-xs text-white/40 ml-1">({track.language})</span>}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function VideoPlayer() {
  const { currentVideo, dismissVideo, volume, setVolume } = usePlayer();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const controlsTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [selectedSubtitleId, setSelectedSubtitleId] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);

  const resetControlsTimer = useCallback(() => {
    setShowControls(true);
    clearTimeout(controlsTimerRef.current);
    controlsTimerRef.current = setTimeout(() => {
      if (isPlaying) setShowControls(false);
    }, 3000);
  }, [isPlaying]);

  useEffect(() => {
    setSelectedSubtitleId(null);
    if (!currentVideo) return;
    const video = videoRef.current;
    if (!video) return;

    const streamUrl = getStreamVideoUrl(currentVideo.id);
    video.src = streamUrl;
    video.volume = volume;
    video.play().catch(console.error);
  }, [currentVideo?.id]);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onTimeUpdate = () => setCurrentTime(video.currentTime);
    const onDuration = () => setDuration(video.duration);
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onEnded = () => { setIsPlaying(false); dismissVideo(); };

    video.addEventListener("timeupdate", onTimeUpdate);
    video.addEventListener("durationchange", onDuration);
    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    video.addEventListener("ended", onEnded);

    return () => {
      video.removeEventListener("timeupdate", onTimeUpdate);
      video.removeEventListener("durationchange", onDuration);
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("ended", onEnded);
    };
  }, [dismissVideo]);

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  useEffect(() => {
    return () => {
      clearTimeout(controlsTimerRef.current);
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.src = "";
      }
    };
  }, []);

  if (!currentVideo) return null;

  const togglePlayPause = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) video.play().catch(console.error);
    else video.pause();
  };

  const seek = (t: number) => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = t;
    setCurrentTime(t);
  };

  const toggleFullscreen = () => {
    const el = containerRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      el.requestFullscreen().catch(console.error);
    } else {
      document.exitFullscreen().catch(console.error);
    }
  };

  const subtitlesUrl = selectedSubtitleId
    ? getGetSubtitlesUrl(currentVideo.id, selectedSubtitleId)
    : null;

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const hasSubtitles = currentVideo.subtitleTracks && currentVideo.subtitleTracks.length > 0;

  return (
    <AnimatePresence>
      <motion.div
        key="video-player"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        ref={containerRef}
        className="fixed inset-0 z-[70] bg-black flex flex-col"
        onMouseMove={resetControlsTimer}
        onTouchStart={resetControlsTimer}
        onClick={(e) => {
          if (e.target === videoRef.current || e.currentTarget === e.target) {
            togglePlayPause();
            resetControlsTimer();
          }
        }}
        style={{ cursor: showControls ? "default" : "none" }}
      >
        {/* Video element */}
        <video
          ref={videoRef}
          className="absolute inset-0 w-full h-full object-contain"
          playsInline
          crossOrigin="anonymous"
          onClick={(e) => { e.stopPropagation(); togglePlayPause(); resetControlsTimer(); }}
          style={{ cursor: showControls ? "default" : "none" }}
        >
          {subtitlesUrl && (
            <track
              key={selectedSubtitleId}
              src={subtitlesUrl}
              kind="subtitles"
              default
            />
          )}
        </video>

        {/* Controls overlay */}
        <AnimatePresence>
          {showControls && (
            <motion.div
              key="controls"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="absolute inset-0 pointer-events-none"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Top bar */}
              <div className="absolute top-0 left-0 right-0 p-4 flex items-center justify-between pointer-events-auto"
                style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.7) 0%, transparent 100%)" }}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <button
                    onClick={dismissVideo}
                    className="p-2 rounded-full bg-black/40 hover:bg-black/60 text-white transition-colors shrink-0"
                  >
                    <X className="w-5 h-5" />
                  </button>
                  <h2 className="text-white font-semibold text-lg truncate">{currentVideo.title}</h2>
                </div>
                <div className="shrink-0">
                  <QualityBadge status={currentVideo.transcodingStatus} />
                </div>
              </div>

              {/* Bottom controls */}
              <div className="absolute bottom-0 left-0 right-0 p-4 pointer-events-auto"
                style={{ background: "linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 100%)" }}
              >
                {/* Seek bar */}
                <div className="flex items-center gap-3 text-xs font-medium text-white/70 mb-3">
                  <span className="w-10 text-right shrink-0">{fmt(currentTime)}</span>
                  <div className="relative flex-1 group flex items-center">
                    <input
                      type="range"
                      min={0}
                      max={duration || 100}
                      value={currentTime}
                      onChange={(e) => seek(Number(e.target.value))}
                      className="player-slider relative z-10 w-full bg-transparent"
                    />
                    <div className="absolute left-0 h-1.5 bg-white/20 rounded-full w-full pointer-events-none overflow-hidden">
                      <div
                        className="h-full bg-primary group-hover:bg-primary transition-colors rounded-full"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                  <span className="w-10 shrink-0">{fmt(duration)}</span>
                </div>

                {/* Control buttons row */}
                <div className="flex items-center justify-between gap-4">
                  {/* Left: play/pause + volume */}
                  <div className="flex items-center gap-3">
                    <button
                      onClick={togglePlayPause}
                      className="w-10 h-10 flex items-center justify-center bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors"
                    >
                      {isPlaying
                        ? <Pause className="w-5 h-5 fill-current" />
                        : <Play className="w-5 h-5 fill-current ml-0.5" />}
                    </button>
                    <button
                      onClick={() => setIsMuted((m) => !m)}
                      className="p-2 text-white/70 hover:text-white transition-colors"
                    >
                      {isMuted || volume === 0 ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                    </button>
                    <div className="w-20 flex items-center relative group hidden sm:flex">
                      <input
                        type="range"
                        min={0}
                        max={1}
                        step={0.01}
                        value={isMuted ? 0 : volume}
                        onChange={(e) => { setVolume(Number(e.target.value)); setIsMuted(false); }}
                        className="player-slider relative z-10 w-full bg-transparent"
                      />
                      <div className="absolute left-0 h-1.5 bg-white/20 rounded-full w-full pointer-events-none overflow-hidden">
                        <div className="h-full bg-white/70 rounded-full" style={{ width: `${(isMuted ? 0 : volume) * 100}%` }} />
                      </div>
                    </div>
                  </div>

                  {/* Right: subtitles + fullscreen */}
                  <div className="flex items-center gap-2">
                    {hasSubtitles && (
                      <SubtitlePicker
                        tracks={currentVideo.subtitleTracks ?? []}
                        selectedTrackId={selectedSubtitleId}
                        onSelect={setSelectedSubtitleId}
                      />
                    )}
                    <button
                      onClick={toggleFullscreen}
                      className="p-2 text-white/70 hover:text-white transition-colors"
                      title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
                    >
                      {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Center play/pause indicator on click */}
        <AnimatePresence>
          {!showControls && !isPlaying && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="absolute inset-0 flex items-center justify-center pointer-events-none"
            >
              <div className="w-20 h-20 bg-black/50 rounded-full flex items-center justify-center">
                <Play className="w-10 h-10 text-white fill-current ml-1" />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </AnimatePresence>
  );
}
