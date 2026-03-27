import React from "react";
import { Link } from "wouter";
import { useListGenres } from "@workspace/api-client-react";
import { Loader2, Music2 } from "lucide-react";
import { motion } from "framer-motion";

export default function GenresPage() {
  const { data, isLoading } = useListGenres();

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto min-h-full pb-20">
      <h1 className="text-3xl font-display font-bold mb-8">Genres</h1>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : data?.genres?.length ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
          {data.genres.map((genre, i) => {
            // Generate a deterministic color based on genre name
            const hue = genre.name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % 360;
            
            return (
              <Link key={genre.name} href={`/genres/${encodeURIComponent(genre.name)}`}>
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.05, duration: 0.3 }}
                  className="group cursor-pointer aspect-square rounded-2xl overflow-hidden shadow-lg hover:-translate-y-1 hover:shadow-xl transition-all duration-300 relative flex flex-col items-center justify-center p-6 border border-border"
                  style={{ backgroundColor: `hsl(${hue}, 40%, 15%)` }}
                >
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                  <Music2 className="w-12 h-12 text-white/50 mb-2 relative z-10 group-hover:scale-110 transition-transform group-hover:text-white" />
                  <h3 className="font-bold text-lg text-white text-center relative z-10 break-words line-clamp-2">
                    {genre.name}
                  </h3>
                  <p className="text-xs text-white/70 relative z-10 mt-1">{genre.trackCount} tracks</p>
                </motion.div>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-20 text-muted-foreground">
          <p>No genres found.</p>
        </div>
      )}
    </div>
  );
}
