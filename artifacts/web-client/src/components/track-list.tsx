import React from "react";
import { Track } from "@workspace/api-client-react";
import { usePlayer } from "@/hooks/use-player";
import { Play, Pause, Clock3, Music } from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

function formatTime(seconds?: number | null) {
  if (!seconds) return "--:--";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function TrackList({ tracks }: { tracks: Track[] }) {
  const { currentTrack, isPlaying, playTrack, togglePlayPause } = usePlayer();

  if (!tracks.length) {
    return (
      <div className="py-12 flex flex-col items-center justify-center text-muted-foreground border border-dashed border-border rounded-xl bg-card/50">
        <Music className="w-12 h-12 mb-4 opacity-20" />
        <p>No tracks found.</p>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="grid grid-cols-[auto_1fr_minmax(100px,2fr)_auto] gap-4 px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b border-border/50 sticky top-0 bg-background/95 backdrop-blur z-10">
        <div className="w-10 text-center">#</div>
        <div>Title</div>
        <div className="hidden sm:block">Artist</div>
        <div className="flex justify-end pr-4"><Clock3 className="w-4 h-4" /></div>
      </div>
      
      <div className="flex flex-col mt-2 gap-1">
        {tracks.map((track, index) => {
          const isCurrent = currentTrack?.id === track.id;
          
          return (
            <div 
              key={track.id}
              onClick={() => {
                if (isCurrent) togglePlayPause();
                else playTrack(track, tracks);
              }}
              className={cn(
                "grid grid-cols-[auto_1fr_minmax(100px,2fr)_auto] gap-4 px-4 py-3 items-center rounded-lg cursor-pointer transition-all group",
                isCurrent ? "bg-primary/10" : "hover:bg-secondary"
              )}
            >
              <div className="w-10 flex justify-center text-sm font-medium text-muted-foreground group-hover:text-foreground">
                {isCurrent && isPlaying ? (
                  <div className="flex items-end gap-0.5 h-4">
                    <div className="w-1 bg-primary animate-[bounce_0.8s_ease-in-out_infinite]" />
                    <div className="w-1 bg-primary animate-[bounce_1.2s_ease-in-out_infinite]" />
                    <div className="w-1 bg-primary animate-[bounce_1s_ease-in-out_infinite]" />
                  </div>
                ) : isCurrent ? (
                  <Play className="w-4 h-4 text-primary fill-current" />
                ) : (
                  <span className="group-hover:hidden">{track.trackNumber || index + 1}</span>
                )}
                {!isCurrent && <Play className="w-4 h-4 hidden group-hover:block text-foreground fill-current" />}
              </div>
              
              <div className="flex flex-col min-w-0">
                <span className={cn("truncate font-medium", isCurrent ? "text-primary" : "text-foreground")}>
                  {track.title}
                </span>
                <span className="text-xs text-muted-foreground sm:hidden truncate">
                  {track.artistName || "Unknown Artist"}
                </span>
              </div>
              
              <div className="hidden sm:block text-sm text-muted-foreground truncate group-hover:text-foreground/80 transition-colors">
                {track.artistName || "Unknown Artist"}
              </div>
              
              <div className="text-sm text-muted-foreground pr-2 font-mono">
                {formatTime(track.durationSeconds)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
