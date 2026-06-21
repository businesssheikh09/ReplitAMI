import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { useState } from "react";
import { Plane, ArrowLeft, Plus, Trash2, Upload, Loader2, Check, AlertCircle, Clock } from "lucide-react";
import { getPortalToken, getPortalUser } from "@/lib/portal-auth";

interface GroupTicket {
  id: number;
  flightNumber: string;
  airline: string;
  origin: string;
  destination: string;
  flightDate: string;
  departureTime: string | null;
  seatsAvailable: number | null;
  fareAmount: number | null;
  fareCurrency: string;
  class: string | null;
  notes: string | null;
}

interface Passenger {
  title: string;
  passengerType: string;
  firstName: string;
  lastName: string;
  dob: string;
  nationality: string;
  docNumber: string;
  docExpiry: string;
  documentObjectKey: string;
}

const EMPTY_PAX: Passenger = {
  title: "MR", passengerType: "adult", firstName: "", lastName: "",
  dob: "", nationality: "", docNumber: "", docExpiry: "", documentObjectKey: "",
};

const AIRLINE_NAMES: Record<string, string> = {
  SV: "Saudia", PK: "PIA", XY: "Flynas", G9: "Air Arabia",
  "9P": "FlyJinnah", PF: "Air Sial",
};

const CITY_NAMES: Record<string, string> = {
  JED: "Jeddah", MED: "Madinah", RUH: "Riyadh", DMM: "Dammam",
  DXB: "Dubai", SHJ: "Sharjah", AUH: "Abu Dhabi",
  BAH: "Bahrain", MCT: "Muscat", DOH: "Doha",
  ISB: "Islamabad", LHE: "Lahore", KHI: "Karachi", PEW: "Peshawar",
  UET: "Quetta", SKT: "Sialkot",
};

function PaxCard({
  pax,
  index,
  onChange,
  onRemove,
  canRemove,
}: {
  pax: Passenger;
  index: number;
  onChange: (index: number, field: keyof Passenger, value: string) => void;
  onRemove: (index: number) => void;
  canRemove: boolean;
}) {
  const [uploading, setUploading] = useState(false);
  const [scanResult, setScanResult] = useState<Record<string, string> | null>(null);

  const handleDocUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const uploadRes = await fetch(`/api/storage/upload-url?filename=${encodeURIComponent(file.name)}&contentType=${encodeURIComponent(file.type)}`, {
        method: "POST",
      });
      const { uploadUrl, objectKey } = await uploadRes.json();
      await fetch(uploadUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
      onChange(index, "documentObjectKey", objectKey);

      const scanRes = await fetch("/api/public/scan-document", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ objectKey }),
      });
      const scan = await scanRes.json();
      if (scan.firstName) {
        onChange(index, "firstName", scan.firstName);
        onChange(index, "lastName", scan.lastName ?? "");
        onChange(index, "dob", scan.dateOfBirth ?? "");
        onChange(index, "docNumber", scan.documentNumber ?? "");
        onChange(index, "docExpiry", scan.expiryDate ?? "");
        onChange(index, "nationality", scan.nationality ?? "");
        setScanResult({ status: "done" });
      } else {
        setScanResult({ status: "manual" });
      }
    } catch {
      setScanResult({ status: "error" });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="bg-stone-50 rounded-2xl border border-border p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-foreground">Passenger {index + 1}</h3>
        {canRemove && (
          <button type="button" onClick={() => onRemove(index)} className="text-destructive hover:opacity-70 transition">
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div>
          <label className="block text-xs font-medium mb-1">Title</label>
          <select value={pax.title} onChange={(e) => onChange(index, "title", e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl border border-border bg-white text-sm focus:ring-2 focus:ring-teal-500/40 focus:outline-none">
            <option>MR</option><option>MRS</option><option>MISS</option><option>MSTR</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">Type</label>
          <select value={pax.passengerType} onChange={(e) => onChange(index, "passengerType", e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl border border-border bg-white text-sm focus:ring-2 focus:ring-teal-500/40 focus:outline-none">
            <option value="adult">Adult</option><option value="child">Child</option><option value="infant">Infant</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">First Name *</label>
          <input type="text" value={pax.firstName} onChange={(e) => onChange(index, "firstName", e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl border border-border bg-white text-sm focus:ring-2 focus:ring-teal-500/40 focus:outline-none" />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">Last Name *</label>
          <input type="text" value={pax.lastName} onChange={(e) => onChange(index, "lastName", e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl border border-border bg-white text-sm focus:ring-2 focus:ring-teal-500/40 focus:outline-none" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div>
          <label className="block text-xs font-medium mb-1">Date of Birth</label>
          <input type="date" value={pax.dob} onChange={(e) => onChange(index, "dob", e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl border border-border bg-white text-sm focus:ring-2 focus:ring-teal-500/40 focus:outline-none" />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">Nationality</label>
          <input type="text" value={pax.nationality} onChange={(e) => onChange(index, "nationality", e.target.value)}
            placeholder="e.g. Pakistani"
            className="w-full px-3 py-2.5 rounded-xl border border-border bg-white text-sm focus:ring-2 focus:ring-teal-500/40 focus:outline-none" />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">Passport No.</label>
          <input type="text" value={pax.docNumber} onChange={(e) => onChange(index, "docNumber", e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl border border-border bg-white text-sm focus:ring-2 focus:ring-teal-500/40 focus:outline-none" />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">Expiry Date</label>
          <input type="date" value={pax.docExpiry} onChange={(e) => onChange(index, "docExpiry", e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl border border-border bg-white text-sm focus:ring-2 focus:ring-teal-500/40 focus:outline-none" />
        </div>
      </div>

      {/* Document upload */}
      <div className="border-t border-border pt-4">
        <label className="block text-xs font-medium text-muted-foreground mb-2">
          Passport Scan (optional — auto-fills fields)
        </label>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-dashed border-border bg-white text-sm text-muted-foreground hover:border-teal-400 hover:text-teal-700 transition cursor-pointer">
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {uploading ? "Scanning…" : "Upload Passport"}
            <input type="file" accept="image/*,.pdf" className="hidden" onChange={handleDocUpload} />
          </label>
          {pax.documentObjectKey && !uploading && (
            <span className="text-xs text-teal-600 font-medium">✓ Uploaded</span>
          )}
          {scanResult?.status === "done" && (
            <span className="text-xs text-teal-600 font-medium">✓ Fields auto-filled</span>
          )}
          {scanResult?.status === "manual" && (
            <span className="text-xs text-muted-foreground">Please fill fields manually</span>
          )}
        </div>
      </div>
    </div>
  );
}

export default function BookFlightPage() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const [passengers, setPassengers] = useState<Passenger[]>([{ ...EMPTY_PAX }]);
  const [submitted, setSubmitted] = useState(false);
  const [refNumber, setRefNumber] = useState("");

  const portalUser = getPortalUser();
  const portalToken = getPortalToken();

  const { data: ticket, isLoading, isError } = useQuery<GroupTicket>({
    queryKey: ["group-ticket", id],
    queryFn: () => fetch(`/api/public/group-tickets/${id}`).then((r) => r.json()),
    enabled: !!id,
  });

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/public/booking-inquiries", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(portalToken ? { Authorization: `Bearer ${portalToken}` } : {}),
        },
        body: JSON.stringify({
          ticketId: Number(id),
          passengers,
          portalUserId: portalUser?.id ?? null,
          userType: portalUser?.type ?? "guest",
        }),
      });
      if (!res.ok) throw new Error("Submission failed");
      return res.json() as Promise<{ referenceNumber: string }>;
    },
    onSuccess: (data) => {
      setRefNumber(data.referenceNumber);
      setSubmitted(true);
    },
  });

  const updatePax = (i: number, field: keyof Passenger, val: string) => {
    setPassengers((prev) => prev.map((p, idx) => (idx === i ? { ...p, [field]: val } : p)));
  };

  const addPax = () => setPassengers((prev) => [...prev, { ...EMPTY_PAX }]);
  const removePax = (i: number) => setPassengers((prev) => prev.filter((_, idx) => idx !== i));

  const valid = passengers.every((p) => p.firstName && p.lastName);

  if (isLoading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="h-10 w-10 rounded-full border-2 border-teal-500 border-t-transparent animate-spin" />
    </div>
  );

  if (isError || !ticket) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3 text-muted-foreground">
      <AlertCircle className="h-8 w-8 text-destructive" />
      <p>Flight not found.</p>
      <button onClick={() => navigate("/")} className="text-teal-600 hover:underline text-sm">← Back to flights</button>
    </div>
  );

  if (submitted) return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 text-center">
      <div className="w-16 h-16 rounded-full bg-teal-50 flex items-center justify-center mb-6">
        <Check className="h-8 w-8 text-teal-600" />
      </div>
      <h2 className="text-2xl font-serif mb-3">Booking Received!</h2>
      <p className="text-muted-foreground mb-6 max-w-sm">
        Our team will contact you shortly to confirm your seats and finalise payment.
      </p>
      <div className="bg-stone-50 border border-border rounded-xl px-8 py-5 mb-8">
        <p className="text-xs text-muted-foreground mb-1">Reference Number</p>
        <p className="text-2xl font-mono font-bold text-teal-700">{refNumber}</p>
      </div>
      {portalUser && (
        <p className="text-sm text-muted-foreground mb-4">
          <Clock className="inline h-4 w-4 mr-1" />
          Payment deadline will be visible in your{" "}
          <button onClick={() => navigate("/my-bookings")} className="text-teal-600 hover:underline">My Bookings</button>.
        </p>
      )}
      <button onClick={() => navigate("/")} className="text-teal-600 hover:underline text-sm">← Back to flights</button>
    </div>
  );

  const airlineName = AIRLINE_NAMES[ticket.airline?.split(" ")[0]] ?? ticket.airline;

  return (
    <div className="min-h-screen bg-stone-50">
      {/* Header */}
      <div className="bg-white border-b border-border sticky top-0 z-10">
        <div className="container mx-auto px-4 md:px-6 h-16 flex items-center gap-4">
          <button onClick={() => navigate("/")} className="text-muted-foreground hover:text-foreground transition">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex-1">
            <h1 className="font-semibold text-foreground text-sm">Book Flight</h1>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 md:px-6 py-8 max-w-3xl">
        {/* Flight summary card */}
        <div className="bg-white rounded-2xl border border-border p-6 mb-8">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center">
              <Plane className="h-5 w-5 text-teal-600" />
            </div>
            <div>
              <p className="font-semibold text-foreground">{airlineName} · {ticket.flightNumber}</p>
              <p className="text-sm text-muted-foreground">
                {new Date(ticket.flightDate + "T00:00:00").toLocaleDateString("en-PK", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div>
              <p className="text-3xl font-bold">{ticket.origin}</p>
              <p className="text-sm text-muted-foreground">{CITY_NAMES[ticket.origin] ?? ticket.origin}</p>
              {ticket.departureTime && <p className="text-sm font-medium text-teal-600">{ticket.departureTime}</p>}
            </div>
            <div className="flex-1 flex items-center gap-2">
              <div className="flex-1 h-px bg-border" />
              <Plane className="h-4 w-4 text-teal-400" />
              <div className="flex-1 h-px bg-border" />
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold">{ticket.destination}</p>
              <p className="text-sm text-muted-foreground">{CITY_NAMES[ticket.destination] ?? ticket.destination}</p>
            </div>
          </div>
          {ticket.fareAmount && (
            <div className="mt-5 pt-5 border-t border-border flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Fare per person</p>
              <p className="text-xl font-bold text-teal-700">{ticket.fareCurrency} {ticket.fareAmount.toLocaleString()}</p>
            </div>
          )}
          {!ticket.fareAmount && (
            <div className="mt-5 pt-5 border-t border-border">
              <p className="text-sm text-muted-foreground italic">Fare will be confirmed on booking — Price on Call</p>
            </div>
          )}
        </div>

        {/* Portal status */}
        {portalUser ? (
          <div className="bg-teal-50 border border-teal-200 rounded-xl p-4 mb-6 text-sm text-teal-800">
            Booking as <strong>{portalUser.fullName}</strong> ({portalUser.type.toUpperCase()} account)
          </div>
        ) : (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 text-sm text-amber-800">
            <strong>Tip:</strong> <button onClick={() => navigate("/portal-login")} className="underline">Sign in to your portal account</button> to track this booking and manage payment deadlines.
          </div>
        )}

        {/* Passengers */}
        <div className="space-y-4 mb-6">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-foreground">Passenger Details</h2>
            <span className="text-sm text-muted-foreground">{passengers.length} passenger{passengers.length !== 1 ? "s" : ""}</span>
          </div>
          {passengers.map((pax, i) => (
            <PaxCard key={i} pax={pax} index={i} onChange={updatePax} onRemove={removePax} canRemove={passengers.length > 1} />
          ))}
          <button
            type="button"
            onClick={addPax}
            className="w-full py-3 rounded-xl border-2 border-dashed border-border text-sm text-muted-foreground hover:border-teal-400 hover:text-teal-700 transition flex items-center justify-center gap-2"
          >
            <Plus className="h-4 w-4" /> Add Passenger
          </button>
        </div>

        {/* Submit */}
        <button
          onClick={() => valid && mutation.mutate()}
          disabled={mutation.isPending || !valid}
          className="w-full py-4 rounded-2xl bg-teal-600 text-white font-semibold hover:bg-teal-700 disabled:opacity-60 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
        >
          {mutation.isPending ? <><Loader2 className="h-4 w-4 animate-spin" /> Submitting…</> : "Submit Booking Request"}
        </button>
        {mutation.isError && (
          <p className="text-sm text-destructive text-center mt-3">Something went wrong. Please try again.</p>
        )}
      </div>
    </div>
  );
}
