import React, { useState, useEffect } from "react";
import { 
  useListLibraries, 
  useAddLibrary, 
  useDeleteLibrary, 
  useScanLibrary, 
  useGetScanStatus 
} from "@workspace/api-client-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { FolderPlus, Trash2, RefreshCw, Server, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const addLibrarySchema = z.object({
  name: z.string().min(1, "Name is required"),
  path: z.string().min(1, "Path is required").startsWith("/", "Must be an absolute path"),
});

export default function SettingsPage() {
  const { toast } = useToast();
  const { data, refetch: refetchLibs } = useListLibraries();
  const { mutate: addLibrary, isPending: isAdding } = useAddLibrary();
  const { mutate: deleteLibrary } = useDeleteLibrary();
  const { mutate: scanLibrary } = useScanLibrary();
  
  const { data: scanStatus, refetch: refetchScanStatus } = useGetScanStatus();
  
  // Poll scan status every 2s
  useEffect(() => {
    const interval = setInterval(() => { refetchScanStatus(); }, 2000);
    return () => clearInterval(interval);
  }, [refetchScanStatus]);

  const form = useForm<z.infer<typeof addLibrarySchema>>({
    resolver: zodResolver(addLibrarySchema),
    defaultValues: { name: "", path: "" }
  });

  const onSubmit = (values: z.infer<typeof addLibrarySchema>) => {
    addLibrary({ data: values }, {
      onSuccess: () => {
        form.reset();
        refetchLibs();
        toast({ title: "Library added successfully" });
      },
      onError: (err) => {
        toast({ title: "Failed to add library", description: err.message, variant: "destructive" });
      }
    });
  };

  const handleDelete = (id: number) => {
    if (confirm("Remove this library? Tracks will be removed from the database (files remain on disk).")) {
      deleteLibrary({ id }, {
        onSuccess: () => {
          refetchLibs();
          toast({ title: "Library removed" });
        }
      });
    }
  };

  const handleScan = (id: number) => {
    scanLibrary({ id }, {
      onSuccess: () => toast({ title: "Scan started" })
    });
  };

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto pb-24 min-h-full">
      <h1 className="text-3xl font-display font-bold mb-8">Settings</h1>

      {scanStatus?.scanning && (
        <div className="mb-8 p-4 bg-primary/10 border border-primary/20 rounded-xl flex items-center gap-4">
          <RefreshCw className="w-5 h-5 text-primary animate-spin" />
          <div className="flex-1">
            <h3 className="font-semibold text-primary">Library scan in progress</h3>
            <p className="text-sm text-primary/80">
              Scanned: {scanStatus.tracksScanned} • Added: {scanStatus.tracksAdded}
            </p>
          </div>
        </div>
      )}

      <div className="bg-card border border-border rounded-xl shadow-lg mb-8 overflow-hidden">
        <div className="p-6 border-b border-border bg-secondary/50">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Server className="w-5 h-5 text-primary" />
            Media Libraries
          </h2>
          <p className="text-sm text-muted-foreground mt-1">Configure folders where your music is stored.</p>
        </div>
        
        <div className="p-6">
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col md:flex-row gap-4 mb-8 items-start">
            <div className="flex-1 w-full space-y-1">
              <input 
                {...form.register("name")}
                placeholder="Name (e.g. Main Music)" 
                className="w-full bg-background border border-border rounded-lg px-4 py-2.5 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
              />
              {form.formState.errors.name && <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>}
            </div>
            <div className="flex-[2] w-full space-y-1">
              <input 
                {...form.register("path")}
                placeholder="Absolute Path (e.g. /home/user/Music)" 
                className="w-full bg-background border border-border rounded-lg px-4 py-2.5 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
              />
              {form.formState.errors.path && <p className="text-xs text-destructive">{form.formState.errors.path.message}</p>}
            </div>
            <button 
              type="submit" 
              disabled={isAdding}
              className="bg-primary hover:bg-primary/90 text-primary-foreground px-6 py-2.5 rounded-lg font-medium shadow-lg shadow-primary/20 transition-all flex items-center gap-2 disabled:opacity-50 w-full md:w-auto"
            >
              <FolderPlus className="w-4 h-4" />
              Add
            </button>
          </form>

          <div className="space-y-3">
            {data?.libraries?.map((lib) => (
              <div key={lib.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border border-border bg-background hover:border-primary/30 transition-colors gap-4">
                <div>
                  <h3 className="font-semibold text-foreground">{lib.name}</h3>
                  <code className="text-xs text-muted-foreground bg-secondary px-2 py-1 rounded mt-1 inline-block">{lib.path}</code>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => handleScan(lib.id)}
                    disabled={scanStatus?.scanning}
                    className="flex items-center gap-2 px-4 py-2 bg-secondary hover:bg-secondary/80 text-foreground rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                  >
                    <RefreshCw className={`w-4 h-4 ${scanStatus?.scanning && scanStatus.currentLibraryId === lib.id ? 'animate-spin text-primary' : ''}`} />
                    Scan
                  </button>
                  <button 
                    onClick={() => handleDelete(lib.id)}
                    className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                    title="Remove library"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
            
            {!data?.libraries?.length && (
              <div className="text-center py-12 border-2 border-dashed border-border rounded-xl">
                <AlertCircle className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-muted-foreground font-medium">No libraries configured</p>
                <p className="text-sm text-muted-foreground/70 mt-1">Add a folder path above to start scanning your music.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
