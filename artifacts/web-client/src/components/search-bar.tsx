import React, { useState, useRef, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { Search, Music, Disc3, Mic2, X } from "lucide-react";
import { useSearchMusic, getGetAlbumArtUrl } from "@workspace/api-client-react";
import type { Track, Artist, Album } from "@workspace/api-client-react";
import { usePlayer } from "@/hooks/use-player";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

function useDebounce(value: string, delay: number): string {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export default function SearchBar() {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const debouncedQuery = useDebounce(query, 300);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [, navigate] = useLocation();
  const { playTrack } = usePlayer();

  const { data } = useSearchMusic(
    { q: debouncedQuery },
    { query: { enabled: debouncedQuery.length > 0 } },
  );

  const hasResults =
    debouncedQuery.length > 0 &&
    data &&
    (data.tracks.length > 0 || data.artists.length > 0 || data.albums.length > 0);

  useEffect(() => {
    if (debouncedQuery.length > 0) setIsOpen(true);
    else setIsOpen(false);
  }, [debouncedQuery]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const clear = useCallback(() => {
    setQuery("");
    setIsOpen(false);
    inputRef.current?.focus();
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
    setQuery("");
  }, []);

  const handleTrackClick = useCallback(
    (track: Track) => {
      playTrack(track);
      close();
    },
    [playTrack, close],
  );

  const handleArtistClick = useCallback(
    (artist: Artist) => {
      navigate(`/artists/${artist.id}`);
      close();
    },
    [navigate, close],
  );

  const handleAlbumClick = useCallback(
    (album: Album) => {
      navigate(`/albums/${album.id}`);
      close();
    },
    [navigate, close],
  );

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative flex items-center">
        <Search className="absolute left-3 w-4 h-4 text-muted-foreground pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => { if (debouncedQuery.length > 0) setIsOpen(true); }}
          placeholder="Search music…"
          className="w-full h-9 pl-9 pr-8 bg-secondary/70 border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/60 transition-all"
        />
        {query.length > 0 && (
          <button
            onClick={clear}
            className="absolute right-2 p-0.5 rounded text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {isOpen && (
        <div className="absolute top-full mt-1 left-0 right-0 z-50 bg-card border border-border rounded-xl shadow-2xl shadow-black/40 overflow-hidden max-h-[420px] overflow-y-auto">
          {!hasResults ? (
            <div className="p-4 text-center text-muted-foreground text-sm">
              No results for &ldquo;{debouncedQuery}&rdquo;
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {data!.tracks.length > 0 && (
                <section>
                  <div className="flex items-center gap-2 px-4 pt-3 pb-1.5">
                    <Music className="w-3.5 h-3.5 text-primary" />
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Tracks
                    </span>
                  </div>
                  {data!.tracks.map((track) => (
                    <button
                      key={track.id}
                      onClick={() => handleTrackClick(track)}
                      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-secondary transition-colors text-left"
                    >
                      <div className="w-8 h-8 rounded bg-secondary shrink-0 overflow-hidden flex items-center justify-center">
                        {track.hasArt && track.albumId ? (
                          <img
                            src={getGetAlbumArtUrl(track.albumId)}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <Music className="w-4 h-4 text-muted-foreground" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{track.title}</p>
                        {track.artistName && (
                          <p className="text-xs text-muted-foreground truncate">
                            {track.artistName}
                            {track.albumTitle ? ` · ${track.albumTitle}` : ""}
                          </p>
                        )}
                      </div>
                    </button>
                  ))}
                </section>
              )}

              {data!.artists.length > 0 && (
                <section>
                  <div className="flex items-center gap-2 px-4 pt-3 pb-1.5">
                    <Mic2 className="w-3.5 h-3.5 text-primary" />
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Artists
                    </span>
                  </div>
                  {data!.artists.map((artist) => (
                    <button
                      key={artist.id}
                      onClick={() => handleArtistClick(artist)}
                      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-secondary transition-colors text-left"
                    >
                      <div className="w-8 h-8 rounded-full bg-secondary shrink-0 overflow-hidden flex items-center justify-center">
                        {artist.representativeAlbumId ? (
                          <img
                            src={getGetAlbumArtUrl(artist.representativeAlbumId)}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <Mic2 className="w-4 h-4 text-muted-foreground" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{artist.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {artist.albumCount} album{artist.albumCount !== 1 ? "s" : ""}
                          {" · "}
                          {artist.trackCount} track{artist.trackCount !== 1 ? "s" : ""}
                        </p>
                      </div>
                    </button>
                  ))}
                </section>
              )}

              {data!.albums.length > 0 && (
                <section>
                  <div className="flex items-center gap-2 px-4 pt-3 pb-1.5">
                    <Disc3 className="w-3.5 h-3.5 text-primary" />
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Albums
                    </span>
                  </div>
                  {data!.albums.map((album) => (
                    <button
                      key={album.id}
                      onClick={() => handleAlbumClick(album)}
                      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-secondary transition-colors text-left"
                    >
                      <div className="w-8 h-8 rounded bg-secondary shrink-0 overflow-hidden flex items-center justify-center">
                        {album.hasArt ? (
                          <img
                            src={getGetAlbumArtUrl(album.id)}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <Disc3 className="w-4 h-4 text-muted-foreground" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{album.title}</p>
                        {album.artistName && (
                          <p className="text-xs text-muted-foreground truncate">
                            {album.artistName}
                            {album.year ? ` · ${album.year}` : ""}
                          </p>
                        )}
                      </div>
                    </button>
                  ))}
                </section>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
