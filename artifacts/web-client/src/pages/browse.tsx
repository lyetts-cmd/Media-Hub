import React, { useState, useEffect } from "react";
import { Link, useRoute } from "wouter";
import { useBrowseFolder, useListLibraries, FolderEntry, getGetAlbumArtUrl } from "@workspace/api-client-react";
import { Loader2, Folder, FileAudio, ChevronRight, Home, Play, ListMusic, Settings, Music } from "lucide-react";
import { usePlayer } from "@/hooks/use-player";
import { Track } from "@workspace/api-client-react";

type PlayableTrack = Track & { streamUrl?: string };

function makeTrackFromEntry(entry: FolderEntry): PlayableTrack {
  if (entry.trackId) {
    return {
      id: entry.trackId,
      title: entry.title ?? entry.name.replace(/\.[^.]+$/, ""),
      artistName: entry.artist ?? undefined,
      albumId: entry.albumId ?? undefined,
      filePath: entry.path,
      mimeType: entry.mimeType ?? "audio/mpeg",
      hasArt: !!entry.albumId,
      liked: false,
    };
  }
  return {
    id: -(Math.abs(hashCode(entry.path))),
    title: entry.name.replace(/\.[^.]+$/, ""),
    filePath: entry.path,
    mimeType: entry.mimeType ?? "audio/mpeg",
    hasArt: false,
    liked: false,
    streamUrl: `/api/music/browse/stream?path=${encodeURIComponent(entry.path)}`,
  };
}

function hashCode(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  }
  return h || -1;
}

function TrackThumbnail({ albumId }: { albumId?: number | null }) {
  const [errored, setErrored] = useState(false);

  if (albumId && !errored) {
    return (
      <img
        src={getGetAlbumArtUrl(albumId)}
        alt=""
        className="w-10 h-10 rounded object-cover shrink-0 bg-secondary"
        onError={() => setErrored(true)}
      />
    );
  }

  return (
    <div className="w-10 h-10 rounded shrink-0 bg-secondary flex items-center justify-center">
      <Music className="w-5 h-5 text-muted-foreground/50" />
    </div>
  );
}

export default function BrowsePage() {
  const [, libParams] = useRoute("/library/:id/browse");
  const libraryId = libParams?.id ? Number(libParams.id) : undefined;
  const { data: libData } = useListLibraries();
  const library = libData?.libraries?.find((l) => l.id === libraryId);

  const [currentPath, setCurrentPath] = useState<string | null>(null);
  const browsePath = currentPath ?? "/";

  useEffect(() => {
    if (library?.path && currentPath === null) {
      setCurrentPath(library.path);
    }
  }, [library?.path, currentPath]);

  const { data, isLoading, isError } = useBrowseFolder({ path: browsePath });
  const { playTrack } = usePlayer();

  const libraryRoot = library?.path ?? null;
  const heading = library ? `${library.name} — Files` : "Files";

  const handleFolderClick = (folderPath: string) => setCurrentPath(folderPath);

  const handleFileClick = (entry: FolderEntry) => {
    const track = makeTrackFromEntry(entry);
    const allFiles = (data?.entries ?? []).filter(e => e.type === "file");
    const queue = allFiles.map(makeTrackFromEntry);
    playTrack(track, queue.length > 1 ? queue : undefined);
  };

  const handlePlayAll = () => {
    const files = (data?.entries ?? []).filter(e => e.type === "file");
    if (files.length === 0) return;
    const queue = files.map(makeTrackFromEntry);
    playTrack(queue[0], queue);
  };

  const handleBack = () => {
    if (!currentPath) return;
    const rootAnchor = libraryRoot ?? "/";
    if (currentPath === rootAnchor) return;
    const parts = currentPath.split("/").filter(Boolean);
    parts.pop();
    const parent = "/" + parts.join("/");
    const normalizedRoot = rootAnchor.replace(/\/$/, "");
    if (!parent.startsWith(normalizedRoot)) {
      setCurrentPath(rootAnchor);
    } else {
      setCurrentPath(parent || rootAnchor);
    }
  };

  const breadcrumbs = buildBreadcrumbs(browsePath, libraryRoot);
  const files = (data?.entries ?? []).filter(e => e.type === "file");
  const dirs = (data?.entries ?? []).filter(e => e.type === "directory");
  const hasEntries = (data?.entries?.length ?? 0) > 0;
  const noLibraries = !isLoading && !isError && browsePath === "/" && !hasEntries && data?.noLibraries === true;

  if (currentPath === null && !library && libraryId) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto min-h-full pb-20">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-display font-bold">{heading}</h1>
        {files.length >= 1 && (
          <button
            onClick={handlePlayAll}
            className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg text-sm font-medium shadow-lg shadow-primary/20 transition-all"
          >
            <ListMusic className="w-4 h-4" />
            Play all ({files.length})
          </button>
        )}
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
            <p className="text-sm mt-1">The path may be outside your configured libraries.</p>
            <button onClick={() => setCurrentPath(libraryRoot ?? "/")} className="mt-4 text-sm text-primary hover:underline">
              Go back to root
            </button>
          </div>
        ) : noLibraries ? (
          <div className="p-12 text-center text-muted-foreground">
            <Folder className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p className="font-medium">No music libraries configured</p>
            <p className="text-sm mt-1">Add a folder path in Settings to get started.</p>
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
            {dirs.map(dir => (
              <div
                key={dir.path}
                onClick={() => handleFolderClick(dir.path)}
                className="flex items-center gap-3 p-4 hover:bg-secondary cursor-pointer transition-colors group"
              >
                <Folder className="w-5 h-5 text-primary/70 group-hover:text-primary transition-colors" />
                <span className="font-medium text-foreground">{dir.name}</span>
              </div>
            ))}
            {files.map(file => (
              <div
                key={file.path}
                onClick={() => handleFileClick(file)}
                className="flex items-center justify-between p-3 hover:bg-secondary cursor-pointer transition-colors group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  {file.title ? (
                    <TrackThumbnail albumId={file.albumId} />
                  ) : (
                    <div className="w-10 h-10 rounded shrink-0 bg-secondary flex items-center justify-center">
                      <FileAudio className="w-5 h-5 text-muted-foreground/50 group-hover:text-primary transition-colors" />
                    </div>
                  )}
                  <div className="min-w-0 flex flex-col">
                    {file.title ? (
                      <>
                        <span className="text-sm font-medium text-foreground truncate">
                          {file.title}
                          {file.artist && (
                            <span className="text-muted-foreground font-normal"> · {file.artist}</span>
                          )}
                        </span>
                        <span className="text-xs text-muted-foreground/70 truncate">{file.name}</span>
                      </>
                    ) : (
                      <span className="text-sm text-foreground truncate">{file.name}</span>
                    )}
                  </div>
                </div>
                <Play className="w-4 h-4 shrink-0 text-primary opacity-0 group-hover:opacity-100 transition-opacity ml-2" />
              </div>
            ))}
          </div>
        ) : (
          <div className="p-12 text-center text-muted-foreground">
            <Folder className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p className="font-medium">This folder is empty</p>
            <p className="text-sm mt-1 opacity-70">No audio files found here.</p>
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
  if (!base || !currentPath.startsWith(base)) {
    if (!libraryRoot) {
      const parts = currentPath.split("/").filter(Boolean);
      return parts.map((part, idx) => ({
        label: part,
        path: "/" + parts.slice(0, idx + 1).join("/"),
      }));
    }
    return [];
  }
  const relative = currentPath.slice(base.length);
  const parts = relative.split("/").filter(Boolean);
  return parts.map((part, idx) => ({
    label: part,
    path: base + "/" + parts.slice(0, idx + 1).join("/"),
  }));
}
