import { useState, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Image, Film, Music, FileText, Upload, Search, Trash2, Check,
  Loader2, AlertCircle, X, Library, RefreshCw, RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";

/* ── Types ─────────────────────────────────────────────────────────── */

export interface MediaLibraryItem {
  id: number;
  storageKey: string;
  originalFilename: string;
  mediaType: "image" | "video" | "audio" | "document";
  mimeType: string;
  sizeBytes: number;
  uploadedAt: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSelect: (item: MediaLibraryItem) => void;
}

/* ── Constants ──────────────────────────────────────────────────────── */

const ALLOWED_TYPES: Record<string, string> = {
  "image/jpeg": "image",
  "image/png": "image",
  "image/webp": "image",
  "video/mp4": "video",
  "audio/mpeg": "audio",
  "audio/ogg": "audio",
  "application/pdf": "document",
  "application/msword": "document",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "document",
  "application/vnd.ms-excel": "document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "document",
};

const MAX_SIZES: Record<string, number> = {
  image: 5 * 1024 * 1024,
  video: 16 * 1024 * 1024,
  audio: 16 * 1024 * 1024,
  document: 16 * 1024 * 1024,
};

const TYPE_TABS = [
  { value: "", label: "All" },
  { value: "image", label: "Images" },
  { value: "video", label: "Video" },
  { value: "audio", label: "Audio" },
  { value: "document", label: "Docs" },
];

/* ── Helpers ────────────────────────────────────────────────────────── */

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function MediaIcon({ type, className }: { type: string; className?: string }) {
  const cls = cn("h-5 w-5", className);
  switch (type) {
    case "image": return <Image className={cls} />;
    case "video": return <Film className={cls} />;
    case "audio": return <Music className={cls} />;
    default: return <FileText className={cls} />;
  }
}

function typeBadgeClass(type: string): string {
  switch (type) {
    case "image": return "bg-blue-100 text-blue-700 border-blue-200";
    case "video": return "bg-purple-100 text-purple-700 border-purple-200";
    case "audio": return "bg-orange-100 text-orange-700 border-orange-200";
    default: return "bg-gray-100 text-gray-700 border-gray-200";
  }
}

/* ── Thumbnail cache ──────────────────────────────────────────────── */
const thumbCache = new Map<number, string>();

function useThumb(item: MediaLibraryItem, token: string | null) {
  const [url, setUrl] = useState<string | null>(thumbCache.get(item.id) ?? null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (item.mediaType !== "image") return;
    if (thumbCache.has(item.id)) { setUrl(thumbCache.get(item.id)!); return; }
    setLoading(true);
    try {
      const hdrs: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
      const r = await fetch(`/api/media-library/${item.id}/download-url`, {
        credentials: "include",
        headers: hdrs,
      });
      if (!r.ok) return;
      const { url: signedUrl } = await r.json() as { url: string };
      thumbCache.set(item.id, signedUrl);
      setUrl(signedUrl);
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, [item.id, item.mediaType, token]);

  return { url, loading, load };
}

/* ── Main Component ─────────────────────────────────────────────────── */

export function MediaLibraryDrawer({ open, onClose, onSelect }: Props) {
  const { token } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);
  const [replaceTargetId, setReplaceTargetId] = useState<number | null>(null);

  const [typeFilter, setTypeFilter] = useState("");
  const [search, setSearch] = useState("");
  const [uploading, setUploading] = useState(false);

  const tokenRef = useRef(token);
  tokenRef.current = token;

  function apiFetch(path: string, init?: RequestInit) {
    const hdrs: Record<string, string> = tokenRef.current
      ? { Authorization: `Bearer ${tokenRef.current}` }
      : {};
    return fetch(path, {
      credentials: "include",
      ...init,
      headers: { ...hdrs, ...(init?.headers as Record<string, string> | undefined ?? {}) },
    }).then((r) => {
      if (!r.ok) return r.json().then((e) => { throw new Error(e.error ?? `HTTP ${r.status}`); });
      return r;
    });
  }

  const params = new URLSearchParams();
  if (typeFilter) params.set("type", typeFilter);
  if (search.trim()) params.set("search", search.trim());

  const { data: items = [], isLoading, isError } = useQuery<MediaLibraryItem[]>({
    queryKey: ["media-library", typeFilter, search],
    queryFn: () => apiFetch(`/api/media-library?${params}`).then((r) => r.json()),
    enabled: open,
    staleTime: 10_000,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      apiFetch(`/api/media-library/${id}`, { method: "DELETE" }).then((r) => r.json()),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["media-library"] });
      toast({ description: "File deleted from Media Library." });
    },
    onError: (err: Error) => toast({ variant: "destructive", description: err.message }),
  });

  async function uploadAndRegister(file: File, existingId?: number): Promise<MediaLibraryItem | null> {
    const mediaType = ALLOWED_TYPES[file.type];
    if (!mediaType) {
      toast({ variant: "destructive", description: `Unsupported file type: ${file.type}` });
      return null;
    }
    const maxSize = MAX_SIZES[mediaType];
    if (file.size > maxSize) {
      toast({
        variant: "destructive",
        description: `File too large. Maximum for ${mediaType} is ${Math.round(maxSize / 1024 / 1024)} MB.`,
      });
      return null;
    }

    const urlRes = await apiFetch("/api/storage/uploads/request-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type }),
    });
    const { uploadURL, objectPath } = await urlRes.json() as { uploadURL: string; objectPath: string };

    const uploadRes = await fetch(uploadURL, {
      method: "PUT",
      body: file,
      headers: { "Content-Type": file.type },
    });
    if (!uploadRes.ok) throw new Error("Upload failed");

    const method = existingId ? "PUT" : "POST";
    const path = existingId ? `/api/media-library/${existingId}` : "/api/media-library";
    const regRes = await apiFetch(path, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        storageKey: objectPath,
        originalFilename: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
      }),
    });
    return regRes.json() as Promise<MediaLibraryItem>;
  }

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setUploading(true);
    try {
      const newItem = await uploadAndRegister(file);
      if (!newItem) return;
      void qc.invalidateQueries({ queryKey: ["media-library"] });
      toast({ description: `"${file.name}" uploaded to Media Library.` });
      onSelect(newItem);
      onClose();
    } catch (err) {
      toast({
        variant: "destructive",
        description: err instanceof Error ? err.message : "Upload failed",
      });
    } finally {
      setUploading(false);
    }
  }, [token, onClose, onSelect, toast]);

  const handleReplaceChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const id = replaceTargetId;
    e.target.value = "";
    setReplaceTargetId(null);
    if (!file || !id) return;

    setUploading(true);
    try {
      const updated = await uploadAndRegister(file, id);
      if (!updated) return;
      thumbCache.delete(id);
      void qc.invalidateQueries({ queryKey: ["media-library"] });
      toast({ description: `"${file.name}" replaced successfully.` });
    } catch (err) {
      toast({
        variant: "destructive",
        description: err instanceof Error ? err.message : "Replace failed",
      });
    } finally {
      setUploading(false);
    }
  }, [replaceTargetId, token, toast]);

  function triggerReplace(id: number) {
    setReplaceTargetId(id);
    setTimeout(() => replaceInputRef.current?.click(), 50);
  }

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="w-[480px] sm:max-w-[480px] flex flex-col p-0">
        <SheetHeader className="px-5 pt-5 pb-3 border-b shrink-0">
          <SheetTitle className="flex items-center gap-2">
            <Library className="h-5 w-5 text-blue-600" />
            Media Library
          </SheetTitle>
        </SheetHeader>

        {/* Toolbar */}
        <div className="px-4 py-3 border-b space-y-3 shrink-0">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search files…"
                className="pl-8 h-8 text-sm"
              />
            </div>
            <Button
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="h-8 gap-1.5 shrink-0"
            >
              {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
              Upload
            </Button>
            {/* Hidden inputs */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".jpg,.jpeg,.png,.webp,.mp4,.mp3,.ogg,.pdf,.doc,.docx,.xls,.xlsx"
              className="hidden"
              onChange={handleFileChange}
            />
            <input
              ref={replaceInputRef}
              type="file"
              accept=".jpg,.jpeg,.png,.webp,.mp4,.mp3,.ogg,.pdf,.doc,.docx,.xls,.xlsx"
              className="hidden"
              onChange={handleReplaceChange}
            />
          </div>

          {/* Type filter tabs */}
          <div className="flex gap-1">
            {TYPE_TABS.map((tab) => (
              <button
                key={tab.value}
                onClick={() => setTypeFilter(tab.value)}
                className={cn(
                  "px-2.5 py-1 rounded text-xs font-medium transition-colors",
                  typeFilter === tab.value
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted",
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Grid */}
        <ScrollArea className="flex-1">
          <div className="p-4">
            {isLoading && (
              <div className="flex items-center justify-center py-16 text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            )}
            {isError && (
              <div className="flex flex-col items-center gap-2 py-16 text-destructive">
                <AlertCircle className="h-6 w-6" />
                <p className="text-sm">Failed to load media library</p>
              </div>
            )}
            {!isLoading && !isError && items.length === 0 && (
              <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
                <Library className="h-10 w-10 opacity-30" />
                <p className="text-sm">No files yet. Upload one to get started.</p>
              </div>
            )}
            {!isLoading && items.length > 0 && (
              <div className="grid grid-cols-2 gap-3">
                {items.map((item) => (
                  <MediaCard
                    key={item.id}
                    item={item}
                    token={token}
                    onSelect={() => { onSelect(item); onClose(); }}
                    onDelete={() => deleteMutation.mutate(item.id)}
                    onReplace={() => triggerReplace(item.id)}
                    deleting={deleteMutation.isPending}
                    uploading={uploading}
                  />
                ))}
              </div>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

function MediaCard({
  item,
  token,
  onSelect,
  onDelete,
  onReplace,
  deleting,
  uploading,
}: {
  item: MediaLibraryItem;
  token: string | null;
  onSelect: () => void;
  onDelete: () => void;
  onReplace: () => void;
  deleting: boolean;
  uploading: boolean;
}) {
  const { url: thumbUrl, loading: thumbLoading, load: loadThumb } = useThumb(item, token);
  const [entered, setEntered] = useState(false);

  function handleHover() {
    if (!entered) {
      setEntered(true);
      void loadThumb();
    }
  }

  return (
    <div
      className="group relative rounded-lg border bg-card hover:border-primary transition-colors overflow-hidden"
      onMouseEnter={handleHover}
    >
      {/* Preview area */}
      <div
        className="flex items-center justify-center h-24 bg-muted/40 cursor-pointer overflow-hidden"
        onClick={onSelect}
      >
        {item.mediaType === "image" && thumbUrl ? (
          <img
            src={thumbUrl}
            alt={item.originalFilename}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : item.mediaType === "image" && thumbLoading ? (
          <Loader2 className="h-5 w-5 animate-spin text-blue-300" />
        ) : (
          <MediaIcon
            type={item.mediaType}
            className={cn("h-10 w-10 opacity-50 group-hover:opacity-70",
              item.mediaType === "image" && "text-blue-500",
              item.mediaType === "video" && "text-purple-500",
              item.mediaType === "audio" && "text-orange-500",
              item.mediaType === "document" && "text-gray-500",
            )}
          />
        )}
      </div>

      {/* Info */}
      <div className="p-2 cursor-pointer" onClick={onSelect}>
        <p className="text-xs font-medium truncate" title={item.originalFilename}>
          {item.originalFilename}
        </p>
        <div className="flex items-center justify-between mt-1">
          <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0", typeBadgeClass(item.mediaType))}>
            {item.mediaType}
          </Badge>
          <span className="text-[10px] text-muted-foreground">{formatBytes(item.sizeBytes)}</span>
        </div>
      </div>

      {/* Hover action row */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none group-hover:pointer-events-auto">
        {/* Top-right buttons */}
        <div className="absolute top-1 right-1 flex gap-1">
          <button
            onClick={(e) => { e.stopPropagation(); onReplace(); }}
            disabled={deleting || uploading}
            className="bg-white/90 rounded-full p-1 shadow hover:bg-blue-50 hover:text-blue-600 transition-colors"
            title="Replace file"
          >
            <RotateCcw className="h-3 w-3" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            disabled={deleting || uploading}
            className="bg-white/90 rounded-full p-1 shadow hover:bg-red-50 hover:text-red-600 transition-colors"
            title="Delete"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>

        {/* Select overlay */}
        <button
          onClick={onSelect}
          className="absolute inset-0 flex items-end justify-center pb-2"
          style={{ background: "linear-gradient(to top, rgba(0,0,0,0.08), transparent)" }}
        >
          <span className="bg-primary text-primary-foreground text-xs px-3 py-1 rounded-full flex items-center gap-1 shadow">
            <Check className="h-3 w-3" /> Select
          </span>
        </button>
      </div>
    </div>
  );
}
