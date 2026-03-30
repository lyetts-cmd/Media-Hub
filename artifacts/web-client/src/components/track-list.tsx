import React, { useRef, useEffect, useState } from "react";
import { Track } from "@workspace/api-client-react";
import { usePlayer } from "@/hooks/use-player";
import {
  Play, Clock3, Music, Heart, MoreHorizontal, Plus, ListMusic,
} from "lucide-react";
import {
  useLikeTrack,
  useUnlikeTrack,
  useListPlaylists,
  useAddTrackToPlaylist,
  useRemoveTrackFromPlaylist,
  useCreatePlaylist,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

function formatTime(seconds?: number | null) {
  if (!seconds) return "--:--";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

interface TrackListProps {
  tracks: Track[];
  showAlbum?: boolean;
  showArtist?: boolean;
  playlistId?: number;
}

function HeartButton({ track }: { track: Track }) {
  const qc = useQueryClient();
  const likeTrack = useLikeTrack();
  const unlikeTrack = useUnlikeTrack();
  const [optimistic, setOptimistic] = useState<boolean | null>(null);

  const liked = optimistic !== null ? optimistic : (track.liked ?? false);

  function toggle(e: React.MouseEvent) {
    e.stopPropagation();
    const next = !liked;
    setOptimistic(next);
    const mut = next ? likeTrack : unlikeTrack;
    mut.mutate(
      { trackId: track.id },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: ["/api/music/liked"] });
          setOptimistic(null);
        },
        onError: () => setOptimistic(null),
      }
    );
  }

  return (
    <button
      onClick={toggle}
      className={cn(
        "p-1.5 rounded-lg transition-all shrink-0",
        liked
          ? "text-pink-500"
          : "text-transparent group-hover:text-muted-foreground/40 hover:!text-muted-foreground"
      )}
      title={liked ? "Unlike" : "Like"}
    >
      <Heart className={cn("w-4 h-4 transition-all", liked && "fill-current scale-110")} />
    </button>
  );
}

function TrackMenu({
  track,
  playlistId,
}: {
  track: Track;
  playlistId?: number;
}) {
  const [open, setOpen] = useState(false);
  const [showPlaylists, setShowPlaylists] = useState(false);
  const [newName, setNewName] = useState("");
  const [creatingNew, setCreatingNew] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const qc = useQueryClient();

  const { data: playlistsData } = useListPlaylists();
  const addTrack = useAddTrackToPlaylist();
  const removeTrack = useRemoveTrackFromPlaylist();
  const createPlaylist = useCreatePlaylist();

  const playlists = playlistsData?.playlists ?? [];

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
        setShowPlaylists(false);
        setCreatingNew(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  function handleAdd(pid: number) {
    addTrack.mutate(
      { id: pid, data: { trackId: track.id } },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: ["/api/music/playlists"] });
          setOpen(false);
          setShowPlaylists(false);
        },
      }
    );
  }

  function handleRemove(e: React.MouseEvent) {
    e.stopPropagation();
    if (!playlistId) return;
    removeTrack.mutate(
      { id: playlistId, trackId: track.id },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: ["/api/music/playlists"] });
          setOpen(false);
        },
      }
    );
  }

  async function handleCreateNew() {
    if (!newName.trim()) return;
    await createPlaylist.mutateAsync(
      { data: { name: newName.trim(), trackIds: [track.id] } },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: ["/api/music/playlists"] });
          setOpen(false);
          setShowPlaylists(false);
          setCreatingNew(false);
          setNewName("");
        },
      }
    );
  }

  return (
    <div ref={menuRef} className="relative shrink-0" onClick={(e) => e.stopPropagation()}>
      <button
        onClick={() => { setOpen((o) => !o); setShowPlaylists(false); setCreatingNew(false); }}
        className="p-1.5 rounded-lg text-transparent group-hover:text-muted-foreground/40 hover:!text-muted-foreground transition-colors"
        title="More options"
      >
        <MoreHorizontal className="w-4 h-4" />
      </button>

      {open && (
        <div className="absolute right-0 top-8 z-50 min-w-[180px] bg-card border border-border rounded-xl shadow-xl overflow-hidden">
          {showPlaylists ? (
            <div>
              <div className="px-3 py-2 text-xs text-muted-foreground font-semibold border-b border-border/50">
                Add to playlist
              </div>
              <div className="max-h-48 overflow-y-auto">
                {playlists.map((pl) => (
                  <button
                    key={pl.id}
                    onClick={() => handleAdd(pl.id)}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-secondary transition-colors flex items-center gap-2"
                  >
                    <ListMusic className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <span className="truncate">{pl.name}</span>
                  </button>
                ))}
                {creatingNew ? (
                  <div className="px-3 py-2 flex items-center gap-2 border-t border-border/50">
                    <input
                      autoFocus
                      placeholder="Playlist name…"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleCreateNew();
                        if (e.key === "Escape") setCreatingNew(false);
                      }}
                      className="flex-1 bg-transparent outline-none text-sm border-b border-border"
                    />
                    <button
                      onClick={handleCreateNew}
                      className="text-primary text-xs font-semibold"
                    >
                      Create
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setCreatingNew(true)}
                    className="w-full text-left px-3 py-2 text-sm text-muted-foreground hover:bg-secondary transition-colors flex items-center gap-2 border-t border-border/50"
                  >
                    <Plus className="w-3.5 h-3.5 shrink-0" />
                    New playlist
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div>
              <button
                onClick={() => setShowPlaylists(true)}
                className="w-full text-left px-3 py-2.5 text-sm hover:bg-secondary transition-colors flex items-center gap-2"
              >
                <Plus className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                Add to playlist
              </button>
              {playlistId !== undefined && (
                <button
                  onClick={handleRemove}
                  className="w-full text-left px-3 py-2.5 text-sm text-red-400 hover:bg-red-500/10 transition-colors flex items-center gap-2"
                >
                  <Music className="w-3.5 h-3.5 shrink-0" />
                  Remove from playlist
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function TrackList({
  tracks,
  showAlbum = false,
  showArtist = true,
  playlistId,
}: TrackListProps) {
  const { currentTrack, isPlaying, playTrack, togglePlayPause } = usePlayer();

  if (!tracks.length) {
    return (
      <div className="py-12 flex flex-col items-center justify-center text-muted-foreground border border-dashed border-border rounded-xl bg-card/50">
        <Music className="w-12 h-12 mb-4 opacity-20" />
        <p>No tracks found.</p>
      </div>
    );
  }

  const secondaryLabel = showAlbum ? "Album" : showArtist ? "Artist" : null;

  return (
    <div className="w-full">
      <div
        className={cn(
          "grid gap-4 px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b border-border/50 sticky top-0 bg-background/95 backdrop-blur z-10",
          secondaryLabel
            ? "grid-cols-[auto_1fr_minmax(100px,2fr)_auto]"
            : "grid-cols-[auto_1fr_auto]"
        )}
      >
        <div className="w-10 text-center">#</div>
        <div>Title</div>
        {secondaryLabel && <div className="hidden sm:block">{secondaryLabel}</div>}
        <div className="flex justify-end pr-1">
          <Clock3 className="w-4 h-4" />
        </div>
      </div>

      <div className="flex flex-col mt-2 gap-1">
        {tracks.map((track, index) => {
          const isCurrent = currentTrack?.id === track.id;
          const secondaryText = showAlbum
            ? track.albumTitle || "Unknown Album"
            : showArtist
            ? track.artistName || "Unknown Artist"
            : null;

          return (
            <div
              key={track.id}
              onClick={() => {
                if (isCurrent) togglePlayPause();
                else playTrack(track, tracks);
              }}
              className={cn(
                "grid gap-4 px-4 py-3 items-center rounded-lg cursor-pointer transition-all group",
                secondaryLabel
                  ? "grid-cols-[auto_1fr_minmax(100px,2fr)_auto]"
                  : "grid-cols-[auto_1fr_auto]",
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
                  <span className="group-hover:hidden">
                    {track.trackNumber || index + 1}
                  </span>
                )}
                {!isCurrent && (
                  <Play className="w-4 h-4 hidden group-hover:block text-foreground fill-current" />
                )}
              </div>

              <div className="flex flex-col min-w-0">
                <span
                  className={cn(
                    "truncate font-medium",
                    isCurrent ? "text-primary" : "text-foreground"
                  )}
                >
                  {track.title}
                </span>
                {secondaryText && (
                  <span className="text-xs text-muted-foreground sm:hidden truncate">
                    {secondaryText}
                  </span>
                )}
              </div>

              {secondaryText && (
                <div className="hidden sm:block text-sm text-muted-foreground truncate group-hover:text-foreground/80 transition-colors">
                  {secondaryText}
                </div>
              )}

              <div className="flex items-center gap-1 justify-end">
                <HeartButton track={track} />
                <TrackMenu track={track} playlistId={playlistId} />
                <div className="text-sm text-muted-foreground w-10 text-right font-mono">
                  {formatTime(track.durationSeconds)}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
