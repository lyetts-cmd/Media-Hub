import React, { useState } from "react";
import { useRoute } from "wouter";
import { useListVideos, useListLibraries, TranscodingStatus } from "@workspace/api-client-react";
import { Loader2, Search, Film, Play, Zap } from "lucide-react";
import { motion } from "framer-motion";
import { usePlayer } from "@/hooks/use-player";

function formatDuration(s: number | null | undefined): string {
  if (!s) return "";
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

function TranscodingBadge({ status }: { status: TranscodingStatus }) {
  if (status === TranscodingStatus.none) {
    return (
      <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/15 text-emerald-400">
        Native
      </span>
    );
  }
  if (status === TranscodingStatus.done) {
    return (
      <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-500/15 text-amber-400 flex items-center gap-0.5">
        <Zap className="w-2.5 h-2.5" /> Transcoded
      </span>
    );
  }
  if (status === TranscodingStatus.processing) {
    return (
      <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-500/15 text-blue-400 flex items-center gap-0.5">
        <Zap className="w-2.5 h-2.5 animate-pulse" /> Transcoding…
      </span>
    );
  }
  if (status === TranscodingStatus.pending) {
    return (
      <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-muted text-muted-foreground">
        Pending
      </span>
    );
  }
  return null;
}

export default function VideoListPage() {
  const [, params] = useRoute("/library/:id/videos");
  const [, genreParams] = useRoute("/video-genres/:genre");

  const libraryId = params?.id ? Number(params.id) : undefined;

  const genreFromRoute = genreParams?.genre ? decodeURIComponent(genreParams.genre) : undefined;
  const genreFromQuery = typeof window !== "undefined"
    ? new URLSearchParams(window.location.search).get("genre") ?? undefined
    : undefined;
  const genre = genreFromRoute ?? genreFromQuery;

  const [search, setSearch] = useState("");
  const { data, isLoading } = useListVideos({ libraryId, genre, search: search || undefined, pageSize: 50 });
  const { data: libData } = useListLibraries();
  const { playVideo } = usePlayer();

  const library = libData?.libraries?.find((l) => l.id === libraryId);
  const heading = genre && library
    ? `${library.name} — ${genre}`
    : genre
    ? `${genre} Videos`
    : library
    ? library.name
    : "All Videos";

  return (
    <div className="p-6 md:p-8 max-w-[1600px] mx-auto min-h-full pb-20">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <h1 className="text-3xl font-display font-bold">{heading}</h1>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search videos..."
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
      ) : data?.videos?.length ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5">
          {data.videos.map((video, i) => (
            <motion.div
              key={video.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04, duration: 0.3 }}
              onClick={() => playVideo(video)}
              className="group cursor-pointer flex flex-col gap-2"
            >
              <div className="relative aspect-video w-full rounded-xl overflow-hidden bg-secondary border border-border/50 shadow-md hover-card-fx">
                <div className="absolute inset-0 flex items-center justify-center">
                  <Film className="w-12 h-12 text-muted-foreground/30" />
                </div>
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                  <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center shadow-xl shadow-primary/40 transform translate-y-2 group-hover:translate-y-0 transition-transform duration-300">
                    <Play className="w-5 h-5 text-white fill-current ml-0.5" />
                  </div>
                </div>
                {video.durationSeconds && (
                  <div className="absolute bottom-2 right-2 bg-black/70 text-white text-[10px] font-medium px-1.5 py-0.5 rounded">
                    {formatDuration(video.durationSeconds)}
                  </div>
                )}
              </div>
              <div className="flex flex-col px-1 gap-1">
                <h3 className="font-semibold text-sm truncate group-hover:text-primary transition-colors">
                  {video.title}
                </h3>
                <div className="flex items-center gap-2 flex-wrap">
                  {video.genre && (
                    <span className="text-xs text-muted-foreground">{video.genre}</span>
                  )}
                  {video.year && (
                    <span className="text-xs text-muted-foreground">• {video.year}</span>
                  )}
                  <TranscodingBadge status={video.transcodingStatus} />
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="text-center py-20 text-muted-foreground">
          <Film className="w-12 h-12 mx-auto mb-3 opacity-20" />
          <p>No videos found.</p>
        </div>
      )}
    </div>
  );
}
