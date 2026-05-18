import React, { useRef, useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, Play, Pause, Volume2, VolumeX, Maximize, Minimize,
  Subtitles, ChevronDown, Zap, Loader2, AlertCircle, RefreshCw, Settings2, PictureInPicture2,
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

type QualityMode = "auto" | "native" | "transcoded";

function buildStreamUrl(id: number, mode: QualityMode): string {
  const base = getStreamVideoUrl(id);
  if (mode === "native") return `${base}?native=1`;
  return base;
}

function QualityBadge({ status, mode }: { status: TranscodingStatus; mode: QualityMode }) {
  if (status === TranscodingStatus.done && mode === "native") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
        Native
      </span>
    );
  }
  if (status === TranscodingStatus.done && mode !== "native") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
        <Zap className="w-3 h-3" /> Transcoded
      </span>
    );
  }
  if (status === TranscodingStatus.none) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
        Native
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

interface QualityPickerProps {
  mode: QualityMode;
  onSelect: (mode: QualityMode) => void;
}

function QualityPicker({ mode, onSelect }: QualityPickerProps) {
  const [open, setOpen] = useState(false);

  const options: { value: QualityMode; label: string; sub: string }[] = [
    { value: "auto",       label: "Auto",       sub: "Transcoded (browser-safe)"  },
    { value: "transcoded", label: "Transcoded",  sub: "Re-encoded for compatibility" },
    { value: "native",     label: "Native",      sub: "Original file, best quality"  },
  ];

  const current = options.find((o) => o.value === mode)!;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-white/10 text-white/70 hover:bg-white/20 hover:text-white transition-colors"
        title="Quality"
      >
        <Settings2 className="w-4 h-4" />
        <span className="hidden sm:inline">{current.label}</span>
        <ChevronDown className={`w-3 h-3 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className="absolute bottom-full mb-2 right-0 min-w-[210px] bg-black/90 backdrop-blur-sm border border-white/10 rounded-xl shadow-2xl overflow-hidden z-10"
          >
            <div className="p-1">
              {options.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => { onSelect(opt.value); setOpen(false); }}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                    mode === opt.value
                      ? "bg-primary/20 text-primary font-medium"
                      : "text-white/70 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  <div>{opt.label}</div>
                  <div className="text-xs text-white/40 font-normal">{opt.sub}</div>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
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

type VideoErrorKind = "transcoding" | "generic";

interface VideoError {
  kind: VideoErrorKind;
  message: string;
}

export default function VideoPlayer() {
  const { currentVideo, dismissVideo, volume, setVolume } = usePlayer();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const controlsTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const volumeRef = useRef(volume);
  useEffect(() => { volumeRef.current = volume; }, [volume]);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPiP, setIsPiP] = useState(false);
  const [selectedSubtitleId, setSelectedSubtitleId] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isBuffering, setIsBuffering] = useState(true);
  const [videoError, setVideoError] = useState<VideoError | null>(null);
  const [qualityMode, setQualityMode] = useState<QualityMode>("auto");

  const resetControlsTimer = useCallback(() => {
    setShowControls(true);
    clearTimeout(controlsTimerRef.current);
    controlsTimerRef.current = setTimeout(() => {
      if (isPlaying) setShowControls(false);
    }, 3000);
  }, [isPlaying]);

  const loadVideo = useCallback((videoId: number, vol: number, mode: QualityMode) => {
    const video = videoRef.current;
    if (!video) return;
    clearTimeout(retryTimerRef.current);
    setVideoError(null);
    setIsBuffering(true);
    setCurrentTime(0);
    setDuration(0);
    video.src = buildStreamUrl(videoId, mode);
    video.volume = vol;
    video.load();
    video.play().catch(() => {});
  }, []);

  useEffect(() => {
    setSelectedSubtitleId(null);
    setQualityMode("auto");
    if (!currentVideo) return;
    loadVideo(currentVideo.id, volumeRef.current, "auto");
  }, [currentVideo?.id]);

  useEffect(() => {
    if (!currentVideo) return;
    const savedTime = videoRef.current?.currentTime ?? 0;
    loadVideo(currentVideo.id, volumeRef.current, qualityMode);
    if (savedTime > 0 && videoRef.current) {
      const onLoaded = () => {
        if (videoRef.current) videoRef.current.currentTime = savedTime;
        videoRef.current?.removeEventListener("loadedmetadata", onLoaded);
      };
      videoRef.current.addEventListener("loadedmetadata", onLoaded);
    }
  }, [qualityMode]);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onTimeUpdate  = () => setCurrentTime(video.currentTime);
    const onDuration    = () => setDuration(video.duration);
    const onPlay        = () => { setIsPlaying(true); setIsBuffering(false); };
    const onPause       = () => setIsPlaying(false);
    const onEnded       = () => { setIsPlaying(false); dismissVideo(); };
    const onWaiting     = () => setIsBuffering(true);
    const onCanPlay     = () => setIsBuffering(false);
    const onPlaying     = () => setIsBuffering(false);

    const onError = () => {
      const currentVideoId = Number(video.dataset.videoId);
      if (!currentVideoId) return;

      fetch(getStreamVideoUrl(currentVideoId), { method: "HEAD" })
        .then((res) => {
          if (res.status === 503) {
            setVideoError({
              kind: "transcoding",
              message: "This video is being prepared for playback. It will be ready shortly.",
            });
            retryTimerRef.current = setTimeout(() => {
              if (videoRef.current?.dataset.videoId) {
                loadVideo(
                  Number(videoRef.current.dataset.videoId),
                  volumeRef.current,
                  qualityModeRef.current,
                );
              }
            }, 5000);
          } else {
            setVideoError({
              kind: "generic",
              message: "Failed to load video. The file may be missing or unsupported.",
            });
          }
        })
        .catch(() => {
          setVideoError({
            kind: "generic",
            message: "Failed to load video. Check your connection and try again.",
          });
        });
      setIsBuffering(false);
    };

    video.addEventListener("timeupdate",     onTimeUpdate);
    video.addEventListener("durationchange", onDuration);
    video.addEventListener("play",           onPlay);
    video.addEventListener("pause",          onPause);
    video.addEventListener("ended",          onEnded);
    video.addEventListener("waiting",        onWaiting);
    video.addEventListener("canplay",        onCanPlay);
    video.addEventListener("playing",        onPlaying);
    video.addEventListener("error",          onError);

    return () => {
      video.removeEventListener("timeupdate",     onTimeUpdate);
      video.removeEventListener("durationchange", onDuration);
      video.removeEventListener("play",           onPlay);
      video.removeEventListener("pause",          onPause);
      video.removeEventListener("ended",          onEnded);
      video.removeEventListener("waiting",        onWaiting);
      video.removeEventListener("canplay",        onCanPlay);
      video.removeEventListener("playing",        onPlaying);
      video.removeEventListener("error",          onError);
    };
  }, [dismissVideo, loadVideo]);

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onEnterPiP = () => setIsPiP(true);
    const onLeavePiP = () => setIsPiP(false);
    video.addEventListener("enterpictureinpicture", onEnterPiP);
    video.addEventListener("leavepictureinpicture", onLeavePiP);
    return () => {
      video.removeEventListener("enterpictureinpicture", onEnterPiP);
      video.removeEventListener("leavepictureinpicture", onLeavePiP);
    };
  }, []);

  useEffect(() => {
    return () => {
      clearTimeout(controlsTimerRef.current);
      clearTimeout(retryTimerRef.current);
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.src = "";
      }
    };
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (currentVideo) {
      video.dataset.videoId = String(currentVideo.id);
    }
  }, [currentVideo?.id]);

  const qualityModeRef = useRef(qualityMode);
  useEffect(() => { qualityModeRef.current = qualityMode; }, [qualityMode]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !currentVideo) return;
    const apiTracks = currentVideo.subtitleTracks ?? [];
    const htmlTracks = video.textTracks;
    for (let i = 0; i < htmlTracks.length; i++) {
      const t = htmlTracks[i];
      const byId = (t as TextTrack & { id?: string }).id;
      const isSelected = byId
        ? byId === selectedSubtitleId
        : apiTracks[i]?.id === selectedSubtitleId;
      t.mode = isSelected ? "showing" : "hidden";
    }
  }, [selectedSubtitleId, currentVideo]);

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

  const togglePiP = () => {
    const video = videoRef.current;
    if (!video) return;
    if (document.pictureInPictureElement) {
      document.exitPictureInPicture().catch(console.error);
    } else {
      video.requestPictureInPicture().catch(console.error);
    }
  };

  const handleQualityChange = (mode: QualityMode) => {
    setQualityMode(mode);
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const hasSubtitles = currentVideo.subtitleTracks && currentVideo.subtitleTracks.length > 0;
  const canPickQuality = currentVideo.transcodingStatus === TranscodingStatus.done;

  return (
    <>
      {/* Mini card shown while PiP is active — floats over the library */}
      <AnimatePresence>
        {isPiP && (
          <motion.div
            key="pip-card"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-6 right-6 z-[80] flex items-center gap-3 px-4 py-3 rounded-2xl bg-black/80 backdrop-blur-md border border-white/10 shadow-2xl"
          >
            <div className="flex flex-col min-w-0">
              <span className="text-white text-sm font-semibold truncate max-w-[160px]">{currentVideo.title}</span>
              <span className="text-white/50 text-xs">Playing in picture-in-picture</span>
            </div>
            <button
              onClick={togglePiP}
              className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white/70 hover:text-white transition-colors shrink-0"
              title="Exit picture-in-picture"
            >
              <PictureInPicture2 className="w-4 h-4" />
            </button>
            <button
              onClick={dismissVideo}
              className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white/70 hover:text-white transition-colors shrink-0"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Full-screen player — always mounted to preserve the video element,
          ref bindings, and event listeners; hidden via CSS when PiP is active */}
    <AnimatePresence>
      <motion.div
        key="video-player"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        ref={containerRef}
        className={`fixed inset-0 z-[70] bg-black flex flex-col${isPiP ? " invisible pointer-events-none" : ""}`}
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
          {currentVideo.subtitleTracks?.map((track) => (
            <track
              key={track.id}
              id={track.id}
              src={getGetSubtitlesUrl(currentVideo.id, track.id)}
              kind="subtitles"
              label={track.label}
              srcLang={track.language ?? undefined}
            />
          ))}
        </video>

        {/* Buffering spinner */}
        <AnimatePresence>
          {isBuffering && !videoError && (
            <motion.div
              key="buffering"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="absolute inset-0 flex items-center justify-center pointer-events-none"
            >
              <div className="w-16 h-16 bg-black/50 rounded-full flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-white animate-spin" />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Error overlay */}
        <AnimatePresence>
          {videoError && (
            <motion.div
              key="error"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="absolute inset-0 flex items-center justify-center pointer-events-auto"
            >
              <div className="max-w-sm w-full mx-4 bg-black/80 backdrop-blur-sm border border-white/10 rounded-2xl p-6 flex flex-col items-center gap-4 text-center">
                {videoError.kind === "transcoding" ? (
                  <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center">
                    <Zap className="w-6 h-6 text-blue-300 animate-pulse" />
                  </div>
                ) : (
                  <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center">
                    <AlertCircle className="w-6 h-6 text-red-300" />
                  </div>
                )}
                <div>
                  <p className="text-white font-semibold mb-1">
                    {videoError.kind === "transcoding" ? "Preparing video…" : "Playback error"}
                  </p>
                  <p className="text-white/60 text-sm">{videoError.message}</p>
                  {videoError.kind === "transcoding" && (
                    <p className="text-white/40 text-xs mt-2">Retrying automatically…</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => loadVideo(currentVideo.id, volumeRef.current, qualityModeRef.current)}
                    className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    <RefreshCw className="w-4 h-4" /> Retry now
                  </button>
                  <button
                    onClick={dismissVideo}
                    className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white/70 text-sm font-medium rounded-lg transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Controls overlay */}
        <AnimatePresence>
          {showControls && !videoError && (
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
              <div
                className="absolute top-0 left-0 right-0 p-4 flex items-center justify-between pointer-events-auto"
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
                <div className="flex items-center gap-2 shrink-0">
                  <QualityBadge status={currentVideo.transcodingStatus} mode={qualityMode} />
                </div>
              </div>

              {/* Bottom controls */}
              <div
                className="absolute bottom-0 left-0 right-0 p-4 pointer-events-auto"
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

                  {/* Right: quality + subtitles + fullscreen */}
                  <div className="flex items-center gap-2">
                    {canPickQuality && (
                      <QualityPicker mode={qualityMode} onSelect={handleQualityChange} />
                    )}
                    {hasSubtitles && (
                      <SubtitlePicker
                        tracks={currentVideo.subtitleTracks ?? []}
                        selectedTrackId={selectedSubtitleId}
                        onSelect={setSelectedSubtitleId}
                      />
                    )}
                    {document.pictureInPictureEnabled && (
                      <button
                        onClick={togglePiP}
                        className={`p-2 transition-colors ${isPiP ? "text-primary" : "text-white/70 hover:text-white"}`}
                        title={isPiP ? "Exit picture-in-picture" : "Picture-in-picture"}
                      >
                        <PictureInPicture2 className="w-5 h-5" />
                      </button>
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

        {/* Close button always visible when error is shown */}
        {videoError && (
          <div className="absolute top-4 left-4 z-10 pointer-events-auto">
            <button
              onClick={dismissVideo}
              className="p-2 rounded-full bg-black/40 hover:bg-black/60 text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* Center play/pause indicator on click */}
        <AnimatePresence>
          {!showControls && !isPlaying && !isBuffering && !videoError && (
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
    </>
  );
}
