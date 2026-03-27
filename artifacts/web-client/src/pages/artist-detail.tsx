import React from "react";
import { useParams, Link } from "wouter";
import { useGetArtist, useGetArtistAlbums, getGetAlbumArtUrl } from "@workspace/api-client-react";
import { Loader2, ArrowLeft, Mic2 } from "lucide-react";
import { motion } from "framer-motion";

export default function ArtistDetail() {
  const { id } = useParams<{ id: string }>();
  const { data: artist, isLoading: artistLoading } = useGetArtist(Number(id));
  const { data: albumsData, isLoading: albumsLoading } = useGetArtistAlbums(Number(id));

  const isLoading = artistLoading || albumsLoading;

  if (isLoading) return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  if (!artist) return <div className="p-8 text-destructive">Failed to load artist.</div>;

  return (
    <div className="relative min-h-full pb-20">
      <div className="p-6 md:p-8 max-w-7xl mx-auto">
        <Link href="/artists" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-8 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Artists
        </Link>

        <div className="flex flex-col md:flex-row gap-6 items-center md:items-end mb-12 pb-8 border-b border-border/50">
          <div className="w-40 h-40 rounded-full overflow-hidden shadow-2xl border-4 border-card bg-secondary flex items-center justify-center relative">
            <div className="absolute inset-0 bg-gradient-to-tr from-primary/40 to-transparent mix-blend-overlay" />
            <Mic2 className="w-16 h-16 text-muted-foreground" />
          </div>
          
          <div className="flex flex-col text-center md:text-left">
            <span className="text-xs font-bold uppercase tracking-widest text-primary mb-1">Artist</span>
            <h1 className="text-4xl md:text-6xl font-display font-bold text-white tracking-tight">
              {artist.name}
            </h1>
            <p className="text-muted-foreground mt-2">
              {artist.albumCount} Albums • {artist.trackCount} Tracks
            </p>
          </div>
        </div>

        <h2 className="text-2xl font-display font-bold mb-6">Discography</h2>
        
        {albumsData?.albums?.length ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
            {albumsData.albums.map((album, i) => (
              <Link key={album.id} href={`/albums/${album.id}`}>
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05, duration: 0.3 }}
                  className="group cursor-pointer flex flex-col gap-3"
                >
                  <div className="relative aspect-square w-full rounded-xl overflow-hidden shadow-lg border border-border/50 hover-card-fx bg-secondary">
                    <img 
                      src={album.hasArt ? getGetAlbumArtUrl(album.id) : `${import.meta.env.BASE_URL}images/default-art.png`} 
                      alt={album.title}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      onError={(e) => { (e.target as HTMLImageElement).src = `${import.meta.env.BASE_URL}images/default-art.png`; }}
                    />
                  </div>
                  <div className="flex flex-col px-1">
                    <h3 className="font-semibold text-sm truncate group-hover:text-primary transition-colors">{album.title}</h3>
                    <p className="text-xs text-muted-foreground truncate">{album.year || "Unknown Year"}</p>
                  </div>
                </motion.div>
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground">No albums found.</p>
        )}
      </div>
    </div>
  );
}
