import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { Check, ArrowLeft, Loader2, CheckCircle2, Phone, Calendar, Users } from "lucide-react";
import { Navbar } from "@/components/navbar";

const PACKAGES = [
  {
    id: "economy",
    name: "Noor Economy",
    tagline: "A comfortable and accessible journey focusing on the essentials.",
    duration: "10-14 Days",
    price: "250,000",
    badge: null,
    accent: "emerald",
    features: [
      "3-Star Hotels near Haram",
      "Shared Transport included",
      "Visa processing assistance",
      "Guided Ziyarat in both cities",
    ],
    description: `Our Noor Economy package is crafted for pilgrims who seek a complete, dignified Umrah experience at the most accessible price point. You'll stay in 3-star hotels within walking distance of Masjid al-Haram in Makkah and a short ride from Masjid an-Nabawi in Madinah. Shared AC coaches handle all transfers, and our guides lead you through every Ziyarat site with care and knowledge.`,
    inclusions: [
      "Return airfare (group flight)",
      "Visa processing fee",
      "3-star accommodation — Makkah & Madinah",
      "Shared AC transport throughout",
      "Guided Ziyarat — both cities",
      "24/7 group leader support",
    ],
    exclusions: [
      "Meals (self-catered)",
      "Personal shopping and expenses",
      "Travel insurance",
    ],
  },
  {
    id: "standard",
    name: "Barakah Standard",
    tagline: "Enhanced comfort and longer stays for a deeply reflective trip.",
    duration: "14-21 Days",
    price: "350,000",
    badge: "Most Popular",
    accent: "teal",
    features: [
      "4-Star Hotels with easy access",
      "Dedicated AC bus transfers",
      "Daily breakfast included",
      "Comprehensive Ziyarat tours",
      "Complimentary Ihram kits",
    ],
    description: `The Barakah Standard is our most popular package — and for good reason. It strikes the perfect balance between comfort and value. Stay in 4-star hotels close to both Harams, enjoy daily breakfast, and travel in dedicated AC coaches reserved exclusively for your group. The comprehensive Ziyarat programme covers all major historical and spiritual sites in both cities, and every pilgrim receives a complimentary Ihram kit on arrival.`,
    inclusions: [
      "Return airfare (group flight)",
      "Visa processing fee",
      "4-star accommodation — Makkah & Madinah",
      "Dedicated group AC bus transfers",
      "Daily breakfast",
      "Comprehensive Ziyarat programme",
      "Complimentary Ihram kit",
      "24/7 group leader support",
    ],
    exclusions: [
      "Lunch and dinner",
      "Personal shopping and expenses",
      "Travel insurance",
    ],
  },
  {
    id: "premium",
    name: "Haramain Premium",
    tagline: "Exceptional quality and proximity for a seamless spiritual retreat.",
    duration: "14-21 Days",
    price: "550,000",
    badge: null,
    accent: "amber",
    features: [
      "5-Star Hotels walking distance to Haram",
      "Half-board meals (Breakfast & Dinner)",
      "High-speed train (Makkah-Madinah)",
      "Premium AC transport",
      "Dedicated group scholar (Alim)",
    ],
    description: `Haramain Premium is for the pilgrim who seeks exceptional comfort without compromise. Your hotel is steps from Masjid al-Haram, offering breathtaking proximity for Fajr and Tahajjud prayers. Travel between Makkah and Madinah in luxury on the Haramain High-Speed Railway, enjoy half-board dining, and benefit from the knowledge and guidance of a dedicated group Alim throughout your journey.`,
    inclusions: [
      "Return airfare (group flight)",
      "Visa processing fee",
      "5-star accommodation — Makkah & Madinah",
      "Haramain High-Speed Rail (Makkah–Madinah)",
      "Premium AC transport",
      "Half-board meals (breakfast & dinner)",
      "Dedicated group Alim",
      "Extended Ziyarat programme",
      "24/7 senior group leader",
    ],
    exclusions: [
      "Lunch",
      "Personal shopping and expenses",
      "Travel insurance",
    ],
  },
  {
    id: "vip",
    name: "Firdous VIP",
    tagline: "Uncompromising luxury and privacy for an exclusive experience.",
    duration: "7-21 Days",
    price: "850,000",
    badge: "Exclusive",
    accent: "purple",
    features: [
      "Luxury suites with Haram view options",
      "Private GMC/SUV transfers",
      "Full-board premium dining",
      "Personal guide and dedicated support",
      "Fast-track processing & exclusive lounge",
    ],
    description: `Firdous VIP is designed for those who wish to perform Umrah in complete privacy and luxury. You'll be accommodated in luxury suites — many with direct Haram views — and transported exclusively in private GMC SUVs. A dedicated personal guide accompanies you at every step, and full-board premium dining means every meal is taken care of. Fast-track processing and exclusive lounge access ensure your journey begins and ends in comfort.`,
    inclusions: [
      "Return airfare (business or premium economy)",
      "Visa processing — fast-track service",
      "Luxury suite accommodation — Makkah & Madinah",
      "Private GMC/SUV transfers throughout",
      "Full-board premium dining",
      "Personal dedicated guide",
      "Exclusive airport lounge access",
      "Flexible travel dates (7–21 days)",
      "24/7 private concierge",
    ],
    exclusions: [
      "Personal shopping",
      "Travel insurance",
    ],
  },
];

export default function PackageDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();

  const pkg = PACKAGES.find((p) => p.id === id);

  const [form, setForm] = useState({
    contactName: "",
    contactPhone: "",
    email: "",
    adults: "2",
    children: "0",
    infants: "0",
    departureDate: "",
    returnDate: "",
    message: "",
  });
  const [submitted, setSubmitted] = useState(false);
  const [refNumber, setRefNumber] = useState("");

  const mutation = useMutation({
    mutationFn: async () => {
      const notes = [
        `Package: ${pkg?.name ?? id}`,
        form.email ? `Email: ${form.email}` : null,
        form.message ? `Message: ${form.message}` : null,
      ].filter(Boolean).join("\n");

      const res = await fetch("/api/public/package-inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contactName: form.contactName,
          contactPhone: form.contactPhone,
          departureDate: form.departureDate,
          returnDate: form.returnDate || undefined,
          adults: Number(form.adults) || 1,
          children: Number(form.children) || 0,
          infants: Number(form.infants) || 0,
          notes,
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

  const f = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }));

  const valid = form.contactName.trim() && form.contactPhone.trim() && form.departureDate;

  if (!pkg) return (
    <div className="min-h-screen flex flex-col items-center justify-center text-muted-foreground gap-3">
      <p>Package not found.</p>
      <button onClick={() => navigate("/")} className="text-primary hover:underline text-sm">← Back to packages</button>
    </div>
  );

  const accentClasses: Record<string, { bg: string; text: string; border: string; btn: string; badge: string }> = {
    emerald: {
      bg: "bg-emerald-50",
      text: "text-emerald-700",
      border: "border-emerald-200",
      btn: "bg-emerald-700 hover:bg-emerald-800",
      badge: "bg-emerald-100 text-emerald-800",
    },
    teal: {
      bg: "bg-teal-50",
      text: "text-teal-700",
      border: "border-teal-200",
      btn: "bg-teal-700 hover:bg-teal-800",
      badge: "bg-teal-100 text-teal-800",
    },
    amber: {
      bg: "bg-amber-50",
      text: "text-amber-700",
      border: "border-amber-200",
      btn: "bg-amber-700 hover:bg-amber-800",
      badge: "bg-amber-100 text-amber-800",
    },
    purple: {
      bg: "bg-purple-50",
      text: "text-purple-700",
      border: "border-purple-200",
      btn: "bg-purple-700 hover:bg-purple-800",
      badge: "bg-purple-100 text-purple-800",
    },
  };

  const ac = accentClasses[pkg.accent] ?? accentClasses.teal;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Hero */}
      <div className={`pt-32 pb-16 ${ac.bg}`}>
        <div className="container mx-auto px-4 md:px-6 max-w-5xl">
          <button
            onClick={() => navigate("/#packages")}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" /> All Packages
          </button>

          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              {pkg.badge && (
                <span className={`inline-block text-xs font-semibold px-3 py-1 rounded-full mb-3 ${ac.badge}`}>
                  {pkg.badge}
                </span>
              )}
              <h1 className="text-4xl md:text-5xl font-serif text-foreground mb-2">{pkg.name}</h1>
              <p className={`text-lg font-medium ${ac.text} mb-1`}>{pkg.duration}</p>
              <p className="text-muted-foreground max-w-xl mt-2">{pkg.tagline}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Starting from</p>
              <div className="flex items-baseline gap-1 justify-end">
                <span className="text-sm font-medium text-muted-foreground">PKR</span>
                <span className="text-4xl font-bold text-foreground">{pkg.price}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">per person</p>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 md:px-6 max-w-5xl py-16">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">

          {/* Left column — details */}
          <div className="lg:col-span-2 space-y-10">

            {/* Description */}
            <div>
              <h2 className="text-2xl font-serif text-foreground mb-4">About this Package</h2>
              <p className="text-muted-foreground leading-relaxed">{pkg.description}</p>
            </div>

            {/* Highlights */}
            <div>
              <h2 className="text-2xl font-serif text-foreground mb-4">Package Highlights</h2>
              <ul className="space-y-3">
                {pkg.features.map((f, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <div className={`mt-0.5 w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${ac.bg} ${ac.border} border`}>
                      <Check className={`h-3 w-3 ${ac.text}`} />
                    </div>
                    <span className="text-foreground/80">{f}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Inclusions & Exclusions */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
              <div>
                <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                  <span className="text-green-600">✓</span> What's Included
                </h3>
                <ul className="space-y-2">
                  {pkg.inclusions.map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <Check className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                  <span className="text-red-400">✕</span> Not Included
                </h3>
                <ul className="space-y-2">
                  {pkg.exclusions.map((item, i) => (
                    <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                      <span className="text-red-400 shrink-0 mt-0.5">✕</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          {/* Right column — inquiry form */}
          <div className="lg:col-span-1">
            <div className={`sticky top-24 rounded-2xl border ${ac.border} bg-card shadow-sm overflow-hidden`}>
              {submitted ? (
                <div className="p-8 text-center">
                  <div className={`w-14 h-14 rounded-full ${ac.bg} flex items-center justify-center mx-auto mb-4`}>
                    <CheckCircle2 className={`h-7 w-7 ${ac.text}`} />
                  </div>
                  <h3 className="font-serif text-xl text-foreground mb-2">Inquiry Sent!</h3>
                  <p className="text-sm text-muted-foreground mb-5">
                    Thank you — we'll be in touch within 24 hours to discuss your journey.
                  </p>
                  <div className={`${ac.bg} rounded-xl px-6 py-4 mb-6`}>
                    <p className="text-xs text-muted-foreground mb-1">Reference</p>
                    <p className="text-lg font-mono font-bold text-foreground">{refNumber}</p>
                  </div>
                  <button
                    onClick={() => { setSubmitted(false); setForm({ contactName: "", contactPhone: "", email: "", adults: "2", children: "0", infants: "0", departureDate: "", returnDate: "", message: "" }); }}
                    className="text-sm text-muted-foreground hover:text-foreground underline"
                  >
                    Send another inquiry
                  </button>
                </div>
              ) : (
                <>
                  <div className={`${ac.bg} px-6 py-4 border-b ${ac.border}`}>
                    <h3 className="font-semibold text-foreground">Inquire About This Package</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">We'll get back to you within 24 hours</p>
                  </div>
                  <div className="p-6 space-y-4">

                    {/* Name */}
                    <div>
                      <label className="block text-xs font-medium text-foreground mb-1">Full Name *</label>
                      <input
                        type="text"
                        value={form.contactName}
                        onChange={f("contactName")}
                        placeholder="e.g. Muhammad Ahmed"
                        className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                      />
                    </div>

                    {/* Phone */}
                    <div>
                      <label className="block text-xs font-medium text-foreground mb-1 flex items-center gap-1">
                        <Phone className="h-3 w-3" /> Phone / WhatsApp *
                      </label>
                      <input
                        type="tel"
                        value={form.contactPhone}
                        onChange={f("contactPhone")}
                        placeholder="+92 300 1234567"
                        className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                      />
                    </div>

                    {/* Email */}
                    <div>
                      <label className="block text-xs font-medium text-foreground mb-1">Email (optional)</label>
                      <input
                        type="email"
                        value={form.email}
                        onChange={f("email")}
                        placeholder="email@example.com"
                        className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                      />
                    </div>

                    {/* Pax */}
                    <div>
                      <label className="block text-xs font-medium text-foreground mb-1 flex items-center gap-1">
                        <Users className="h-3 w-3" /> Pilgrims
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        {(["adults", "children", "infants"] as const).map((type) => (
                          <div key={type}>
                            <label className="block text-xs text-muted-foreground mb-1 capitalize">{type}</label>
                            <input
                              type="number"
                              min="0"
                              value={form[type]}
                              onChange={f(type)}
                              className="w-full px-2 py-2 rounded-xl border border-border bg-background text-sm text-center focus:outline-none focus:ring-2 focus:ring-primary/30"
                            />
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Dates */}
                    <div>
                      <label className="block text-xs font-medium text-foreground mb-1 flex items-center gap-1">
                        <Calendar className="h-3 w-3" /> Departure Date *
                      </label>
                      <input
                        type="date"
                        value={form.departureDate}
                        onChange={f("departureDate")}
                        min={new Date().toISOString().slice(0, 10)}
                        className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-foreground mb-1">Return Date (optional)</label>
                      <input
                        type="date"
                        value={form.returnDate}
                        onChange={f("returnDate")}
                        min={form.departureDate || new Date().toISOString().slice(0, 10)}
                        className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                      />
                    </div>

                    {/* Message */}
                    <div>
                      <label className="block text-xs font-medium text-foreground mb-1">Message (optional)</label>
                      <textarea
                        value={form.message}
                        onChange={f("message")}
                        rows={3}
                        placeholder="Any special requirements or questions..."
                        className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                      />
                    </div>

                    <button
                      onClick={() => valid && mutation.mutate()}
                      disabled={mutation.isPending || !valid}
                      className={`w-full py-3 rounded-xl text-white font-semibold text-sm transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${ac.btn}`}
                    >
                      {mutation.isPending
                        ? <><Loader2 className="h-4 w-4 animate-spin" /> Sending…</>
                        : "Send Inquiry"}
                    </button>

                    {mutation.isError && (
                      <p className="text-xs text-destructive text-center">Something went wrong — please try again.</p>
                    )}

                    <p className="text-xs text-muted-foreground text-center">
                      No payment required now. Our team will confirm availability and pricing.
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
