import React from "react";
import { Link, useLocation } from "wouter";
import { Library, Music2, Disc3, Mic2, FolderTree, Settings, Home } from "lucide-react";
import { motion } from "framer-motion";
import Player from "./player";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const navItems = [
  { href: "/albums", label: "Albums", icon: Disc3 },
  { href: "/artists", label: "Artists", icon: Mic2 },
  { href: "/genres", label: "Genres", icon: Music2 },
  { href: "/browse", label: "Browse", icon: FolderTree },
];

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
        
        <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
          <div className="mb-8">
            <h2 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-3 px-3">Library</h2>
            {navItems.map((item) => {
              const isActive = location.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200",
                    isActive 
                      ? "bg-primary/10 text-primary" 
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                  )}
                >
                  <item.icon className={cn("w-5 h-5", isActive ? "text-primary" : "text-muted-foreground")} />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </nav>

        <div className="p-4 border-t border-border/50">
          <Link
            href="/settings"
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200",
              location.startsWith("/settings")
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground"
            )}
          >
            <Settings className="w-5 h-5" />
            Settings
          </Link>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 relative flex flex-col overflow-hidden pb-24">
        {/* Mobile Header */}
        <header className="md:hidden flex items-center justify-between p-4 border-b border-border bg-card shrink-0">
          <div className="flex items-center gap-2">
            <Music2 className="w-6 h-6 text-primary" />
            <h1 className="text-lg font-display font-bold">Cadence</h1>
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
