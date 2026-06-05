import React, { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { useFsBrowse } from "@workspace/api-client-react";
import { Folder, FolderOpen, ChevronRight, Check, Loader2, AlertCircle } from "lucide-react";

interface DirectoryPickerProps {
  value: string;
  onChange: (path: string) => void;
}

interface PopoverPos {
  top: number;
  left: number;
  width: number;
}

function Breadcrumbs({ path, onNavigate }: { path: string; onNavigate: (p: string) => void }) {
  const segments = path.split("/").filter(Boolean);
  const parts = [
    { label: "/", path: "/" },
    ...segments.map((seg, i) => ({
      label: seg,
      path: "/" + segments.slice(0, i + 1).join("/"),
    })),
  ];

  return (
    <div className="flex items-center gap-0.5 flex-wrap text-xs min-w-0">
      {parts.map((part, i) => (
        <React.Fragment key={part.path}>
          {i > 0 && <ChevronRight className="w-3 h-3 text-muted-foreground flex-shrink-0" />}
          <button
            type="button"
            onClick={() => onNavigate(part.path)}
            className={`px-1 py-0.5 rounded hover:bg-secondary/80 transition-colors truncate max-w-[140px] ${
              i === parts.length - 1
                ? "text-foreground font-medium"
                : "text-muted-foreground hover:text-foreground"
            }`}
            title={part.path}
          >
            {part.label}
          </button>
        </React.Fragment>
      ))}
    </div>
  );
}

function Popover({
  pos,
  currentPath,
  onNavigate,
  onSelect,
  onClose,
}: {
  pos: PopoverPos;
  currentPath: string;
  onNavigate: (p: string) => void;
  onSelect: () => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  const { data, isLoading, isError, error } = useFsBrowse({ path: currentPath });

  useEffect(() => {
    function handlePointerDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  const style: React.CSSProperties = {
    position: "fixed",
    top: pos.top,
    left: pos.left,
    width: Math.max(pos.width, 320),
    zIndex: 9999,
  };

  return createPortal(
    <div ref={ref} style={style} className="bg-popover border border-border rounded-xl shadow-2xl overflow-hidden flex flex-col">
      {/* Header: breadcrumbs + select button */}
      <div className="p-3 border-b border-border bg-secondary/40 space-y-2">
        <Breadcrumbs path={currentPath} onNavigate={onNavigate} />
        <button
          type="button"
          onClick={onSelect}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg text-xs font-semibold transition-colors"
        >
          <Check className="w-3.5 h-3.5" />
          Select this folder
        </button>
      </div>

      {/* Directory list */}
      <div className="overflow-y-auto max-h-64">
        {isLoading && (
          <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground text-sm">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading…
          </div>
        )}

        {isError && (
          <div className="flex items-center gap-2 px-4 py-4 text-destructive text-xs">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {(error as { message?: string })?.message ?? "Cannot read directory"}
          </div>
        )}

        {!isLoading && !isError && data?.entries.length === 0 && (
          <div className="text-center py-8 text-muted-foreground text-sm">
            No subdirectories here
          </div>
        )}

        {!isLoading && !isError && data?.entries && data.entries.length > 0 && (
          <ul>
            {data.entries.map((entry) => (
              <li key={entry.path}>
                <button
                  type="button"
                  onClick={() => onNavigate(entry.path)}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm hover:bg-secondary transition-colors text-left"
                >
                  <Folder className="w-4 h-4 text-primary flex-shrink-0" />
                  <span className="truncate flex-1">{entry.name}</span>
                  <ChevronRight className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>,
    document.body
  );
}

export function DirectoryPicker({ value, onChange }: DirectoryPickerProps) {
  const [open, setOpen] = useState(false);
  const [currentPath, setCurrentPath] = useState("/");
  const [pos, setPos] = useState<PopoverPos>({ top: 0, left: 0, width: 320 });
  const buttonRef = useRef<HTMLButtonElement>(null);

  const handleOpen = useCallback(() => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setPos({
        top: rect.bottom + 6,
        left: rect.left,
        width: rect.width,
      });
    }
    setCurrentPath(value && value.startsWith("/") ? value : "/");
    setOpen(true);
  }, [value]);

  const handleSelect = useCallback(() => {
    onChange(currentPath);
    setOpen(false);
  }, [currentPath, onChange]);

  const handleClose = useCallback(() => setOpen(false), []);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={handleOpen}
        className="flex items-center gap-2 px-3 py-2.5 bg-background border border-border rounded-lg text-sm text-muted-foreground hover:border-primary hover:text-foreground transition-all whitespace-nowrap"
        title="Browse server directories"
      >
        <FolderOpen className="w-4 h-4 flex-shrink-0" />
        <span>Browse</span>
      </button>

      {open && (
        <Popover
          pos={pos}
          currentPath={currentPath}
          onNavigate={setCurrentPath}
          onSelect={handleSelect}
          onClose={handleClose}
        />
      )}
    </>
  );
}
