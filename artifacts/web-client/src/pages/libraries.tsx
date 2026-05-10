import React from "react";
import { Link } from "wouter";
import { useListLibraries, LibraryType } from "@workspace/api-client-react";
import { Loader2, Music2, Film, ChevronRight, Settings } from "lucide-react";
import { motion } from "framer-motion";

export default function LibrariesPage() {
  const { data, isLoading } = useListLibraries();
  const libraries = data?.libraries ?? [];

  return (
    <div className="p-6 md:p-8 max-w-2xl mx-auto min-h-full pb-20">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-display font-bold">Libraries</h1>
        <Link href="/settings">
          <button className="p-2 rounded-lg hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground">
            <Settings className="w-5 h-5" />
          </button>
        </Link>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : libraries.length > 0 ? (
        <div className="flex flex-col gap-3">
          {libraries.map((lib, i) => {
            const isVideo = lib.type === LibraryType.video;
            return (
              <Link key={lib.id} href={`/library/${lib.id}`}>
                <motion.div
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.06, duration: 0.25 }}
                  className="group flex items-center gap-4 p-4 bg-card border border-border rounded-xl hover:border-primary/50 hover:bg-secondary/50 transition-all cursor-pointer"
                >
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                    isVideo ? "bg-purple-500/15 text-purple-400" : "bg-primary/15 text-primary"
                  }`}>
                    {isVideo ? <Film className="w-6 h-6" /> : <Music2 className="w-6 h-6" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold truncate group-hover:text-primary transition-colors">
                        {lib.name}
                      </h3>
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase shrink-0 ${
                        isVideo ? "bg-purple-500/15 text-purple-400" : "bg-primary/15 text-primary"
                      }`}>
                        {lib.type}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{lib.path}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground/50 group-hover:text-primary transition-colors shrink-0" />
                </motion.div>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-20 text-muted-foreground">
          <Music2 className="w-12 h-12 mx-auto mb-4 opacity-20" />
          <p className="font-medium mb-2">No libraries yet</p>
          <p className="text-sm mb-6">Add a music or video library to get started.</p>
          <Link href="/settings">
            <button className="inline-flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg text-sm font-medium transition-colors">
              <Settings className="w-4 h-4" />
              Go to Settings
            </button>
          </Link>
        </div>
      )}
    </div>
  );
}
