import React from "react";
import { Heart } from "lucide-react";
import { useGetLikedTracks } from "@workspace/api-client-react";
import TrackList from "@/components/track-list";
import { usePlayer } from "@/hooks/use-player";

export default function LikedPage() {
  const { data, isLoading } = useGetLikedTracks();
  const { playTrack } = usePlayer();

  const tracks = data?.tracks ?? [];

  return (
    <div className="px-6 py-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-pink-500 to-red-500 flex items-center justify-center shadow-lg">
            <Heart className="w-7 h-7 text-white fill-white" />
          </div>
          <div>
            <h1 className="text-3xl font-display font-bold">Liked Songs</h1>
            <p className="text-muted-foreground text-sm mt-1">
              {isLoading ? "Loading…" : `${tracks.length} song${tracks.length !== 1 ? "s" : ""}`}
            </p>
          </div>
          {tracks.length > 0 && (
            <button
              onClick={() => playTrack(tracks[0], tracks)}
              className="ml-auto px-5 py-2.5 bg-primary text-white rounded-full text-sm font-semibold hover:bg-primary/90 transition-colors"
            >
              Play All
            </button>
          )}
        </div>

        {isLoading ? (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-14 rounded-lg bg-secondary/50 animate-pulse" />
            ))}
          </div>
        ) : tracks.length === 0 ? (
          <div className="py-20 flex flex-col items-center justify-center text-muted-foreground">
            <Heart className="w-16 h-16 mb-4 opacity-10" />
            <p className="text-lg font-medium">No liked songs yet</p>
            <p className="text-sm mt-1">Click the heart on any track to save it here</p>
          </div>
        ) : (
          <TrackList tracks={tracks} showArtist showAlbum />
        )}
      </div>
    </div>
  );
}
