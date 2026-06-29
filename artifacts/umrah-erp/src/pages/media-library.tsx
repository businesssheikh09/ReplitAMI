import { useState, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Image, Film, Music, FileText, Upload, Search, Trash2, Loader2,
  AlertCircle, Library, RefreshCw, ExternalLink, RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";

/* ── Types ─────────────────────────────────────────────────────────── */

interface MediaLibraryItem {
  id: number;
  storageKey: string;
  originalFilename: string;
  mediaType: "image" | "video" | "audio" | "document";
  mimeType: string;
  sizeBytes: number;
  uploadedAt: string;
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
  { value: "document", label: "Documents" },
];

/* ── Helpers ────────────────────────────────────────────────────────── */

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function MediaIcon({ type, className }: { type: string; className?: string }) {
  const cls = cn("h-6 w-6", className);
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

/* ── Thumbnail cache (session-scoped) ───────────────────────────────── */
const thumbCache = new Map<number, string>();

/* ── Page component ─────────────────────────────────────────────────── */

export default function MediaLibraryPage() {
  const { token } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);
  const [replaceTargetId, setReplaceTargetId] = useState<number | null>(null);

  const [typeFilter, setTypeFilter] = useState("");
  const [search, setSearch] = useState("");
  const [uploading, setUploading] = useState(false);
  const [previewLoading, setPreviewLoading] = useState<number | null>(null);
  const [thumbUrls, setThumbUrls] = useState<Record<number, string>>({});

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

  const { data: items = [], isLoading, isError, refetch } = useQuery<MediaLibraryItem[]>({
    queryKey: ["media-library", typeFilter, search],
    queryFn: () => apiFetch(`/api/media-library?${params}`).then((r) => r.json()),
    staleTime: 15_000,
  });

  /* ── Load image thumbnails on demand (lazy by item) ── */
  const loadThumb = useCallback(async (item: MediaLibraryItem) => {
    if (item.mediaType !== "image") return;
    if (thumbCache.has(item.id)) {
      setThumbUrls((prev) => ({ ...prev, [item.id]: thumbCache.get(item.id)! }));
      return;
    }
    try {
      const r = await apiFetch(`/api/media-library/${item.id}/download-url`);
      const { url } = await r.json() as { url: string };
      thumbCache.set(item.id, url);
      setThumbUrls((prev) => ({ ...prev, [item.id]: url }));
    } catch { /* silent */ }
  }, [token]);

  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      apiFetch(`/api/media-library/${id}`, { method: "DELETE" }).then((r) => r.json()),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["media-library"] });
      toast({ description: "File deleted." });
    },
    onError: (err: Error) => toast({ variant: "destructive", description: err.message }),
  });

  const handlePreview = useCallback(async (item: MediaLibraryItem) => {
    setPreviewLoading(item.id);
    try {
      const res = await apiFetch(`/api/media-library/${item.id}/download-url`);
      const { url } = await res.json() as { url: string };
      window.open(url, "_blank", "noopener,noreferrer");
    } catch {
      toast({ variant: "destructive", description: "Failed to open file preview." });
    } finally {
      setPreviewLoading(null);
    }
  }, [token]);

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
        description: `File too large. Max for ${mediaType}: ${Math.round(maxSize / 1024 / 1024)} MB.`,
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
    if (!uploadRes.ok) throw new Error("Storage upload failed");

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

  const handleUploadChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setUploading(true);
    try {
      const newItem = await uploadAndRegister(file);
      if (!newItem) return;
      void qc.invalidateQueries({ queryKey: ["media-library"] });
      toast({ description: `"${file.name}" added to Media Library.` });
    } catch (err) {
      toast({ variant: "destructive", description: err instanceof Error ? err.message : "Upload failed" });
    } finally {
      setUploading(false);
    }
  }, [token]);

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
      setThumbUrls((prev) => { const next = { ...prev }; delete next[id]; return next; });
      void qc.invalidateQueries({ queryKey: ["media-library"] });
      toast({ description: `"${file.name}" replaced successfully.` });
    } catch (err) {
      toast({ variant: "destructive", description: err instanceof Error ? err.message : "Replace failed" });
    } finally {
      setUploading(false);
    }
  }, [replaceTargetId, token]);

  function triggerReplace(id: number) {
    setReplaceTargetId(id);
    setTimeout(() => replaceInputRef.current?.click(), 50);
  }

  const totalByType = items.reduce<Record<string, number>>((acc, item) => {
    acc[item.mediaType] = (acc[item.mediaType] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-6 pb-10">
      {/* Hidden inputs */}
      <input
        ref={uploadInputRef}
        type="file"
        accept=".jpg,.jpeg,.png,.webp,.mp4,.mp3,.ogg,.pdf,.doc,.docx,.xls,.xlsx"
        className="hidden"
        onChange={handleUploadChange}
      />
      <input
        ref={replaceInputRef}
        type="file"
        accept=".jpg,.jpeg,.png,.webp,.mp4,.mp3,.ogg,.pdf,.doc,.docx,.xls,.xlsx"
        className="hidden"
        onChange={handleReplaceChange}
      />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Library className="h-6 w-6 text-blue-600" />
            Media Library
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Upload, browse, and reuse files across WhatsApp campaigns and inbox messages.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isLoading}
          >
            <RefreshCw className={cn("h-3.5 w-3.5 mr-1.5", isLoading && "animate-spin")} />
            Refresh
          </Button>
          <Button
            size="sm"
            onClick={() => uploadInputRef.current?.click()}
            disabled={uploading}
            className="gap-1.5"
          >
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Upload File
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="flex gap-3 flex-wrap">
        {[
          { type: "image", label: "Images", icon: Image, color: "text-blue-500" },
          { type: "video", label: "Videos", icon: Film, color: "text-purple-500" },
          { type: "audio", label: "Audio", icon: Music, color: "text-orange-500" },
          { type: "document", label: "Documents", icon: FileText, color: "text-gray-500" },
        ].map(({ type, label, icon: Icon, color }) => (
          <div key={type} className="flex items-center gap-2 rounded-md border bg-card px-3 py-2 text-sm">
            <Icon className={cn("h-4 w-4", color)} />
            <span className="font-medium">{totalByType[type] ?? 0}</span>
            <span className="text-muted-foreground">{label}</span>
          </div>
        ))}
        <div className="flex items-center gap-2 rounded-md border bg-muted/50 px-3 py-2 text-sm">
          <span className="font-medium">{items.length}</span>
          <span className="text-muted-foreground">total files</span>
        </div>
      </div>

      {/* Search + filter */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by filename…"
            className="pl-8"
          />
        </div>
        <div className="flex rounded-md border overflow-hidden">
          {TYPE_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setTypeFilter(tab.value)}
              className={cn(
                "px-3 py-1.5 text-sm font-medium transition-colors border-r last:border-r-0",
                typeFilter === tab.value
                  ? "bg-primary text-primary-foreground"
                  : "bg-background text-muted-foreground hover:bg-muted",
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Allowed formats note */}
      <p className="text-xs text-muted-foreground">
        Allowed: JPG, PNG, WEBP (≤5 MB) · MP4 (≤16 MB) · MP3, OGG (≤16 MB) · PDF, DOC, DOCX, XLS, XLSX (≤16 MB) ·{" "}
        <span className="font-medium">Hover any card to preview, replace, or delete.</span>
      </p>

      {/* Grid */}
      {isLoading && (
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      )}
      {isError && (
        <div className="flex flex-col items-center gap-3 py-20 text-destructive">
          <AlertCircle className="h-8 w-8" />
          <p>Failed to load media library</p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
        </div>
      )}
      {!isLoading && !isError && items.length === 0 && (
        <div className="flex flex-col items-center gap-4 py-20 text-muted-foreground border-2 border-dashed rounded-xl">
          <Library className="h-14 w-14 opacity-20" />
          <div className="text-center">
            <p className="font-medium">No files yet</p>
            <p className="text-sm mt-1">Upload your first file to get started.</p>
          </div>
          <Button size="sm" onClick={() => uploadInputRef.current?.click()} disabled={uploading}>
            <Upload className="h-3.5 w-3.5 mr-1.5" />
            Upload File
          </Button>
        </div>
      )}
      {!isLoading && items.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {items.map((item) => (
            <div
              key={item.id}
              className="group relative rounded-lg border bg-card hover:border-primary transition-colors overflow-hidden shadow-sm"
              onMouseEnter={() => void loadThumb(item)}
            >
              {/* Preview area */}
              <div className="flex items-center justify-center h-28 bg-muted/40 overflow-hidden">
                {item.mediaType === "image" && thumbUrls[item.id] ? (
                  <img
                    src={thumbUrls[item.id]}
                    alt={item.originalFilename}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <MediaIcon
                    type={item.mediaType}
                    className={cn("h-12 w-12 opacity-40 group-hover:opacity-60 transition-opacity",
                      item.mediaType === "image" && "text-blue-500",
                      item.mediaType === "video" && "text-purple-500",
                      item.mediaType === "audio" && "text-orange-500",
                    )}
                  />
                )}
              </div>

              {/* Info */}
              <div className="p-2.5">
                <p className="text-xs font-medium truncate" title={item.originalFilename}>
                  {item.originalFilename}
                </p>
                <div className="flex items-center justify-between mt-1.5">
                  <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0", typeBadgeClass(item.mediaType))}>
                    {item.mediaType}
                  </Badge>
                  <span className="text-[10px] text-muted-foreground">{formatBytes(item.sizeBytes)}</span>
                </div>
              </div>

              {/* Hover action overlay */}
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1.5 bg-black/5">
                <Button
                  size="sm"
                  variant="secondary"
                  className="h-7 text-xs shadow"
                  onClick={() => handlePreview(item)}
                  disabled={previewLoading === item.id || uploading}
                >
                  {previewLoading === item.id
                    ? <Loader2 className="h-3 w-3 animate-spin mr-1" />
                    : <ExternalLink className="h-3 w-3 mr-1" />}
                  Preview
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs shadow bg-white/80"
                  onClick={() => triggerReplace(item.id)}
                  disabled={uploading || deleteMutation.isPending}
                >
                  <RotateCcw className="h-3 w-3 mr-1" />
                  Replace
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  className="h-7 text-xs shadow"
                  onClick={() => deleteMutation.mutate(item.id)}
                  disabled={deleteMutation.isPending || uploading}
                >
                  <Trash2 className="h-3 w-3 mr-1" />
                  Delete
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
