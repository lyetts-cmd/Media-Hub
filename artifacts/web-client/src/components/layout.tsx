import React, { useState } from "react";
import { Link, useLocation } from "wouter";
import { Library, Music2, Disc3, Mic2, FolderTree, Settings, Heart, ListMusic, Plus } from "lucide-react";
import { motion } from "framer-motion";
import Player from "./player";
import SearchBar from "./search-bar";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { useListPlaylists, useCreatePlaylist } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const navItems = [
  { href: "/albums", label: "Albums", icon: Disc3 },
  { href: "/artists", label: "Artists", icon: Mic2 },
  { href: "/genres", label: "Genres", icon: Music2 },
  { href: "/browse", label: "Browse", icon: FolderTree },
];

function NavLink({
  href,
  icon: Icon,
  label,
  active,
}: {
  href: string;
  icon: React.ElementType;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200",
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

export default function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden flex-col md:flex-row">
      {/* Sidebar */}
      <aside className="w-full md:w-64 bg-card border-r border-border flex flex-col shrink-0 z-20 hidden md:flex">
        <div className="p-6 flex items-center gap-3 border-b border-border/50">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center shadow-lg shadow-primary/25">
            <Music2 className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-xl font-display font-bold text-gradient">Cadence</h1>
        </div>

        {/* Search */}
        <div className="px-4 py-3 border-b border-border/50">
          <SearchBar />
        </div>

        <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
          {/* Library */}
          <div className="mb-6">
            <h2 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-3 px-3">
              Library
            </h2>
            {navItems.map((item) => (
              <NavLink
                key={item.href}
                href={item.href}
                icon={item.icon}
                label={item.label}
                active={location.startsWith(item.href)}
              />
            ))}
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
            <Music2 className="w-5 h-5 text-primary" />
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
      <nav className="md:hidden fixed bottom-20 left-0 right-0 bg-card/90 backdrop-blur-md border-t border-border flex items-center justify-around p-2 z-30 pb-safe">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex flex-col items-center p-2 rounded-lg gap-1",
              location.startsWith(item.href) ? "text-primary" : "text-muted-foreground"
            )}
          >
            <item.icon className="w-5 h-5" />
            <span className="text-[10px] font-medium">{item.label}</span>
          </Link>
        ))}
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
    </div>
  );
}
