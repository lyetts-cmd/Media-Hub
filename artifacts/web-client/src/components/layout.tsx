import React, { useState } from "react";
import { Link, useLocation } from "wouter";
import {
  Library, Music2, Disc3, Mic2, FolderTree, Settings, Heart, ListMusic, Plus,
  Film, Folder, ChevronRight, ChevronDown,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Player from "./player";
import SearchBar from "./search-bar";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { useListPlaylists, useCreatePlaylist, useListLibraries, LibraryType } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

function NavLink({
  href,
  icon: Icon,
  label,
  active,
  indent = false,
}: {
  href: string;
  icon: React.ElementType;
  label: string;
  active: boolean;
  indent?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200",
        indent ? "pl-8" : "",
        active
          ? "bg-primary/10 text-primary"
          : "text-muted-foreground hover:bg-secondary hover:text-foreground"
      )}
    >
      <Icon className={cn("w-5 h-5 shrink-0", active ? "text-primary" : "text-muted-foreground")} />
      <span className="truncate">{label}</span>
    </Link>
  );
}

function AllMusicSection() {
  const [location] = useLocation();
  const [open, setOpen] = useState(true);

  const items = [
    { href: "/albums", label: "Albums", icon: Disc3 },
    { href: "/artists", label: "Artists", icon: Mic2 },
    { href: "/genres", label: "Genres", icon: Music2 },
    { href: "/browse", label: "Browse Files", icon: FolderTree },
  ];

  const isActive = items.some((i) => location.startsWith(i.href));

  return (
    <div className="mb-1">
      <button
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold transition-colors",
          isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
        )}
      >
        <Music2 className="w-4 h-4 shrink-0" />
        <span className="flex-1 text-left truncate">All Music</span>
        {open ? (
          <ChevronDown className="w-3.5 h-3.5 shrink-0" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5 shrink-0" />
        )}
      </button>
      {open && (
        <div className="mt-0.5 space-y-0.5">
          {items.map((item) => (
            <NavLink
              key={item.href}
              href={item.href}
              icon={item.icon}
              label={item.label}
              active={location.startsWith(item.href)}
              indent
            />
          ))}
        </div>
      )}
    </div>
  );
}

function AllVideosSection() {
  const [location] = useLocation();
  const [open, setOpen] = useState(true);

  const items = [
    { href: "/videos", label: "All Videos", icon: Film },
    { href: "/video-genres", label: "Genres", icon: Film },
    { href: "/video-folder", label: "Browse Files", icon: Folder },
  ];

  const isActive = items.some((i) => location.startsWith(i.href));

  return (
    <div className="mb-1">
      <button
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold transition-colors",
          isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
        )}
      >
        <Film className="w-4 h-4 shrink-0" />
        <span className="flex-1 text-left truncate">All Videos</span>
        {open ? (
          <ChevronDown className="w-3.5 h-3.5 shrink-0" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5 shrink-0" />
        )}
      </button>
      {open && (
        <div className="mt-0.5 space-y-0.5">
          {items.map((item) => (
            <NavLink
              key={item.href}
              href={item.href}
              icon={item.icon}
              label={item.label}
              active={location.startsWith(item.href)}
              indent
            />
          ))}
        </div>
      )}
    </div>
  );
}

function LibrariesSection() {
  const [location] = useLocation();
  const { data } = useListLibraries();
  const libraries = data?.libraries ?? [];

  const musicLibs = libraries.filter((l) => l.type === LibraryType.music);
  const videoLibs = libraries.filter((l) => l.type === LibraryType.video);

  if (libraries.length === 0) return null;

  return (
    <>
      {musicLibs.length > 0 && (
        <div className="mb-3">
          <h3 className="text-[10px] uppercase tracking-widest text-muted-foreground/60 font-semibold px-3 mb-1">
            Music
          </h3>
          {musicLibs.map((lib) => (
            <NavLink
              key={lib.id}
              href={`/library/${lib.id}`}
              icon={Music2}
              label={lib.name}
              active={location.startsWith(`/library/${lib.id}`)}
            />
          ))}
        </div>
      )}
      {videoLibs.length > 0 && (
        <div className="mb-3">
          <h3 className="text-[10px] uppercase tracking-widest text-muted-foreground/60 font-semibold px-3 mb-1">
            Video
          </h3>
          {videoLibs.map((lib) => (
            <NavLink
              key={lib.id}
              href={`/library/${lib.id}`}
              icon={Film}
              label={lib.name}
              active={location.startsWith(`/library/${lib.id}`)}
            />
          ))}
        </div>
      )}
    </>
  );
}

function PlaylistsSidebar() {
  const [location] = useLocation();
  const qc = useQueryClient();
  const { data } = useListPlaylists();
  const createPlaylist = useCreatePlaylist();
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");

  const playlists = data?.playlists ?? [];

  async function handleCreate() {
    if (!newName.trim()) { setCreating(false); return; }
    const result = await createPlaylist.mutateAsync(
      { data: { name: newName.trim() } },
      { onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/music/playlists"] }) }
    );
    setNewName("");
    setCreating(false);
    if (result?.id) {
      window.location.href = `/playlists/${result.id}`;
    }
  }

  return (
    <div className="mt-2">
      <div className="flex items-center justify-between px-3 mb-2">
        <h2 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
          Playlists
        </h2>
        <button
          onClick={() => { setCreating(true); setNewName(""); }}
          className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          title="New playlist"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>

      <NavLink
        href="/liked"
        icon={Heart}
        label="Liked Songs"
        active={location.startsWith("/liked")}
      />

      {playlists.map((pl) => (
        <NavLink
          key={pl.id}
          href={`/playlists/${pl.id}`}
          icon={ListMusic}
          label={pl.name}
          active={location.startsWith(`/playlists/${pl.id}`)}
        />
      ))}

      {creating && (
        <div className="flex items-center gap-2 px-3 py-2">
          <ListMusic className="w-4 h-4 text-muted-foreground shrink-0" />
          <input
            autoFocus
            placeholder="Playlist name…"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCreate();
              if (e.key === "Escape") setCreating(false);
            }}
            onBlur={() => { if (!newName.trim()) setCreating(false); }}
            className="flex-1 bg-transparent text-sm outline-none border-b border-border/70 focus:border-primary transition-colors"
          />
        </div>
      )}
    </div>
  );
}

function useActiveLibraryType() {
  const [location] = useLocation();
  const { data } = useListLibraries();
  const libraries = data?.libraries ?? [];

  const match = location.match(/^\/library\/(\d+)/);
  if (!match) return null;

  const libId = parseInt(match[1], 10);
  const lib = libraries.find((l) => l.id === libId);
  return lib?.type ?? null;
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const activeLibraryType = useActiveLibraryType();
  const LogoIcon = activeLibraryType === LibraryType.video ? Film : Music2;

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden flex-col md:flex-row">
      {/* Sidebar */}
      <aside className="w-full md:w-64 bg-card border-r border-border flex flex-col shrink-0 z-20 hidden md:flex">
        <div className="p-6 flex items-center gap-3 border-b border-border/50">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center shadow-lg shadow-primary/25 relative overflow-hidden">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={activeLibraryType ?? "music"}
                initial={{ opacity: 0, scale: 0.6 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.6 }}
                transition={{ duration: 0.18, ease: "easeOut" }}
                className="absolute inset-0 flex items-center justify-center"
              >
                <LogoIcon className="w-5 h-5 text-white" />
              </motion.div>
            </AnimatePresence>
          </div>
          <h1 className="text-xl font-display font-bold text-gradient">Cadence</h1>
        </div>

        {/* Search */}
        <div className="px-4 py-3 border-b border-border/50">
          <SearchBar />
        </div>

        <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
          {/* Library heading */}
          <div className="mb-4">
            <h2 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-3 px-3">
              Library
            </h2>
            {/* Dynamic per-library nav */}
            <LibrariesSection />
            {/* All Music shortcut */}
            <AllMusicSection />
            {/* All Videos shortcut */}
            <AllVideosSection />
          </div>

          {/* Playlists */}
          <PlaylistsSidebar />
        </nav>

        <div className="p-4 border-t border-border/50">
          <NavLink
            href="/settings"
            icon={Settings}
            label="Settings"
            active={location.startsWith("/settings")}
          />
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 relative flex flex-col overflow-hidden pb-24">
        {/* Mobile Header */}
        <header className="md:hidden flex items-center gap-3 p-3 border-b border-border bg-card shrink-0">
          <div className="flex items-center gap-2 shrink-0">
            <div className="relative w-5 h-5">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={activeLibraryType ?? "music"}
                  initial={{ opacity: 0, scale: 0.6 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.6 }}
                  transition={{ duration: 0.18, ease: "easeOut" }}
                  className="absolute inset-0 flex items-center justify-center"
                >
                  <LogoIcon className="w-5 h-5 text-primary" />
                </motion.div>
              </AnimatePresence>
            </div>
            <h1 className="text-base font-display font-bold">Cadence</h1>
          </div>
          <div className="flex-1 min-w-0">
            <SearchBar />
          </div>
        </header>

        <div className="flex-1 overflow-y-auto w-full relative scroll-smooth">
          <motion.div
            key={location}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="w-full h-full"
          >
            {children}
          </motion.div>
        </div>
      </main>

      {/* Bottom Player Bar */}
      <Player />

      {/* Mobile Bottom Nav */}
      <MobileNav />
    </div>
  );
}

function MobileNav() {
  const [location] = useLocation();

  const isLibraryActive = location.startsWith("/library/");

  return (
    <nav className="md:hidden fixed bottom-20 left-0 right-0 bg-card/90 backdrop-blur-md border-t border-border flex items-center justify-around p-2 z-30 pb-safe">
      <Link
        href="/libraries"
        className={cn(
          "flex flex-col items-center p-2 rounded-lg gap-1",
          isLibraryActive || location === "/libraries" ? "text-primary" : "text-muted-foreground"
        )}
      >
        <Library className="w-5 h-5" />
        <span className="text-[10px] font-medium">Library</span>
      </Link>
      <Link
        href="/albums"
        className={cn(
          "flex flex-col items-center p-2 rounded-lg gap-1",
          location.startsWith("/albums") || location.startsWith("/artists") || location.startsWith("/genres") || location.startsWith("/browse")
            ? "text-primary" : "text-muted-foreground"
        )}
      >
        <Music2 className="w-5 h-5" />
        <span className="text-[10px] font-medium">Music</span>
      </Link>
      <Link
        href="/liked"
        className={cn(
          "flex flex-col items-center p-2 rounded-lg gap-1",
          location.startsWith("/liked") ? "text-primary" : "text-muted-foreground"
        )}
      >
        <Heart className="w-5 h-5" />
        <span className="text-[10px] font-medium">Liked</span>
      </Link>
      <Link
        href="/settings"
        className={cn(
          "flex flex-col items-center p-2 rounded-lg gap-1",
          location.startsWith("/settings") ? "text-primary" : "text-muted-foreground"
        )}
      >
        <Settings className="w-5 h-5" />
        <span className="text-[10px] font-medium">Settings</span>
      </Link>
    </nav>
  );
}
