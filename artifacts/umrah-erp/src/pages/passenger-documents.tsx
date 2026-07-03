import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { AlertCircle, CheckCircle, Upload, RefreshCcw, Plus, Pencil } from "lucide-react";

interface PassengerDoc {
  id: number;
  flightRequestId: number | null;
  flightQuotationId: number | null;
  passengerName: string | null;
  passportNumber: string | null;
  cnicNumber: string | null;
  nationality: string | null;
  dateOfBirth: string | null;
  passportExpiry: string | null;
  fatherName: string | null;
  passportKey: string | null;
  cnicKey: string | null;
  ocrProvider: string | null;
  ocrConfidence: string | null;
  ocrResult: string | null;
  ocrCorrected: boolean;
  updatedAt: string;
}

interface ScanResult {
  rawText: string;
  documentNumber: string | null;
  fullName: string | null;
  nationality: string | null;
  dateOfBirth: string | null;
  expiryDate: string | null;
  fatherName: string | null;
  confidence: number | null;
  provider: string;
  lowConfidence: boolean;
}

function OcrReviewPanel({
  scan,
  onSave,
  onClose,
}: {
  scan: ScanResult;
  onSave: (fields: Record<string, string>) => void;
  onClose: () => void;
}) {
  const [fields, setFields] = useState({
    passengerName: scan.fullName ?? "",
    passportNumber: scan.documentNumber ?? "",
    nationality: scan.nationality ?? "",
    dateOfBirth: scan.dateOfBirth ?? "",
    passportExpiry: scan.expiryDate ?? "",
    fatherName: scan.fatherName ?? "",
  });

  function set(k: string, v: string) {
    setFields((prev) => ({ ...prev, [k]: v }));
  }

  return (
    <div className="space-y-4">
      {scan.lowConfidence && (
        <div className="flex items-start gap-2 bg-yellow-50 border border-yellow-200 rounded p-3 text-sm">
          <AlertCircle className="h-4 w-4 text-yellow-600 shrink-0 mt-0.5" />
          <div>
            <strong>Low confidence ({scan.confidence?.toFixed(0)}%)</strong> — OCR result may be inaccurate.
            Please review and correct the fields below before saving.
          </div>
        </div>
      )}
      <div className="bg-gray-50 rounded p-3 text-xs font-mono max-h-28 overflow-y-auto text-gray-600">
        {scan.rawText || "No raw text extracted"}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Full Name</Label>
          <Input value={fields.passengerName} onChange={(e) => set("passengerName", e.target.value)} className="mt-1" />
        </div>
        <div>
          <Label>Passport Number</Label>
          <Input value={fields.passportNumber} onChange={(e) => set("passportNumber", e.target.value)} className="mt-1" />
        </div>
        <div>
          <Label>Nationality</Label>
          <Input value={fields.nationality} onChange={(e) => set("nationality", e.target.value)} className="mt-1" />
        </div>
        <div>
          <Label>Date of Birth</Label>
          <Input value={fields.dateOfBirth} onChange={(e) => set("dateOfBirth", e.target.value)} className="mt-1" placeholder="YYYY-MM-DD" />
        </div>
        <div>
          <Label>Passport Expiry</Label>
          <Input value={fields.passportExpiry} onChange={(e) => set("passportExpiry", e.target.value)} className="mt-1" placeholder="YYYY-MM-DD" />
        </div>
        <div>
          <Label>Father Name (CNIC)</Label>
          <Input value={fields.fatherName} onChange={(e) => set("fatherName", e.target.value)} className="mt-1" />
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={() => onSave(fields)}>
          <CheckCircle className="h-3.5 w-3.5 mr-1" /> Save Corrected Fields
        </Button>
      </div>
    </div>
  );
}

interface Props {
  flightRequestId?: number;
  flightQuotationId?: number;
}

export default function PassengerDocumentsPage({ flightRequestId, flightQuotationId }: Props) {
  const { token } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const headers = { Authorization: `Bearer ${token}` };

  const [addDialog, setAddDialog] = useState(false);
  const [editDialog, setEditDialog] = useState<PassengerDoc | null>(null);
  const [ocrReview, setOcrReview] = useState<{ scan: ScanResult; docId: number } | null>(null);
  const [uploadDocId, setUploadDocId] = useState<number | null>(null);
  const [uploadDocType, setUploadDocType] = useState<"passport" | "cnic">("passport");
  const [ocrProvider, setOcrProvider] = useState<"ai" | "local" | "manual">("local");
  const [reScanProvider, setReScanProvider] = useState<"ai" | "local">("local");
  const fileRef = useRef<HTMLInputElement>(null);

  const [newPassenger, setNewPassenger] = useState({
    passengerName: "",
    passportNumber: "",
    cnicNumber: "",
    nationality: "",
    dateOfBirth: "",
    passportExpiry: "",
    fatherName: "",
  });

  const params = new URLSearchParams();
  if (flightRequestId) params.set("flightRequestId", String(flightRequestId));
  if (flightQuotationId) params.set("flightQuotationId", String(flightQuotationId));

  const { data: docs = [], isLoading } = useQuery<PassengerDoc[]>({
    queryKey: ["passenger-docs", flightRequestId, flightQuotationId],
    queryFn: () =>
      fetch(`/api/passenger-documents?${params}`, { headers }).then((r) => r.json()),
    enabled: !!token,
  });

  const createMutation = useMutation({
    mutationFn: (body: object) =>
      fetch("/api/passenger-documents", {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, flightRequestId, flightQuotationId }),
      }).then(async (r) => { if (!r.ok) { const e = await r.json(); throw new Error(e.error); } return r.json(); }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["passenger-docs"] });
      toast({ title: "Passenger record added" });
      setAddDialog(false);
      setNewPassenger({ passengerName: "", passportNumber: "", cnicNumber: "", nationality: "", dateOfBirth: "", passportExpiry: "", fatherName: "" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const patchMutation = useMutation({
    mutationFn: ({ id, fields }: { id: number; fields: Record<string, string> }) =>
      fetch(`/api/passenger-documents/${id}`, {
        method: "PATCH",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify(fields),
      }).then(async (r) => { if (!r.ok) { const e = await r.json(); throw new Error(e.error); } return r.json(); }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["passenger-docs"] });
      toast({ title: "Saved" });
      setEditDialog(null);
      setOcrReview(null);
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const reScanMutation = useMutation({
    mutationFn: ({ id, docType, provider }: { id: number; docType: string; provider: string }) =>
      fetch(`/api/passenger-documents/${id}/scan`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ docType, provider }),
      }).then(async (r) => { if (!r.ok) { const e = await r.json(); throw new Error(e.error); } return r.json(); }),
    onSuccess: (data, vars) => {
      qc.invalidateQueries({ queryKey: ["passenger-docs"] });
      if (data.scan?.lowConfidence) {
        setOcrReview({ scan: data.scan, docId: vars.id });
      } else {
        toast({ title: "Re-scan complete", description: data.message });
      }
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  async function handleUpload(docId: number) {
    if (!fileRef.current?.files?.[0]) return;
    const file = fileRef.current.files[0];
    const fd = new FormData();
    fd.append("file", file);
    try {
      const r = await fetch(
        `/api/passenger-documents/${docId}/upload?docType=${uploadDocType}&provider=${ocrProvider}`,
        { method: "POST", headers, body: fd }
      );
      const data = await r.json();
      qc.invalidateQueries({ queryKey: ["passenger-docs"] });
      if (data.scan?.lowConfidence) {
        setOcrReview({ scan: data.scan, docId });
      } else {
        toast({ title: data.message ?? "Uploaded" });
      }
      setUploadDocId(null);
      if (fileRef.current) fileRef.current.value = "";
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Passenger Documents</h2>
        <Button size="sm" onClick={() => setAddDialog(true)}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Add Passenger
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center text-muted-foreground py-4 text-sm">Loading…</div>
      ) : docs.length === 0 ? (
        <div className="text-center text-muted-foreground py-6 text-sm border rounded-lg">
          No passengers added yet. Click "Add Passenger" to start.
        </div>
      ) : (
        <div className="space-y-3">
          {docs.map((doc) => (
            <Card key={doc.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
                    <div>
                      <span className="text-muted-foreground">Name:</span>{" "}
                      <strong>{doc.passengerName || "—"}</strong>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Nationality:</span>{" "}
                      {doc.nationality || "—"}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Passport:</span>{" "}
                      <span className="font-mono">{doc.passportNumber || "—"}</span>
                      {doc.passportExpiry && (
                        <span className="text-xs text-muted-foreground ml-2">exp. {doc.passportExpiry}</span>
                      )}
                    </div>
                    <div>
                      <span className="text-muted-foreground">CNIC:</span>{" "}
                      <span className="font-mono">{doc.cnicNumber || "—"}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">DOB:</span> {doc.dateOfBirth || "—"}
                    </div>
                    {doc.fatherName && (
                      <div>
                        <span className="text-muted-foreground">Father:</span> {doc.fatherName}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-1 items-end shrink-0">
                    {doc.ocrProvider && (
                      <Badge variant="outline" className="text-xs">
                        OCR: {doc.ocrProvider}
                        {doc.ocrConfidence && ` (${parseFloat(doc.ocrConfidence).toFixed(0)}%)`}
                        {doc.ocrCorrected && " ✓"}
                      </Badge>
                    )}
                    <div className="flex gap-1">
                      <Button size="sm" variant="outline" onClick={() => setEditDialog(doc)}>
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => { setUploadDocId(doc.id); setUploadDocType("passport"); }}
                      >
                        <Upload className="h-3 w-3 mr-1" /> Passport
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => { setUploadDocId(doc.id); setUploadDocType("cnic"); }}
                      >
                        <Upload className="h-3 w-3 mr-1" /> CNIC
                      </Button>
                    </div>
                    {(doc.passportKey || doc.cnicKey) && (
                      <div className="flex gap-1">
                        {doc.passportKey && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-xs"
                            onClick={() => reScanMutation.mutate({ id: doc.id, docType: "passport", provider: reScanProvider })}
                            disabled={reScanMutation.isPending}
                          >
                            <RefreshCcw className="h-3 w-3 mr-1" /> Re-scan Passport
                          </Button>
                        )}
                        {doc.cnicKey && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-xs"
                            onClick={() => reScanMutation.mutate({ id: doc.id, docType: "cnic", provider: reScanProvider })}
                            disabled={reScanMutation.isPending}
                          >
                            <RefreshCcw className="h-3 w-3 mr-1" /> Re-scan CNIC
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* OCR Provider setting */}
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <span>OCR Provider:</span>
        <Select value={ocrProvider} onValueChange={(v) => setOcrProvider(v as any)}>
          <SelectTrigger className="h-7 w-40 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="local">Local OCR (Tesseract)</SelectItem>
            <SelectItem value="ai">AI OCR (OpenAI)</SelectItem>
            <SelectItem value="manual">Manual Entry</SelectItem>
          </SelectContent>
        </Select>
        <span className="mx-2">Re-scan Provider:</span>
        <Select value={reScanProvider} onValueChange={(v) => setReScanProvider(v as any)}>
          <SelectTrigger className="h-7 w-40 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="local">Local OCR (Tesseract)</SelectItem>
            <SelectItem value="ai">AI OCR (OpenAI)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Add Passenger Dialog */}
      <Dialog open={addDialog} onOpenChange={setAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Passenger</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            {[
              { key: "passengerName", label: "Full Name" },
              { key: "nationality", label: "Nationality" },
              { key: "passportNumber", label: "Passport Number" },
              { key: "passportExpiry", label: "Passport Expiry (YYYY-MM-DD)" },
              { key: "cnicNumber", label: "CNIC Number" },
              { key: "dateOfBirth", label: "Date of Birth (YYYY-MM-DD)" },
              { key: "fatherName", label: "Father Name" },
            ].map(({ key, label }) => (
              <div key={key} className={key === "fatherName" ? "col-span-2" : ""}>
                <Label>{label}</Label>
                <Input
                  value={(newPassenger as any)[key]}
                  onChange={(e) => setNewPassenger((p) => ({ ...p, [key]: e.target.value }))}
                  className="mt-1"
                />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialog(false)}>Cancel</Button>
            <Button onClick={() => createMutation.mutate(newPassenger)} disabled={createMutation.isPending}>
              Add Passenger
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Passenger Dialog */}
      <Dialog open={!!editDialog} onOpenChange={() => setEditDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Passenger — {editDialog?.passengerName || `#${editDialog?.id}`}</DialogTitle>
          </DialogHeader>
          {editDialog && (
            <EditForm
              doc={editDialog}
              onSave={(fields) => patchMutation.mutate({ id: editDialog.id, fields })}
              isPending={patchMutation.isPending}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Upload Dialog */}
      <Dialog open={!!uploadDocId} onOpenChange={() => setUploadDocId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload {uploadDocType === "cnic" ? "CNIC" : "Passport"} Image</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              OCR provider: <strong>{ocrProvider === "local" ? "Local Tesseract" : ocrProvider === "ai" ? "AI (OpenAI)" : "Manual (no OCR)"}</strong>
            </p>
            <input ref={fileRef} type="file" accept="image/*" className="block w-full text-sm" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadDocId(null)}>Cancel</Button>
            <Button onClick={() => handleUpload(uploadDocId!)}>
              <Upload className="h-3.5 w-3.5 mr-1" /> Upload & Scan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* OCR Review Dialog */}
      <Dialog open={!!ocrReview} onOpenChange={() => setOcrReview(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>OCR Review — Manual Correction Required</DialogTitle>
          </DialogHeader>
          {ocrReview && (
            <OcrReviewPanel
              scan={ocrReview.scan}
              onSave={(fields) => patchMutation.mutate({ id: ocrReview.docId, fields })}
              onClose={() => setOcrReview(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EditForm({
  doc,
  onSave,
  isPending,
}: {
  doc: PassengerDoc;
  onSave: (fields: Record<string, string>) => void;
  isPending: boolean;
}) {
  const [fields, setFields] = useState({
    passengerName: doc.passengerName ?? "",
    passportNumber: doc.passportNumber ?? "",
    cnicNumber: doc.cnicNumber ?? "",
    nationality: doc.nationality ?? "",
    dateOfBirth: doc.dateOfBirth ?? "",
    passportExpiry: doc.passportExpiry ?? "",
    fatherName: doc.fatherName ?? "",
  });

  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        {[
          { key: "passengerName", label: "Full Name" },
          { key: "nationality", label: "Nationality" },
          { key: "passportNumber", label: "Passport Number" },
          { key: "passportExpiry", label: "Passport Expiry" },
          { key: "cnicNumber", label: "CNIC Number" },
          { key: "dateOfBirth", label: "Date of Birth" },
          { key: "fatherName", label: "Father Name" },
        ].map(({ key, label }) => (
          <div key={key} className={key === "fatherName" ? "col-span-2" : ""}>
            <Label>{label}</Label>
            <Input
              value={(fields as any)[key]}
              onChange={(e) => setFields((p) => ({ ...p, [key]: e.target.value }))}
              className="mt-1"
            />
          </div>
        ))}
      </div>
      <DialogFooter>
        <Button onClick={() => onSave(fields)} disabled={isPending}>Save Changes</Button>
      </DialogFooter>
    </>
  );
}
