import React from "react";
import { usePlayer } from "@/hooks/use-player";
import { getGetAlbumArtUrl } from "@workspace/api-client-react";
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, ListMusic } from "lucide-react";

function formatTime(seconds: number) {
  if (isNaN(seconds)) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function Player() {
  const { 
    currentTrack, isPlaying, currentTime, duration, volume,
    togglePlayPause, prev, next, seek, setVolume 
  } = usePlayer();

  if (!currentTrack) {
    return (
      <div className="fixed bottom-0 left-0 right-0 h-24 glass-panel z-50 flex items-center justify-center md:pl-64">
        <div className="text-muted-foreground flex items-center gap-2 font-medium">
          <ListMusic className="w-5 h-5" />
          No track playing
        </div>
      </div>
    );
  }

  const artUrl = currentTrack.albumId 
    ? getGetAlbumArtUrl(currentTrack.albumId)
    : `${import.meta.env.BASE_URL}images/default-art.png`;

  return (
    <div className="fixed bottom-0 md:left-64 left-0 right-0 h-24 glass-panel z-50 flex items-center px-4 md:px-6 justify-between animate-in slide-in-from-bottom-5">
      {/* Now Playing Info */}
      <div className="flex items-center gap-4 w-1/3 min-w-0">
        <div className="relative group overflow-hidden rounded-md shadow-md shrink-0 w-14 h-14 md:w-16 md:h-16">
          <img 
            src={artUrl} 
            alt={currentTrack.albumTitle || "Album Art"} 
            className="w-full h-full object-cover"
            onError={(e) => { (e.target as HTMLImageElement).src = `${import.meta.env.BASE_URL}images/default-art.png`; }}
          />
        </div>
        <div className="flex flex-col min-w-0 overflow-hidden">
          <span className="font-semibold text-foreground truncate text-sm md:text-base">
            {currentTrack.title}
          </span>
          <span className="text-xs md:text-sm text-muted-foreground truncate">
            {currentTrack.artistName || "Unknown Artist"}
          </span>
          {currentTrack.albumTitle && (
            <span className="text-xs text-muted-foreground/70 truncate hidden md:block">
              {currentTrack.albumTitle}
            </span>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-col items-center justify-center flex-1 max-w-2xl px-4">
        <div className="flex items-center gap-6 mb-2">
          <button onClick={prev} className="text-muted-foreground hover:text-foreground transition-colors">
            <SkipBack className="w-5 h-5 fill-current" />
          </button>
          <button 
            onClick={togglePlayPause} 
            className="w-10 h-10 flex items-center justify-center bg-foreground text-background rounded-full hover:scale-105 transition-all shadow-lg hover:shadow-white/20 active:scale-95"
          >
            {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-1" />}
          </button>
          <button onClick={next} className="text-muted-foreground hover:text-foreground transition-colors">
            <SkipForward className="w-5 h-5 fill-current" />
          </button>
        </div>
        
        <div className="flex items-center w-full gap-3 text-xs font-medium text-muted-foreground">
          <span className="w-10 text-right">{formatTime(currentTime)}</span>
          <div className="relative flex-1 group flex items-center">
            <input 
              type="range" 
              min={0} 
              max={duration || 100} 
              value={currentTime}
              onChange={(e) => seek(Number(e.target.value))}
              className="player-slider relative z-10 w-full bg-transparent"
            />
            {/* Visual Progress Bar */}
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

      {/* Right Controls */}
      <div className="hidden md:flex items-center justify-end w-1/3 gap-3">
        <button onClick={() => setVolume(volume === 0 ? 1 : 0)} className="text-muted-foreground hover:text-foreground">
          {volume === 0 ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
        </button>
        <div className="w-24 flex items-center relative group">
          <input 
            type="range" 
            min={0} 
            max={1} 
            step={0.01} 
            value={volume}
            onChange={(e) => setVolume(Number(e.target.value))}
            className="player-slider relative z-10 w-full bg-transparent"
          />
          <div className="absolute left-0 h-1.5 bg-secondary rounded-full w-full pointer-events-none overflow-hidden">
            <div 
              className="h-full bg-foreground/80 transition-colors" 
              style={{ width: `${volume * 100}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
