import React, { useState } from "react";
import { useBrowseFolder } from "@workspace/api-client-react";
import { Loader2, Folder, FileAudio, ChevronRight, Home, Play } from "lucide-react";
import { usePlayer } from "@/hooks/use-player";
import { Track } from "@workspace/api-client-react";

export default function BrowsePage() {
  const [currentPath, setCurrentPath] = useState("/");
  const { data, isLoading } = useBrowseFolder({ path: currentPath });
  const { playTrack } = usePlayer();

  const handleFolderClick = (path: string) => {
    setCurrentPath(path);
  };

  const handleFileClick = (entry: any) => {
    if (entry.trackId) {
      // Create a partial track object enough for playback
      const track: Track = {
        id: entry.trackId,
        title: entry.name,
        filePath: entry.path,
        mimeType: entry.mimeType || "audio/mpeg",
        hasArt: false,
      };
      playTrack(track);
    }
  };

  const breadcrumbs = currentPath.split("/").filter(Boolean);

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto min-h-full pb-20">
      <h1 className="text-3xl font-display font-bold mb-6">Files</h1>

      {/* Breadcrumb Navigation */}
      <div className="flex flex-wrap items-center gap-2 mb-6 bg-secondary/50 p-3 rounded-lg border border-border">
        <button 
          onClick={() => setCurrentPath("/")}
          className="flex items-center text-muted-foreground hover:text-primary transition-colors"
        >
          <Home className="w-4 h-4" />
        </button>
        
        {breadcrumbs.map((crumb, idx) => {
          const path = "/" + breadcrumbs.slice(0, idx + 1).join("/");
          return (
            <React.Fragment key={path}>
              <ChevronRight className="w-4 h-4 text-muted-foreground/50" />
              <button 
                onClick={() => setCurrentPath(path)}
                className="text-sm font-medium hover:text-primary transition-colors"
              >
                {crumb}
              </button>
            </React.Fragment>
          );
        })}
      </div>

      <div className="bg-card rounded-xl border border-border overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
        ) : data?.entries?.length ? (
          <div className="flex flex-col divide-y divide-border/50">
            {currentPath !== "/" && (
              <div 
                onClick={() => {
                  const parts = currentPath.split("/").filter(Boolean);
                  parts.pop();
                  setCurrentPath("/" + parts.join("/"));
                }}
                className="flex items-center gap-3 p-4 hover:bg-secondary cursor-pointer transition-colors text-muted-foreground"
              >
                <Folder className="w-5 h-5 text-primary/50" />
                <span className="font-medium">..</span>
              </div>
            )}
            
            {/* Directories First */}
            {data.entries.filter(e => e.type === "directory").map(dir => (
              <div 
                key={dir.path}
                onClick={() => handleFolderClick(dir.path)}
                className="flex items-center gap-3 p-4 hover:bg-secondary cursor-pointer transition-colors group"
              >
                <Folder className="w-5 h-5 text-primary/70 group-hover:text-primary transition-colors" />
                <span className="font-medium text-foreground">{dir.name}</span>
              </div>
            ))}
            
            {/* Files */}
            {data.entries.filter(e => e.type === "file").map(file => (
              <div 
                key={file.path}
                onClick={() => handleFileClick(file)}
                className="flex items-center justify-between p-4 hover:bg-secondary cursor-pointer transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <FileAudio className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                  <span className="text-sm text-foreground truncate">{file.name}</span>
                </div>
                {file.trackId && (
                  <Play className="w-4 h-4 text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="p-12 text-center text-muted-foreground">
            <Folder className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p>This folder is empty.</p>
          </div>
        )}
      </div>
    </div>
  );
}
