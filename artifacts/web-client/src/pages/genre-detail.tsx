import React from "react";
import { useParams, Link } from "wouter";
import { useGetGenreTracks } from "@workspace/api-client-react";
import { Loader2, ArrowLeft, Play } from "lucide-react";
import TrackList from "@/components/track-list";
import { usePlayer } from "@/hooks/use-player";

export default function GenreDetail() {
  const { name } = useParams<{ name: string }>();
  const decodedName = decodeURIComponent(name || "");
  const { data, isLoading, error } = useGetGenreTracks(decodedName, { pageSize: 200 });
  const { playTrack } = usePlayer();

  if (isLoading) return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  if (error || !data) return <div className="p-8 text-destructive">Failed to load tracks.</div>;

  const handlePlayAll = () => {
    if (data.tracks.length > 0) {
      playTrack(data.tracks[0], data.tracks);
    }
  };

  const hue = decodedName.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % 360;

  return (
    <div className="relative min-h-full pb-20">
      <div 
        className="absolute top-0 inset-x-0 h-64 overflow-hidden -z-10 opacity-30"
        style={{ background: `linear-gradient(to bottom, hsl(${hue}, 50%, 30%), transparent)` }}
      />
      
      <div className="p-6 md:p-8 max-w-6xl mx-auto">
        <Link href="/genres" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-8 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Genres
        </Link>

        <div className="mb-10 flex items-center justify-between">
          <div>
            <span className="text-xs font-bold uppercase tracking-widest opacity-80" style={{ color: `hsl(${hue}, 80%, 70%)` }}>Genre</span>
            <h1 className="text-4xl md:text-6xl font-display font-bold text-white tracking-tight">
              {decodedName}
            </h1>
            <p className="text-muted-foreground mt-2">{data.total} tracks</p>
          </div>
          
          {data.tracks.length > 0 && (
            <button 
              onClick={handlePlayAll}
              className="w-14 h-14 rounded-full hover:scale-105 transition-all flex items-center justify-center shadow-lg"
              style={{ backgroundColor: `hsl(${hue}, 70%, 50%)` }}
            >
              <Play className="w-6 h-6 text-white fill-current ml-1" />
            </button>
          )}
        </div>

        <div className="bg-card/40 backdrop-blur-sm rounded-2xl border border-border p-2">
          <TrackList tracks={data.tracks} />
        </div>
      </div>
    </div>
  );
}
