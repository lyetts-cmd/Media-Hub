import React, { useState } from "react";
import { Link } from "wouter";
import { useListArtists } from "@workspace/api-client-react";
import { Loader2, Search, Mic2 } from "lucide-react";
import { motion } from "framer-motion";

export default function ArtistsPage() {
  const [search, setSearch] = useState("");
  const { data, isLoading } = useListArtists({ search, pageSize: 50 });

  return (
    <div className="p-6 md:p-8 max-w-[1600px] mx-auto min-h-full pb-20">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <h1 className="text-3xl font-display font-bold">Artists</h1>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input 
            type="text" 
            placeholder="Search artists..." 
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
      ) : data?.artists?.length ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6 md:gap-8">
          {data.artists.map((artist, i) => (
            <Link key={artist.id} href={`/artists/${artist.id}`}>
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.05, duration: 0.3 }}
                className="group cursor-pointer flex flex-col items-center gap-4"
              >
                <div className="relative w-32 h-32 md:w-40 md:h-40 rounded-full overflow-hidden shadow-lg border-2 border-border/50 hover:border-primary transition-all duration-300 bg-secondary flex items-center justify-center group-hover:shadow-primary/20 group-hover:shadow-2xl">
                  <Mic2 className="w-12 h-12 text-muted-foreground group-hover:scale-110 transition-transform duration-500" />
                </div>
                <div className="text-center px-2 w-full">
                  <h3 className="font-semibold text-base truncate group-hover:text-primary transition-colors">{artist.name}</h3>
                  <p className="text-xs text-muted-foreground truncate">{artist.albumCount} Albums • {artist.trackCount} Tracks</p>
                </div>
              </motion.div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="text-center py-20 text-muted-foreground">
          <p>No artists found.</p>
        </div>
      )}
    </div>
  );
}
