import React from "react";
import { useParams, Link } from "wouter";
import { useGetAlbum, getGetAlbumArtUrl } from "@workspace/api-client-react";
import { Loader2, Play, ArrowLeft } from "lucide-react";
import TrackList from "@/components/track-list";
import { usePlayer } from "@/hooks/use-player";

export default function AlbumDetail() {
  const { id } = useParams<{ id: string }>();
  const { data: album, isLoading, error } = useGetAlbum(Number(id));
  const { playTrack } = usePlayer();

  if (isLoading) return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  if (error || !album) return <div className="p-8 text-destructive">Failed to load album.</div>;

  const handlePlayAll = () => {
    if (album.tracks.length > 0) {
      playTrack(album.tracks[0], album.tracks);
    }
  };

  return (
    <div className="relative min-h-full pb-20">
      {/* Background blur effect */}
      <div className="absolute top-0 inset-x-0 h-[400px] overflow-hidden -z-10 opacity-30 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/20 via-background/80 to-background z-10" />
        <img 
          src={album.hasArt ? getGetAlbumArtUrl(album.id) : `${import.meta.env.BASE_URL}images/default-art.png`}
          alt="blur"
          className="w-full h-full object-cover blur-3xl scale-125 saturate-150"
        />
      </div>

      <div className="p-6 md:p-8 max-w-6xl mx-auto">
        <Link href="/albums" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-8 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Albums
        </Link>

        <div className="flex flex-col md:flex-row gap-8 items-end mb-10">
          <div className="w-48 h-48 md:w-64 md:h-64 shrink-0 rounded-2xl overflow-hidden shadow-2xl shadow-black/50 border border-white/10">
            <img 
              src={album.hasArt ? getGetAlbumArtUrl(album.id) : `${import.meta.env.BASE_URL}images/default-art.png`} 
              alt={album.title}
              className="w-full h-full object-cover"
            />
          </div>
          
          <div className="flex flex-col gap-2">
            <span className="text-xs font-bold uppercase tracking-widest text-primary">Album</span>
            <h1 className="text-4xl md:text-6xl font-display font-bold text-white tracking-tight leading-tight">
              {album.title}
            </h1>
            <div className="flex items-center gap-2 text-sm md:text-base text-muted-foreground mt-2">
              <Link href={`/artists/${album.artistId}`} className="font-semibold text-white hover:underline">
                {album.artistName || "Unknown Artist"}
              </Link>
              <span>•</span>
              <span>{album.year || "Unknown Year"}</span>
              <span>•</span>
              <span>{album.trackCount} tracks</span>
            </div>
            
            <div className="mt-6 flex items-center gap-4">
              <button 
                onClick={handlePlayAll}
                className="w-14 h-14 rounded-full bg-primary hover:bg-primary/90 hover:scale-105 transition-all flex items-center justify-center shadow-lg shadow-primary/30"
              >
                <Play className="w-6 h-6 text-white fill-current ml-1" />
              </button>
            </div>
          </div>
        </div>

        <div className="mt-8 bg-card/40 backdrop-blur-sm rounded-2xl border border-border p-2">
          <TrackList tracks={album.tracks} />
        </div>
      </div>
    </div>
  );
}
