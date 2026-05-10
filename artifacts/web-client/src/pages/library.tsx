import React from "react";
import { Link, useRoute } from "wouter";
import { useListLibraries } from "@workspace/api-client-react";
import { Mic2, Disc3, Music2, FolderTree, Film, Folder, Loader2 } from "lucide-react";
import { motion } from "framer-motion";

interface BrowseTile {
  label: string;
  icon: React.ElementType;
  href: string;
  description: string;
}

export default function LibraryPage() {
  const [, params] = useRoute("/library/:id");
  const libraryId = params?.id ? Number(params.id) : null;
  const { data, isLoading } = useListLibraries();

  const library = data?.libraries?.find((l) => l.id === libraryId);

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!library) {
    return (
      <div className="p-6 md:p-8 max-w-4xl mx-auto min-h-full pb-20">
        <h1 className="text-3xl font-display font-bold mb-4">Library not found</h1>
        <Link href="/" className="text-primary hover:underline">Go home</Link>
      </div>
    );
  }

  const isVideo = library.type === "video";
  const base = `/library/${library.id}`;

  const musicTiles: BrowseTile[] = [
    { label: "Artists", icon: Mic2, href: `${base}/artists`, description: "Browse by artist" },
    { label: "Albums", icon: Disc3, href: `${base}/albums`, description: "Browse by album" },
    { label: "Genres", icon: Music2, href: `${base}/genres`, description: "Browse by genre" },
    { label: "Folders", icon: FolderTree, href: `${base}/browse`, description: "Browse by folder" },
  ];

  const videoTiles: BrowseTile[] = [
    { label: "Genres", icon: Film, href: `${base}/video-genres`, description: "Browse by genre" },
    { label: "Folders", icon: Folder, href: `${base}/video-folder`, description: "Browse by folder" },
  ];

  const tiles = isVideo ? videoTiles : musicTiles;

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto min-h-full pb-20">
      <div className="mb-10">
        <div className="flex items-center gap-3 mb-2">
          <div
            className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
              isVideo
                ? "bg-violet-500/15 text-violet-400"
                : "bg-primary/15 text-primary"
            }`}
          >
            {isVideo ? "Video" : "Music"}
          </div>
        </div>
        <h1 className="text-4xl font-display font-bold">{library.name}</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          <code className="bg-secondary px-2 py-0.5 rounded text-xs">{library.path}</code>
        </p>
      </div>

      <div className={`grid gap-4 ${isVideo ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-2 sm:grid-cols-2 md:grid-cols-4"}`}>
        {tiles.map((tile, i) => (
          <Link key={tile.label} href={tile.href}>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.07, duration: 0.3 }}
              className="group flex flex-col items-center justify-center gap-4 aspect-square rounded-2xl border border-border bg-card hover:bg-secondary hover:border-primary/30 transition-all duration-300 cursor-pointer shadow-sm hover:shadow-lg hover:shadow-primary/5 hover:-translate-y-1 p-6"
            >
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                <tile.icon className="w-8 h-8 text-primary" />
              </div>
              <div className="text-center">
                <h3 className="font-bold text-lg">{tile.label}</h3>
                <p className="text-xs text-muted-foreground mt-0.5">{tile.description}</p>
              </div>
            </motion.div>
          </Link>
        ))}
      </div>
    </div>
  );
}
