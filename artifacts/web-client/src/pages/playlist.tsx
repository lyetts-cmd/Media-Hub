import React, { useState } from "react";
import { useParams, useLocation } from "wouter";
import { ListMusic, Play, Pencil, Trash2, Check, X } from "lucide-react";
import {
  useGetPlaylist,
  useRenamePlaylist,
  useDeletePlaylist,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import TrackList from "@/components/track-list";
import { usePlayer } from "@/hooks/use-player";

function formatDuration(seconds: number | null | undefined) {
  if (!seconds) return "";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h} hr ${m} min`;
  return `${m} min`;
}

export default function PlaylistPage() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const playlistId = Number(id);

  const { data, isLoading } = useGetPlaylist(playlistId);
  const renamePlaylist = useRenamePlaylist();
  const deletePlaylist = useDeletePlaylist();
  const { playTrack } = usePlayer();

  const [editing, setEditing] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const playlist = data;

  function startEdit() {
    setNameInput(playlist?.name ?? "");
    setEditing(true);
  }

  async function saveEdit() {
    if (!nameInput.trim()) return;
    await renamePlaylist.mutateAsync(
      { id: playlistId, data: { name: nameInput.trim() } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ["/api/music/playlists"] });
          queryClient.invalidateQueries({ queryKey: [`/api/music/playlists/${playlistId}`] });
        },
      }
    );
    setEditing(false);
  }

  async function handleDelete() {
    await deletePlaylist.mutateAsync(
      { id: playlistId },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ["/api/music/playlists"] });
          queryClient.invalidateQueries({ queryKey: [`/api/music/playlists/${playlistId}`] });
          navigate("/albums");
        },
      }
    );
  }

  if (isLoading) {
    return (
      <div className="px-6 py-8 max-w-5xl mx-auto">
        <div className="h-14 w-64 bg-secondary/50 rounded-lg animate-pulse mb-4" />
        <div className="flex flex-col gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-14 rounded-lg bg-secondary/50 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!playlist) {
    return (
      <div className="px-6 py-20 flex flex-col items-center text-muted-foreground">
        <ListMusic className="w-16 h-16 mb-4 opacity-10" />
        <p className="text-lg">Playlist not found</p>
      </div>
    );
  }

  const coverAlbumId = playlist.coverAlbumId;

  return (
    <div className="px-6 py-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          {/* Cover */}
          <div className="w-20 h-20 rounded-2xl overflow-hidden bg-secondary shrink-0 shadow-lg">
            {coverAlbumId ? (
              <img
                src={`/api/music/art/${coverAlbumId}`}
                alt="Playlist cover"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <ListMusic className="w-8 h-8 text-muted-foreground opacity-50" />
              </div>
            )}
          </div>

          {/* Name + meta */}
          <div className="flex-1 min-w-0">
            {editing ? (
              <div className="flex items-center gap-2">
                <input
                  autoFocus
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveEdit();
                    if (e.key === "Escape") setEditing(false);
                  }}
                  className="text-2xl font-display font-bold bg-transparent border-b border-primary outline-none text-foreground w-full max-w-sm"
                />
                <button onClick={saveEdit} className="text-primary hover:opacity-80">
                  <Check className="w-5 h-5" />
                </button>
                <button onClick={() => setEditing(false)} className="text-muted-foreground hover:opacity-80">
                  <X className="w-5 h-5" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 group">
                <h1 className="text-3xl font-display font-bold truncate">{playlist.name}</h1>
                <button
                  onClick={startEdit}
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
                >
                  <Pencil className="w-4 h-4" />
                </button>
              </div>
            )}
            <p className="text-muted-foreground text-sm mt-1">
              {playlist.trackCount} song{playlist.trackCount !== 1 ? "s" : ""}
              {playlist.totalDuration ? ` · ${formatDuration(playlist.totalDuration)}` : ""}
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 shrink-0">
            {playlist.tracks.length > 0 && (
              <button
                onClick={() => playTrack(playlist.tracks[0], playlist.tracks)}
                className="px-5 py-2.5 bg-primary text-white rounded-full text-sm font-semibold hover:bg-primary/90 transition-colors"
              >
                <Play className="w-4 h-4 inline-block mr-1 fill-white" />
                Play All
              </button>
            )}
            {confirmDelete ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Delete?</span>
                <button
                  onClick={handleDelete}
                  className="text-red-500 hover:text-red-400 text-xs font-semibold"
                >
                  Yes
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="text-muted-foreground hover:text-foreground text-xs"
                >
                  No
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmDelete(true)}
                className="p-2 rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors"
                title="Delete playlist"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {playlist.tracks.length === 0 ? (
          <div className="py-16 flex flex-col items-center text-muted-foreground">
            <ListMusic className="w-12 h-12 mb-3 opacity-10" />
            <p>No tracks yet</p>
            <p className="text-xs mt-1">Use the ··· menu on any track to add it here</p>
          </div>
        ) : (
          <TrackList
            tracks={playlist.tracks}
            showArtist
            showAlbum
            playlistId={playlistId}
          />
        )}
      </div>
    </div>
  );
}
