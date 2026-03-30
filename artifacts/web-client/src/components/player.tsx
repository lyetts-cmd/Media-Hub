import React from "react";
import { usePlayer } from "@/hooks/use-player";
import { getGetAlbumArtUrl } from "@workspace/api-client-react";
import {
  Play, Pause, SkipBack, SkipForward, Volume2, VolumeX,
  ListMusic, Shuffle, Repeat, Repeat1, ChevronUp,
} from "lucide-react";
import PlayerExpanded from "./player-expanded";

function formatTime(s: number) {
  if (!isFinite(s)) return "0:00";
  const m = Math.floor(s / 60);
  return `${m}:${Math.floor(s % 60).toString().padStart(2, "0")}`;
}

export default function Player() {
  const {
    currentTrack, isPlaying, currentTime, duration, volume,
    shuffle, shuffleMode, repeat,
    togglePlayPause, prev, next, seek, setVolume,
    cycleShuffleMode, cycleRepeat,
    isExpanded, setIsExpanded,
  } = usePlayer();

  const artUrl = currentTrack?.albumId
    ? getGetAlbumArtUrl(currentTrack.albumId)
    : `${import.meta.env.BASE_URL}images/default-art.png`;

  return (
    <>
      {/* Expanded player overlay */}
      <PlayerExpanded />

      {/* Mini bar */}
      <div className="fixed bottom-0 left-0 right-0 h-24 glass-panel z-50 flex items-center px-4 md:px-6 justify-between md:pl-[calc(16rem+1.5rem)]">
        {!currentTrack ? (
          <div className="flex-1 flex items-center justify-center text-muted-foreground gap-2 font-medium">
            <ListMusic className="w-5 h-5" />
            No track playing
          </div>
        ) : (
          <>
            {/* Left: art + info (clickable → expand) */}
            <button
              onClick={() => setIsExpanded(true)}
              className="flex items-center gap-3 w-1/3 min-w-0 group text-left"
              title="Open full player"
            >
              <div className="relative shrink-0 w-14 h-14 rounded-md overflow-hidden shadow-md">
                <img
                  src={artUrl}
                  alt={currentTrack.albumTitle || "Album Art"}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  onError={e => { (e.target as HTMLImageElement).src = `${import.meta.env.BASE_URL}images/default-art.png`; }}
                />
              </div>
              <div className="flex flex-col min-w-0 overflow-hidden">
                <span className="font-semibold text-foreground truncate text-sm group-hover:text-primary transition-colors">
                  {currentTrack.title}
                </span>
                <span className="text-xs text-muted-foreground truncate">
                  {currentTrack.artistName || "Unknown Artist"}
                </span>
                {currentTrack.albumTitle && (
                  <span className="text-xs text-muted-foreground/60 truncate hidden md:block">
                    {currentTrack.albumTitle}
                  </span>
                )}
              </div>
              <ChevronUp className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0 hidden md:block" />
            </button>

            {/* Centre: controls + progress */}
            <div className="flex flex-col items-center justify-center flex-1 max-w-2xl px-4">
              <div className="flex items-center gap-5 mb-2">
                <button onClick={e => { e.stopPropagation(); prev(); }} className="text-muted-foreground hover:text-foreground transition-colors">
                  <SkipBack className="w-5 h-5 fill-current" />
                </button>
                <button
                  onClick={e => { e.stopPropagation(); togglePlayPause(); }}
                  className="w-10 h-10 flex items-center justify-center bg-foreground text-background rounded-full hover:scale-105 transition-all shadow-lg active:scale-95"
                >
                  {isPlaying
                    ? <Pause className="w-5 h-5 fill-current" />
                    : <Play  className="w-5 h-5 fill-current ml-0.5" />}
                </button>
                <button onClick={e => { e.stopPropagation(); next(); }} className="text-muted-foreground hover:text-foreground transition-colors">
                  <SkipForward className="w-5 h-5 fill-current" />
                </button>
              </div>

              <div className="flex items-center w-full gap-3 text-xs font-medium text-muted-foreground">
                <span className="w-10 text-right">{formatTime(currentTime)}</span>
                <div className="relative flex-1 group flex items-center">
                  <input
                    type="range" min={0} max={duration || 100} value={currentTime}
                    onChange={e => { e.stopPropagation(); seek(Number(e.target.value)); }}
                    className="player-slider relative z-10 w-full bg-transparent"
                    onClick={e => e.stopPropagation()}
                  />
                  <div className="absolute left-0 h-1.5 bg-secondary rounded-full w-full pointer-events-none overflow-hidden">
                    <div
                      className="h-full bg-primary/80 group-hover:bg-primary transition-colors"
                      style={{ width: `${(currentTime / (duration || 1)) * 100}%` }}
                    />
                  </div>
                </div>
                <span className="w-10">{formatTime(duration)}</span>
              </div>
            </div>

            {/* Right: shuffle, repeat, volume */}
            <div className="hidden md:flex items-center justify-end w-1/3 gap-2">
              {/* Shuffle mode indicator */}
              <button
                onClick={e => { e.stopPropagation(); cycleShuffleMode(); }}
                className={`relative p-1 transition-colors ${shuffle ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}
                title={shuffleMode === "off" ? "Shuffle off" : shuffleMode === "normal" ? "Normal shuffle" : "Smart shuffle (no repeats)"}
              >
                <Shuffle className="w-4 h-4" />
                {shuffleMode === "smart" && (
                  <span className="absolute -top-0.5 -right-0.5 text-[8px] font-bold text-primary leading-none">S</span>
                )}
              </button>
              {/* Repeat mode indicator */}
              <button
                onClick={e => { e.stopPropagation(); cycleRepeat(); }}
                className={`p-1 transition-colors ${repeat !== "off" ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}
                title={repeat === "off" ? "No repeat" : repeat === "one" ? "Repeat one" : "Repeat all"}
              >
                {repeat === "one" ? <Repeat1 className="w-4 h-4" /> : <Repeat className="w-4 h-4" />}
              </button>
              <div className="w-px h-4 bg-border/40 mx-1" />
              <button
                onClick={e => { e.stopPropagation(); setVolume(volume === 0 ? 1 : 0); }}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                {volume === 0 ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
              </button>
              <div className="w-24 flex items-center relative group">
                <input
                  type="range" min={0} max={1} step={0.01} value={volume}
                  onChange={e => { e.stopPropagation(); setVolume(Number(e.target.value)); }}
                  className="player-slider relative z-10 w-full bg-transparent"
                  onClick={e => e.stopPropagation()}
                />
                <div className="absolute left-0 h-1.5 bg-secondary rounded-full w-full pointer-events-none overflow-hidden">
                  <div className="h-full bg-foreground/80" style={{ width: `${volume * 100}%` }} />
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
