import React, { useState, useEffect } from "react";
import { useRoute, Link } from "wouter";
import { useBrowseVideoFolder, useListLibraries, useGetVideo } from "@workspace/api-client-react";
import { Loader2, Folder, Film, ChevronRight, Home, Play, Settings } from "lucide-react";
import { usePlayer } from "@/hooks/use-player";

function VideoFileRow({ videoId, name }: { videoId: number; name: string }) {
  const { data: video } = useGetVideo(videoId);
  const { playVideo } = usePlayer();

  return (
    <div
      onClick={() => video && playVideo(video)}
      className="flex items-center justify-between p-4 hover:bg-secondary cursor-pointer transition-colors group"
    >
      <div className="flex items-center gap-3 min-w-0">
        <Film className="w-5 h-5 shrink-0 text-muted-foreground group-hover:text-primary transition-colors" />
        <span className="text-sm text-foreground truncate">{name}</span>
      </div>
      <Play className="w-4 h-4 shrink-0 text-primary opacity-0 group-hover:opacity-100 transition-opacity ml-2" />
    </div>
  );
}

function RawFolderEntry({
  entry,
  onFolderClick,
}: {
  entry: { name: string; path: string; type: string; videoId?: number | null; mimeType?: string | null };
  onFolderClick: (path: string) => void;
}) {
  if (entry.type === "directory") {
    return (
      <div
        onClick={() => onFolderClick(entry.path)}
        className="flex items-center gap-3 p-4 hover:bg-secondary cursor-pointer transition-colors group"
      >
        <Folder className="w-5 h-5 text-primary/70 group-hover:text-primary transition-colors" />
        <span className="font-medium text-foreground">{entry.name}</span>
      </div>
    );
  }
  if (entry.videoId) {
    return <VideoFileRow videoId={entry.videoId} name={entry.name} />;
  }
  return (
    <div className="flex items-center gap-3 p-4 text-muted-foreground/60">
      <Film className="w-5 h-5 shrink-0" />
      <span className="text-sm truncate">{entry.name}</span>
    </div>
  );
}

export default function VideoFolderPage() {
  const [, params] = useRoute("/library/:id/video-folder");
  const libraryId = params?.id ? Number(params.id) : undefined;
  const { data: libData } = useListLibraries();
  const library = libData?.libraries?.find((l) => l.id === libraryId);

  const [currentPath, setCurrentPath] = useState<string | null>(null);
  const browsePath = currentPath ?? "/";

  useEffect(() => {
    if (library?.path && currentPath === null) {
      setCurrentPath(library.path);
    }
  }, [library?.path, currentPath]);

  const { data, isLoading, isError } = useBrowseVideoFolder({ path: browsePath });

  const libraryRoot = library?.path ?? null;

  const handleFolderClick = (folderPath: string) => setCurrentPath(folderPath);

  const handleBack = () => {
    if (!currentPath || !libraryRoot) return;
    if (currentPath === libraryRoot) return;
    const parts = currentPath.split("/").filter(Boolean);
    parts.pop();
    const parent = "/" + parts.join("/");
    if (!parent.startsWith(libraryRoot.replace(/\/$/, ""))) {
      setCurrentPath(libraryRoot);
    } else {
      setCurrentPath(parent || libraryRoot);
    }
  };

  const breadcrumbs = buildBreadcrumbs(browsePath, libraryRoot);
  const entries = data?.entries ?? [];
  const dirs = entries.filter((e) => e.type === "directory");
  const files = entries.filter((e) => e.type === "file");
  const hasEntries = entries.length > 0;
  const noLibraries = !isLoading && !isError && browsePath === "/" && !hasEntries && data?.noLibraries === true;

  if (currentPath === null && !library) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto min-h-full pb-20">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-display font-bold">
          {library ? `${library.name} — Folders` : "Video Files"}
        </h1>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-6 bg-secondary/50 p-3 rounded-lg border border-border">
        <button
          onClick={() => setCurrentPath(libraryRoot ?? "/")}
          className="flex items-center text-muted-foreground hover:text-primary transition-colors"
          title="Library root"
        >
          <Home className="w-4 h-4" />
        </button>
        {breadcrumbs.map((crumb) => (
          <React.Fragment key={crumb.path}>
            <ChevronRight className="w-4 h-4 text-muted-foreground/50" />
            <button
              onClick={() => setCurrentPath(crumb.path)}
              className="text-sm font-medium hover:text-primary transition-colors"
            >
              {crumb.label}
            </button>
          </React.Fragment>
        ))}
      </div>

      <div className="bg-card rounded-xl border border-border overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : isError ? (
          <div className="p-12 text-center text-muted-foreground">
            <Folder className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p className="font-medium">Could not load this folder</p>
            <button onClick={() => setCurrentPath(libraryRoot ?? "/")} className="mt-4 text-sm text-primary hover:underline">
              Go back to root
            </button>
          </div>
        ) : noLibraries ? (
          <div className="p-12 text-center text-muted-foreground">
            <Folder className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p className="font-medium">No video libraries configured</p>
            <p className="text-sm mt-1">Add a video library path in Settings to get started.</p>
            <Link href="/settings">
              <button className="mt-4 flex items-center gap-2 mx-auto px-4 py-2 bg-primary/10 hover:bg-primary/20 text-primary rounded-lg text-sm font-medium transition-colors">
                <Settings className="w-4 h-4" />
                Go to Settings
              </button>
            </Link>
          </div>
        ) : hasEntries ? (
          <div className="flex flex-col divide-y divide-border/50">
            {currentPath !== libraryRoot && (
              <div
                onClick={handleBack}
                className="flex items-center gap-3 p-4 hover:bg-secondary cursor-pointer transition-colors text-muted-foreground"
              >
                <Folder className="w-5 h-5 text-primary/50" />
                <span className="font-medium">..</span>
              </div>
            )}
            {dirs.map((entry) => (
              <RawFolderEntry key={entry.path} entry={entry} onFolderClick={handleFolderClick} />
            ))}
            {files.map((entry) => (
              <RawFolderEntry key={entry.path} entry={entry} onFolderClick={handleFolderClick} />
            ))}
          </div>
        ) : (
          <div className="p-12 text-center text-muted-foreground">
            <Folder className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p className="font-medium">This folder is empty</p>
            <p className="text-sm mt-1 opacity-70">No video files found here.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function buildBreadcrumbs(
  currentPath: string,
  libraryRoot: string | null
): Array<{ label: string; path: string }> {
  const base = libraryRoot?.replace(/\/$/, "") ?? "";
  if (!base || !currentPath.startsWith(base)) return [];
  const relative = currentPath.slice(base.length);
  const parts = relative.split("/").filter(Boolean);
  return parts.map((part, idx) => ({
    label: part,
    path: base + "/" + parts.slice(0, idx + 1).join("/"),
  }));
}
