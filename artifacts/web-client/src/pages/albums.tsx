import React, { useState } from "react";
import { Link, useRoute } from "wouter";
import { useListAlbums, useListLibraries } from "@workspace/api-client-react";
import { getGetAlbumArtUrl } from "@workspace/api-client-react";
import { Loader2, Search } from "lucide-react";
import { motion } from "framer-motion";

export default function AlbumsPage() {
  const [, libParams] = useRoute("/library/:id/albums");
  const libraryId = libParams?.id ? Number(libParams.id) : undefined;

  const [search, setSearch] = useState("");
  const { data, isLoading } = useListAlbums({ search, pageSize: 50, libraryId });
  const { data: libData } = useListLibraries();

  const library = libData?.libraries?.find((l) => l.id === libraryId);
  const heading = library ? `${library.name} — Albums` : "Albums";

  return (
    <div className="p-6 md:p-8 max-w-[1600px] mx-auto min-h-full pb-20">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <h1 className="text-3xl font-display font-bold">{heading}</h1>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input 
            type="text" 
            placeholder="Search albums..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-secondary border border-border rounded-full pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : data?.albums?.length ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
          {data.albums.map((album, i) => (
            <Link key={album.id} href={`/albums/${album.id}`}>
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05, duration: 0.3 }}
                className="group cursor-pointer flex flex-col gap-3"
              >
                <div className="relative aspect-square w-full rounded-xl overflow-hidden shadow-lg border border-border/50 hover-card-fx bg-secondary">
                  <img 
                    src={album.hasArt ? getGetAlbumArtUrl(album.id) : `${import.meta.env.BASE_URL}images/default-art.png`} 
                    alt={album.title}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                    loading="lazy"
                    onError={(e) => { (e.target as HTMLImageElement).src = `${import.meta.env.BASE_URL}images/default-art.png`; }}
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                    <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center shadow-xl shadow-primary/40 transform translate-y-4 group-hover:translate-y-0 transition-transform duration-300">
                      <span className="w-4 h-4 bg-white ml-1" style={{ clipPath: 'polygon(0 0, 0 100%, 100% 50%)' }} />
                    </div>
                  </div>
                </div>
                <div className="flex flex-col px-1">
                  <h3 className="font-semibold text-sm truncate group-hover:text-primary transition-colors">{album.title}</h3>
                  <p className="text-xs text-muted-foreground truncate">{album.artistName || "Unknown Artist"} • {album.year || "Unknown Year"}</p>
                </div>
              </motion.div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="text-center py-20 text-muted-foreground">
          <p>No albums found{libraryId ? " in this library" : ""}.</p>
        </div>
      )}
    </div>
  );
}
