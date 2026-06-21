import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Hotel, Car, Users, Calendar, Phone, ChevronDown, Check, Loader2 } from "lucide-react";

interface HotelOption {
  id: number;
  name: string;
  city: string;
  stars: number | null;
  distanceFromHaram: string | null;
}

function StarRating({ stars }: { stars: number | null }) {
  if (!stars) return null;
  return (
    <span className="text-yellow-500 text-xs">
      {"★".repeat(Math.min(stars, 5))}{"☆".repeat(Math.max(0, 5 - stars))}
    </span>
  );
}

function HotelSelect({
  city,
  hotels,
  value,
  onChange,
  label,
}: {
  city: string;
  hotels: HotelOption[];
  value: number | null;
  onChange: (id: number | null) => void;
  label: string;
}) {
  const cityHotels = hotels.filter((h) => h.city.toLowerCase().includes(city.toLowerCase()));
  return (
    <div>
      <label className="block text-sm font-medium text-foreground mb-2">{label}</label>
      <div className="relative">
        <select
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
          className="w-full appearance-none pl-4 pr-10 py-3 rounded-xl border border-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500 transition"
        >
          <option value="">Select hotel (optional)</option>
          {cityHotels.map((h) => (
            <option key={h.id} value={h.id}>
              {h.name} {h.stars ? `(${h.stars}★)` : ""} {h.distanceFromHaram ? `— ${h.distanceFromHaram}` : ""}
            </option>
          ))}
        </select>
        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
      </div>
    </div>
  );
}

export function CustomizePackageSection() {
  const [form, setForm] = useState({
    departureDate: "",
    returnDate: "",
    makkahHotelId: null as number | null,
    madinahHotelId: null as number | null,
    transportType: "",
    adults: 1,
    children: 0,
    infants: 0,
    contactName: "",
    contactPhone: "",
    notes: "",
  });
  const [submitted, setSubmitted] = useState(false);
  const [refNumber, setRefNumber] = useState("");

  const { data: hotels = [] } = useQuery<HotelOption[]>({
    queryKey: ["public-hotels"],
    queryFn: () => fetch("/api/public/hotels").then((r) => r.json()),
    staleTime: 10 * 60 * 1000,
  });

  const mutation = useMutation({
    mutationFn: async (body: typeof form & { makkahHotelId: number | null; madinahHotelId: number | null }) => {
      const res = await fetch("/api/public/package-inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Submission failed");
      return res.json() as Promise<{ referenceNumber: string }>;
    },
    onSuccess: (data) => {
      setRefNumber(data.referenceNumber);
      setSubmitted(true);
    },
  });

  const update = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((prev) => ({ ...prev, [k]: v }));

  if (submitted) {
    return (
      <section id="customize" className="py-20 bg-white">
        <div className="container mx-auto px-4 md:px-6 max-w-xl text-center">
          <div className="w-16 h-16 rounded-full bg-teal-50 flex items-center justify-center mx-auto mb-6">
            <Check className="h-8 w-8 text-teal-600" />
          </div>
          <h3 className="text-2xl font-serif mb-3">Inquiry Received!</h3>
          <p className="text-muted-foreground mb-4">
            Our team will contact you within 24 hours with a personalised quote.
          </p>
          <div className="bg-stone-50 border border-border rounded-xl px-6 py-4 inline-block">
            <p className="text-xs text-muted-foreground">Reference Number</p>
            <p className="text-xl font-mono font-bold text-teal-700">{refNumber}</p>
          </div>
          <button
            className="mt-8 block mx-auto text-sm text-teal-600 hover:underline"
            onClick={() => { setSubmitted(false); setRefNumber(""); setForm({ departureDate: "", returnDate: "", makkahHotelId: null, madinahHotelId: null, transportType: "", adults: 1, children: 0, infants: 0, contactName: "", contactPhone: "", notes: "" }); }}
          >
            Submit another inquiry
          </button>
        </div>
      </section>
    );
  }

  return (
    <section id="customize" className="py-20 bg-white">
      <div className="container mx-auto px-4 md:px-6">
        <div className="grid lg:grid-cols-2 gap-16 items-start">
          {/* Left — copy */}
          <div className="lg:sticky lg:top-24">
            <p className="text-sm font-medium tracking-widest text-teal-600 uppercase mb-3">Tailored for You</p>
            <h2 className="text-3xl md:text-5xl font-serif text-foreground mb-6">
              Build Your Own<br />Umrah Package
            </h2>
            <p className="text-lg text-muted-foreground font-light leading-relaxed mb-8">
              Tell us your dates, preferred hotels, and party size. Our specialists will craft a bespoke itinerary and send you a detailed quotation.
            </p>
            <div className="space-y-4">
              {[
                { icon: Hotel, text: "Choice of 3★–5★ hotels near Haram" },
                { icon: Car, text: "Private or shared transport options" },
                { icon: Users, text: "Packages for families and groups" },
              ].map(({ icon: Icon, text }) => (
                <div key={text} className="flex items-center gap-3 text-muted-foreground">
                  <div className="w-8 h-8 rounded-lg bg-teal-50 flex items-center justify-center shrink-0">
                    <Icon className="h-4 w-4 text-teal-600" />
                  </div>
                  <span className="text-sm">{text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Right — form */}
          <div className="bg-stone-50 rounded-3xl border border-border p-8 space-y-6">
            {/* Dates */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  <Calendar className="inline h-4 w-4 mr-1 -mt-0.5" />
                  Departure Date <span className="text-destructive">*</span>
                </label>
                <input
                  type="date"
                  value={form.departureDate}
                  min={new Date().toISOString().split("T")[0]}
                  onChange={(e) => update("departureDate", e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500 transition"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Return Date</label>
                <input
                  type="date"
                  value={form.returnDate}
                  min={form.departureDate || new Date().toISOString().split("T")[0]}
                  onChange={(e) => update("returnDate", e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500 transition"
                />
              </div>
            </div>

            {/* Hotels */}
            <HotelSelect city="makkah" hotels={hotels} value={form.makkahHotelId} onChange={(v) => update("makkahHotelId", v)} label="Makkah Hotel" />
            <HotelSelect city="madinah" hotels={hotels} value={form.madinahHotelId} onChange={(v) => update("madinahHotelId", v)} label="Madinah Hotel" />

            {/* Transport */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Transport</label>
              <div className="relative">
                <select
                  value={form.transportType}
                  onChange={(e) => update("transportType", e.target.value)}
                  className="w-full appearance-none pl-4 pr-10 py-3 rounded-xl border border-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500 transition"
                >
                  <option value="">No preference</option>
                  <option value="private_car">Private Car / SUV</option>
                  <option value="private_bus">Private Bus</option>
                  <option value="shared_bus">Shared Coach</option>
                  <option value="haramain_train">Haramain High-Speed Train</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              </div>
            </div>

            {/* Pax */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-3">
                <Users className="inline h-4 w-4 mr-1 -mt-0.5" />
                Travellers
              </label>
              <div className="grid grid-cols-3 gap-3">
                {(["adults", "children", "infants"] as const).map((type) => (
                  <div key={type} className="bg-white rounded-xl border border-border p-3 text-center">
                    <p className="text-xs text-muted-foreground capitalize mb-2">{type}</p>
                    <div className="flex items-center justify-center gap-2">
                      <button
                        type="button"
                        onClick={() => update(type, Math.max(type === "adults" ? 1 : 0, form[type] - 1))}
                        className="w-7 h-7 rounded-full border border-border text-muted-foreground hover:bg-stone-100 text-sm font-bold transition"
                      >
                        −
                      </button>
                      <span className="font-bold text-base w-5 text-center">{form[type]}</span>
                      <button
                        type="button"
                        onClick={() => update(type, form[type] + 1)}
                        className="w-7 h-7 rounded-full border border-border text-muted-foreground hover:bg-stone-100 text-sm font-bold transition"
                      >
                        +
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Contact */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Your Name <span className="text-destructive">*</span></label>
                <input
                  type="text"
                  value={form.contactName}
                  onChange={(e) => update("contactName", e.target.value)}
                  placeholder="Full name"
                  className="w-full px-4 py-3 rounded-xl border border-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500 transition"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  <Phone className="inline h-3 w-3 mr-1 -mt-0.5" />
                  Phone / WhatsApp <span className="text-destructive">*</span>
                </label>
                <input
                  type="tel"
                  value={form.contactPhone}
                  onChange={(e) => update("contactPhone", e.target.value)}
                  placeholder="+92 300 000 0000"
                  className="w-full px-4 py-3 rounded-xl border border-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500 transition"
                />
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Special Requests</label>
              <textarea
                value={form.notes}
                onChange={(e) => update("notes", e.target.value)}
                rows={3}
                placeholder="Wheelchair access, connecting rooms, visa assistance…"
                className="w-full px-4 py-3 rounded-xl border border-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500 resize-none transition"
              />
            </div>

            {/* Submit */}
            <button
              onClick={() => {
                if (!form.departureDate || !form.contactName || !form.contactPhone) return;
                mutation.mutate(form);
              }}
              disabled={mutation.isPending || !form.departureDate || !form.contactName || !form.contactPhone}
              className="w-full py-4 rounded-2xl bg-teal-600 text-white font-semibold text-sm hover:bg-teal-700 disabled:opacity-60 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
            >
              {mutation.isPending ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Submitting…</>
              ) : (
                "Request Quotation"
              )}
            </button>
            {mutation.isError && (
              <p className="text-sm text-destructive text-center">Something went wrong. Please try again.</p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
