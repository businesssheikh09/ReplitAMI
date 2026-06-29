import { Router } from "express";
import { db, mediaLibraryTable } from "@workspace/db";
import { eq, ilike, and, desc } from "drizzle-orm";
import { requireAuth, requireRole } from "../middlewares/auth.js";
import { ObjectStorageService } from "../lib/objectStorage.js";

const router = Router();
const canManage = requireRole("admin", "management");
const objectStorageService = new ObjectStorageService();

const ALLOWED_MIME_TYPES: Record<string, string> = {
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

function validateMimeAndSize(
  mimeType: string,
  sizeBytes: number,
): { ok: true; mediaType: string } | { ok: false; error: string } {
  const mediaType = ALLOWED_MIME_TYPES[mimeType];
  if (!mediaType) {
    return { ok: false, error: `Unsupported file type: ${mimeType}` };
  }
  const maxSize = MAX_SIZES[mediaType];
  if (sizeBytes > maxSize) {
    return {
      ok: false,
      error: `File too large. Maximum size for ${mediaType} is ${Math.round(maxSize / 1024 / 1024)} MB.`,
    };
  }
  return { ok: true, mediaType };
}

/**
 * GET /api/media-library
 * List all media library items, optionally filtered by type or filename search.
 */
router.get("/media-library", requireAuth, canManage, async (req, res) => {
  const { type, search } = req.query as { type?: string; search?: string };

  try {
    const conditions = [];
    if (type && ["image", "video", "audio", "document"].includes(type)) {
      conditions.push(
        eq(mediaLibraryTable.mediaType, type as "image" | "video" | "audio" | "document"),
      );
    }
    if (search?.trim()) {
      conditions.push(ilike(mediaLibraryTable.originalFilename, `%${search.trim()}%`));
    }

    const items = await db
      .select()
      .from(mediaLibraryTable)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(mediaLibraryTable.uploadedAt));

    return res.json(items);
  } catch (err) {
    req.log.error({ err }, "media-library GET: failed");
    return res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * POST /api/media-library
 * Register a newly uploaded asset.
 * Deduplication: if a record with the same storageKey already exists, return it
 * instead of inserting a duplicate (storage key is UNIQUE in the DB).
 * Body: { storageKey, originalFilename, mimeType, sizeBytes }
 */
router.post("/media-library", requireAuth, canManage, async (req, res) => {
  const { storageKey, originalFilename, mimeType, sizeBytes } = req.body as {
    storageKey?: string;
    originalFilename?: string;
    mimeType?: string;
    sizeBytes?: number;
  };

  if (!storageKey || !originalFilename || !mimeType || !sizeBytes) {
    return res
      .status(400)
      .json({ error: "storageKey, originalFilename, mimeType, sizeBytes are required" });
  }

  const validation = validateMimeAndSize(mimeType, sizeBytes);
  if (!validation.ok) {
    return res.status(400).json({ error: validation.error });
  }

  const user = (req as any).user as { id?: number } | undefined;

  try {
    // Dedup: return existing record if the same storageKey was already registered.
    const [existing] = await db
      .select()
      .from(mediaLibraryTable)
      .where(eq(mediaLibraryTable.storageKey, storageKey));

    if (existing) {
      req.log.info(
        { id: existing.id, storageKey },
        "media-library POST: dedup — returning existing record",
      );
      return res.status(200).json(existing);
    }

    const [item] = await db
      .insert(mediaLibraryTable)
      .values({
        storageKey,
        originalFilename,
        mediaType: validation.mediaType as "image" | "video" | "audio" | "document",
        mimeType,
        sizeBytes,
        uploadedBy: user?.id ?? null,
      })
      .returning();

    req.log.info(
      { id: item.id, filename: originalFilename, mediaType: item.mediaType },
      "Media library item registered",
    );
    return res.status(201).json(item);
  } catch (err) {
    req.log.error({ err }, "media-library POST: failed");
    return res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * PUT /api/media-library/:id
 * Replace an existing media library item's file with a new upload.
 * The old storage object is deleted; the new storageKey, filename, mimeType and sizeBytes
 * replace the existing record in-place, preserving the same id (so all references to
 * mediaLibraryId in messages and campaigns keep working).
 * Body: { storageKey, originalFilename, mimeType, sizeBytes }
 */
router.put("/media-library/:id", requireAuth, canManage, async (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: "Invalid id" });

  const { storageKey, originalFilename, mimeType, sizeBytes } = req.body as {
    storageKey?: string;
    originalFilename?: string;
    mimeType?: string;
    sizeBytes?: number;
  };

  if (!storageKey || !originalFilename || !mimeType || !sizeBytes) {
    return res
      .status(400)
      .json({ error: "storageKey, originalFilename, mimeType, sizeBytes are required" });
  }

  const validation = validateMimeAndSize(mimeType, sizeBytes);
  if (!validation.ok) {
    return res.status(400).json({ error: validation.error });
  }

  try {
    const [current] = await db
      .select()
      .from(mediaLibraryTable)
      .where(eq(mediaLibraryTable.id, id));

    if (!current) return res.status(404).json({ error: "Not found" });

    // Delete old storage object (best-effort — don't fail if object already gone)
    if (current.storageKey !== storageKey) {
      try {
        const oldFile = await objectStorageService.getObjectEntityFile(current.storageKey);
        await oldFile.delete();
      } catch {
        req.log.warn(
          { id, oldStorageKey: current.storageKey },
          "media-library PUT: could not delete old object (continuing)",
        );
      }
    }

    const [updated] = await db
      .update(mediaLibraryTable)
      .set({
        storageKey,
        originalFilename,
        mediaType: validation.mediaType as "image" | "video" | "audio" | "document",
        mimeType,
        sizeBytes,
        uploadedAt: new Date(),
      })
      .where(eq(mediaLibraryTable.id, id))
      .returning();

    req.log.info(
      { id, filename: originalFilename, mediaType: updated.mediaType },
      "Media library item replaced",
    );
    return res.json(updated);
  } catch (err) {
    req.log.error({ err }, "media-library PUT: failed");
    return res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * GET /api/media-library/:id/download-url
 * Generate a signed download URL for the asset (1-hour expiry).
 */
router.get("/media-library/:id/download-url", requireAuth, canManage, async (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: "Invalid id" });

  try {
    const [item] = await db
      .select()
      .from(mediaLibraryTable)
      .where(eq(mediaLibraryTable.id, id));
    if (!item) return res.status(404).json({ error: "Not found" });

    const objectFile = await objectStorageService.getObjectEntityFile(item.storageKey);
    const { File } = await import("@google-cloud/storage");
    const signedUrl = await (objectFile as InstanceType<typeof File>).getSignedUrl({
      action: "read",
      expires: Date.now() + 60 * 60 * 1000,
    });

    return res.json({ url: signedUrl[0], item });
  } catch (err) {
    req.log.error({ err }, "media-library download-url: failed");
    return res.status(500).json({ error: "Failed to generate download URL" });
  }
});

/**
 * DELETE /api/media-library/:id
 * Remove the record and its storage object.
 */
router.delete("/media-library/:id", requireAuth, canManage, async (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: "Invalid id" });

  try {
    const [item] = await db
      .select()
      .from(mediaLibraryTable)
      .where(eq(mediaLibraryTable.id, id));
    if (!item) return res.status(404).json({ error: "Not found" });

    try {
      const objectFile = await objectStorageService.getObjectEntityFile(item.storageKey);
      await objectFile.delete();
    } catch {
      req.log.warn(
        { id },
        "media-library DELETE: could not delete object from storage (continuing)",
      );
    }

    await db.delete(mediaLibraryTable).where(eq(mediaLibraryTable.id, id));
    return res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "media-library DELETE: failed");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
