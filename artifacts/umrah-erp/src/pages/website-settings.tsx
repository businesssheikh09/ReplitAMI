import { useState, useEffect, useRef } from "react";
import { useGetWebsiteConfig, useUpdateWebsiteConfig } from "@workspace/api-client-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { Globe, Save, Loader2, RefreshCw, ExternalLink, Building2, Upload, ImageIcon, Banknote, FileText, PenLine, Trash2 } from "lucide-react";

type ConfigDraft = {
  siteName: string;
  heroBadge: string;
  heroTitle: string;
  heroSubtitle: string;
  aboutTitle: string;
  aboutBody: string;
  packagesTitle: string;
  packagesSubtitle: string;
  contactEmail: string;
  contactPhone: string;
  contactWhatsapp: string;
  announcementBanner: string;
  announcementEnabled: boolean;
};

type BrandingDraft = {
  company_name: string;
  legal_company_name: string;
  logo_url: string;
  print_logo_url: string;
  company_address: string;
  company_ntn: string;
  company_email: string;
  company_phone: string;
  company_whatsapp: string;
  company_website: string;
  bank_name: string;
  bank_account: string;
  bank_iban: string;
  swift_code: string;
  routing_no: string;
  terms_conditions: string;
  print_footer: string;
  signature_name: string;
  signature_title: string;
};

const BRANDING_DEFAULTS: BrandingDraft = {
  company_name: "Al Musafir International",
  legal_company_name: "",
  logo_url: "",
  print_logo_url: "",
  company_address: "",
  company_ntn: "",
  company_email: "",
  company_phone: "",
  company_whatsapp: "",
  company_website: "",
  bank_name: "",
  bank_account: "",
  bank_iban: "",
  swift_code: "",
  routing_no: "",
  terms_conditions: "",
  print_footer: "",
  signature_name: "",
  signature_title: "Reservation Officer",
};

export default function WebsiteSettingsPage() {
  const { toast } = useToast();
  const { token } = useAuth();
  const qc = useQueryClient();
  const { data: config, isLoading } = useGetWebsiteConfig();
  const updateConfig = useUpdateWebsiteConfig({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: ["/api/website-config"] });
        toast({ title: "Website settings saved", description: "Changes are now live on the public website." });
      },
      onError: () => {
        toast({ title: "Failed to save", variant: "destructive" });
      },
    },
  });

  const [draft, setDraft] = useState<ConfigDraft | null>(null);
  const [branding, setBranding] = useState<BrandingDraft>(BRANDING_DEFAULTS);
  const [brandingSaving, setBrandingSaving] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const [printLogoUploading, setPrintLogoUploading] = useState(false);
  const logoRef = useRef<HTMLInputElement>(null);
  const printLogoRef = useRef<HTMLInputElement>(null);

  // Load branding from raw config
  const { data: rawConfig } = useQuery<Record<string, string>>({
    queryKey: ["/api/website-config"],
    queryFn: () => fetch("/api/website-config").then((r) => r.json()),
  });

  useEffect(() => {
    if (config && !draft) {
      setDraft({
        siteName: config.siteName,
        heroBadge: config.heroBadge,
        heroTitle: config.heroTitle,
        heroSubtitle: config.heroSubtitle,
        aboutTitle: config.aboutTitle,
        aboutBody: config.aboutBody,
        packagesTitle: config.packagesTitle,
        packagesSubtitle: config.packagesSubtitle,
        contactEmail: config.contactEmail,
        contactPhone: config.contactPhone,
        contactWhatsapp: config.contactWhatsapp,
        announcementBanner: config.announcementBanner,
        announcementEnabled: config.announcementEnabled,
      });
    }
  }, [config, draft]);

  // Populate branding from raw config when it loads
  useEffect(() => {
    if (rawConfig) {
      setBranding({
        company_name:       rawConfig.company_name       ?? BRANDING_DEFAULTS.company_name,
        legal_company_name: rawConfig.legal_company_name ?? "",
        logo_url:           rawConfig.logo_url           ?? "",
        print_logo_url:     rawConfig.print_logo_url     ?? "",
        company_address:    rawConfig.company_address    ?? "",
        company_ntn:        rawConfig.company_ntn        ?? "",
        company_email:      rawConfig.company_email      ?? "",
        company_phone:      rawConfig.company_phone      ?? "",
        company_whatsapp:   rawConfig.company_whatsapp   ?? "",
        company_website:    rawConfig.company_website    ?? "",
        bank_name:          rawConfig.bank_name          ?? "",
        bank_account:       rawConfig.bank_account       ?? "",
        bank_iban:          rawConfig.bank_iban          ?? "",
        swift_code:         rawConfig.swift_code         ?? "",
        routing_no:         rawConfig.routing_no         ?? "",
        terms_conditions:   rawConfig.terms_conditions   ?? "",
        print_footer:       rawConfig.print_footer       ?? "",
        signature_name:     rawConfig.signature_name     ?? "",
        signature_title:    rawConfig.signature_title    ?? BRANDING_DEFAULTS.signature_title,
      });
    }
  }, [rawConfig]);

  const setB = (field: keyof BrandingDraft, value: string) =>
    setBranding(prev => ({ ...prev, [field]: value }));

  const handleSaveBranding = async () => {
    setBrandingSaving(true);
    try {
      await fetch("/api/website-config", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(branding),
      });
      qc.invalidateQueries({ queryKey: ["/api/website-config"] });
      toast({ title: "Company branding saved", description: "Print templates will now use these details." });
    } catch {
      toast({ title: "Save failed", variant: "destructive" });
    } finally {
      setBrandingSaving(false);
    }
  };

  async function uploadLogo(file: File, field: "logo_url" | "print_logo_url") {
    const MAX_SIZE = 2 * 1024 * 1024; // 2 MB
    const ALLOWED = ["image/png", "image/jpeg", "image/jpg", "image/svg+xml", "image/webp"];
    if (!ALLOWED.includes(file.type)) {
      toast({ title: "Invalid file type", description: "Please upload a PNG, JPG, SVG, or WebP image.", variant: "destructive" });
      return;
    }
    if (file.size > MAX_SIZE) {
      toast({ title: "File too large", description: "Maximum logo size is 2 MB.", variant: "destructive" });
      return;
    }
    const setState = field === "logo_url" ? setLogoUploading : setPrintLogoUploading;
    setState(true);
    try {
      const res = await fetch("/api/storage/uploads/request-url", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type }),
      });
      if (!res.ok) throw new Error("Failed to get upload URL");
      const { uploadURL, objectPath } = await res.json() as { uploadURL: string; objectPath: string };
      const putRes = await fetch(uploadURL, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
      if (!putRes.ok) throw new Error("Upload to storage failed");
      // objectPath is like /objects/<uuid>; serve via the private objects endpoint (no auth required)
      const serveUrl = `/api/storage/objects/${objectPath.replace(/^\/objects\//, "")}`;
      setB(field, serveUrl);
      toast({ title: "Logo uploaded", description: "Click 'Save Branding' to apply." });
    } catch {
      toast({ title: "Upload failed", description: "Could not store the logo. Please try again.", variant: "destructive" });
    } finally {
      setState(false);
    }
  }

  const set = (field: keyof ConfigDraft, value: string | boolean) =>
    setDraft(prev => prev ? { ...prev, [field]: value } : prev);

  const handleSave = () => {
    if (!draft) return;
    updateConfig.mutate({ data: draft });
  };

  const handleReset = () => {
    if (config) {
      setDraft({
        siteName: config.siteName,
        heroBadge: config.heroBadge,
        heroTitle: config.heroTitle,
        heroSubtitle: config.heroSubtitle,
        aboutTitle: config.aboutTitle,
        aboutBody: config.aboutBody,
        packagesTitle: config.packagesTitle,
        packagesSubtitle: config.packagesSubtitle,
        contactEmail: config.contactEmail,
        contactPhone: config.contactPhone,
        contactWhatsapp: config.contactWhatsapp,
        announcementBanner: config.announcementBanner,
        announcementEnabled: config.announcementEnabled,
      });
    }
  };

  if (isLoading || !draft) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-3xl">

      {/* ══════════════════════════════════════════════════════════════
          SECTION 1 — COMPANY BRANDING (ERP internal, used in print)
      ══════════════════════════════════════════════════════════════ */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Building2 className="h-5 w-5 text-blue-700" />
              Company Branding
            </h2>
            <p className="text-muted-foreground text-sm mt-0.5">Appears on all printed documents — vouchers, invoices, hotel bookings.</p>
          </div>
          <Button onClick={handleSaveBranding} disabled={brandingSaving}>
            {brandingSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Save Branding
          </Button>
        </div>

        {/* Logo upload */}
        <Card className="mb-4">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><ImageIcon className="h-4 w-4" /> Logos</CardTitle>
            <CardDescription>Upload your company logo for print documents. PNG or JPG recommended.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Main logo */}
              <div className="space-y-2">
                <Label>Website &amp; Print Logo</Label>
                <div className="flex items-center gap-3 flex-wrap">
                  {branding.logo_url ? (
                    <img src={branding.logo_url} alt="Logo" className="h-12 max-w-[120px] object-contain border rounded bg-gray-50" />
                  ) : (
                    <div className="h-12 w-24 bg-gray-100 border rounded flex items-center justify-center text-xs text-muted-foreground">No logo</div>
                  )}
                  <div className="flex gap-2">
                    <input ref={logoRef} type="file" accept="image/png,image/jpeg,image/jpg,image/svg+xml,image/webp" className="hidden"
                      onChange={e => { if (e.target.files?.[0]) { uploadLogo(e.target.files[0], "logo_url"); e.target.value = ""; } }} />
                    <Button size="sm" variant="outline" onClick={() => logoRef.current?.click()} disabled={logoUploading}>
                      {logoUploading ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Upload className="h-3.5 w-3.5 mr-1" />}
                      Upload
                    </Button>
                    {branding.logo_url && (
                      <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setB("logo_url", "")} title="Remove logo">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
                <Input className="text-xs" placeholder="Or paste a direct image URL…" value={branding.logo_url} onChange={e => setB("logo_url", e.target.value)} />
                <p className="text-xs text-muted-foreground">PNG, JPG, SVG or WebP · max 2 MB</p>
              </div>
              {/* Print logo override */}
              <div className="space-y-2">
                <Label>Print-Only Logo <span className="text-xs text-muted-foreground">(optional — overrides above for printed documents)</span></Label>
                <div className="flex items-center gap-3 flex-wrap">
                  {branding.print_logo_url ? (
                    <img src={branding.print_logo_url} alt="Print Logo" className="h-12 max-w-[120px] object-contain border rounded bg-gray-50" />
                  ) : (
                    <div className="h-12 w-24 bg-gray-100 border rounded flex items-center justify-center text-xs text-muted-foreground">Same as above</div>
                  )}
                  <div className="flex gap-2">
                    <input ref={printLogoRef} type="file" accept="image/png,image/jpeg,image/jpg,image/svg+xml,image/webp" className="hidden"
                      onChange={e => { if (e.target.files?.[0]) { uploadLogo(e.target.files[0], "print_logo_url"); e.target.value = ""; } }} />
                    <Button size="sm" variant="outline" onClick={() => printLogoRef.current?.click()} disabled={printLogoUploading}>
                      {printLogoUploading ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Upload className="h-3.5 w-3.5 mr-1" />}
                      Upload
                    </Button>
                    {branding.print_logo_url && (
                      <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setB("print_logo_url", "")} title="Remove print logo">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
                <Input className="text-xs" placeholder="Or paste a direct image URL…" value={branding.print_logo_url} onChange={e => setB("print_logo_url", e.target.value)} />
                <p className="text-xs text-muted-foreground">Use a high-res version for sharp print output</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Company identity */}
        <Card className="mb-4">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><Building2 className="h-4 w-4" /> Company Identity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Company Name <span className="text-xs text-muted-foreground">(shown on documents)</span></Label>
                <Input value={branding.company_name} onChange={e => setB("company_name", e.target.value)} placeholder="Al Musafir International" />
              </div>
              <div className="space-y-2">
                <Label>Legal / Registered Name</Label>
                <Input value={branding.legal_company_name} onChange={e => setB("legal_company_name", e.target.value)} placeholder="Al Musafir International (Pvt.) Ltd." />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Address</Label>
                <Textarea rows={2} value={branding.company_address} onChange={e => setB("company_address", e.target.value)} placeholder="Office No. 5, 2nd Floor, Gulberg Plaza, Lahore" />
              </div>
              <div className="space-y-2">
                <Label>NTN</Label>
                <Input value={branding.company_ntn} onChange={e => setB("company_ntn", e.target.value)} placeholder="1234567-8" />
              </div>
              <div className="space-y-2">
                <Label>Website</Label>
                <Input value={branding.company_website} onChange={e => setB("company_website", e.target.value)} placeholder="www.almusafir.pk" />
              </div>
              <div className="space-y-2">
                <Label>Company Email</Label>
                <Input type="email" value={branding.company_email} onChange={e => setB("company_email", e.target.value)} placeholder="info@almusafir.pk" />
              </div>
              <div className="space-y-2">
                <Label>Company Phone</Label>
                <Input value={branding.company_phone} onChange={e => setB("company_phone", e.target.value)} placeholder="+92 42 1234 5678" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Bank details */}
        <Card className="mb-4">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><Banknote className="h-4 w-4" /> Bank Details</CardTitle>
            <CardDescription>Shown on invoices and payment vouchers.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Bank Name</Label>
                <Input value={branding.bank_name} onChange={e => setB("bank_name", e.target.value)} placeholder="Meezan Bank Ltd" />
              </div>
              <div className="space-y-2">
                <Label>Account No.</Label>
                <Input value={branding.bank_account} onChange={e => setB("bank_account", e.target.value)} placeholder="0123456789" />
              </div>
              <div className="space-y-2">
                <Label>IBAN</Label>
                <Input value={branding.bank_iban} onChange={e => setB("bank_iban", e.target.value)} placeholder="PK36MEZN0001234567890100" />
              </div>
              <div className="space-y-2">
                <Label>SWIFT / BIC Code</Label>
                <Input value={branding.swift_code} onChange={e => setB("swift_code", e.target.value)} placeholder="MEZNPKKA" />
              </div>
              <div className="space-y-2">
                <Label>Routing No.</Label>
                <Input value={branding.routing_no} onChange={e => setB("routing_no", e.target.value)} placeholder="012345" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Terms, footer, signature */}
        <Card className="mb-4">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><PenLine className="h-4 w-4" /> Document Footer &amp; Signature</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Terms &amp; Conditions <span className="text-xs text-muted-foreground">(printed on invoices)</span></Label>
              <Textarea rows={4} value={branding.terms_conditions} onChange={e => setB("terms_conditions", e.target.value)} placeholder="1. All payments are non-refundable once confirmed.&#10;2. Passport validity of 6 months required…" />
            </div>
            <div className="space-y-2">
              <Label>Print Footer Text</Label>
              <Input value={branding.print_footer} onChange={e => setB("print_footer", e.target.value)} placeholder="Thank you for choosing Al Musafir International · info@almusafir.pk" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Signatory Name</Label>
                <Input value={branding.signature_name} onChange={e => setB("signature_name", e.target.value)} placeholder="Muhammad Aamir" />
              </div>
              <div className="space-y-2">
                <Label>Signatory Title</Label>
                <Input value={branding.signature_title} onChange={e => setB("signature_title", e.target.value)} placeholder="Reservation Officer" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Separator />

      {/* ══════════════════════════════════════════════════════════════
          SECTION 2 — PUBLIC WEBSITE CONTENT
      ══════════════════════════════════════════════════════════════ */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Globe className="h-5 w-5" />
              Website Settings
            </h2>
            <p className="text-muted-foreground text-sm mt-0.5">Edit the public website content. Changes go live instantly.</p>
          </div>
          <div className="flex gap-2">
            <a href="/frontend/" target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="sm">
                <ExternalLink className="h-4 w-4 mr-2" />
                Preview Site
              </Button>
            </a>
            <Button variant="outline" size="sm" onClick={handleReset}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Reset
            </Button>
            <Button onClick={handleSave} disabled={updateConfig.isPending}>
              {updateConfig.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              Save Changes
            </Button>
          </div>
        </div>

      {/* Announcement Banner */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Announcement Banner</CardTitle>
              <CardDescription>Displays a notice at the top of the public website.</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="announcement-toggle" className="text-sm text-muted-foreground">
                {draft.announcementEnabled ? "Visible" : "Hidden"}
              </Label>
              <Switch
                id="announcement-toggle"
                checked={draft.announcementEnabled}
                onCheckedChange={v => set("announcementEnabled", v)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Input
            value={draft.announcementBanner}
            onChange={e => set("announcementBanner", e.target.value)}
            placeholder="e.g. Ramadan special: 15% off all packages — Book before April 30"
          />
        </CardContent>
      </Card>

      {/* Brand & Site Identity */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Brand Identity</CardTitle>
          <CardDescription>The site name shown in the navbar and browser tab.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label>Site / Brand Name</Label>
            <Input value={draft.siteName} onChange={e => set("siteName", e.target.value)} placeholder="Noor Al-Haram" />
          </div>
        </CardContent>
      </Card>

      {/* Hero Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            Hero Section
            <Badge variant="outline" className="text-xs font-normal">Full-screen banner at the top</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Badge Text <span className="text-xs text-muted-foreground">(small label above headline)</span></Label>
            <Input value={draft.heroBadge} onChange={e => set("heroBadge", e.target.value)} placeholder="Sacred Journeys from Pakistan" />
          </div>
          <div className="space-y-2">
            <Label>Headline</Label>
            <Input value={draft.heroTitle} onChange={e => set("heroTitle", e.target.value)} placeholder="Answer the call to the House of Allah." />
          </div>
          <div className="space-y-2">
            <Label>Subheadline</Label>
            <Textarea rows={3} value={draft.heroSubtitle} onChange={e => set("heroSubtitle", e.target.value)} placeholder="Curated Umrah experiences..." />
          </div>
        </CardContent>
      </Card>

      {/* About Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            About / Our Promise Section
            <Badge variant="outline" className="text-xs font-normal">Second section on the page</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Section Title</Label>
            <Input value={draft.aboutTitle} onChange={e => set("aboutTitle", e.target.value)} placeholder="Your worship is your only focus." />
          </div>
          <div className="space-y-2">
            <Label>Body Text</Label>
            <Textarea rows={4} value={draft.aboutBody} onChange={e => set("aboutBody", e.target.value)} placeholder="Describe the agency's mission..." />
          </div>
        </CardContent>
      </Card>

      {/* Packages Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            Packages Section Header
            <Badge variant="outline" className="text-xs font-normal">Above the package cards</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Section Title</Label>
            <Input value={draft.packagesTitle} onChange={e => set("packagesTitle", e.target.value)} placeholder="Curated Journeys" />
          </div>
          <div className="space-y-2">
            <Label>Section Subtitle</Label>
            <Textarea rows={2} value={draft.packagesSubtitle} onChange={e => set("packagesSubtitle", e.target.value)} placeholder="Carefully structured packages..." />
          </div>
        </CardContent>
      </Card>

      <Separator />

      {/* Contact Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Contact Information</CardTitle>
          <CardDescription>Shown in the website footer and contact sections.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Email Address</Label>
              <Input type="email" value={draft.contactEmail} onChange={e => set("contactEmail", e.target.value)} placeholder="info@nooralharam.com" />
            </div>
            <div className="space-y-2">
              <Label>Phone Number</Label>
              <Input value={draft.contactPhone} onChange={e => set("contactPhone", e.target.value)} placeholder="+92 21 3456 7890" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>WhatsApp Number <span className="text-xs text-muted-foreground">(with country code, no spaces)</span></Label>
            <Input value={draft.contactWhatsapp} onChange={e => set("contactWhatsapp", e.target.value)} placeholder="+923001234567" />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end pb-8">
        <Button onClick={handleSave} disabled={updateConfig.isPending} size="lg">
          {updateConfig.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          Save All Changes
        </Button>
      </div>
      </div>{/* end Section 2 */}
    </div>
  );
}
