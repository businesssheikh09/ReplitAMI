import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Building2, CreditCard, Printer, FileText, Globe, Loader2, Save } from "lucide-react";
import { Separator } from "@/components/ui/separator";

const CURRENCIES = ["SAR", "USD", "PKR", "GBP", "EUR", "AED", "OMR", "KWD", "QAR"];

function useConfig() {
  const { token } = useAuth();
  return useQuery<Record<string, any>>({
    queryKey: ["/api/website-config"],
    queryFn: () =>
      fetch("/api/website-config", {
        headers: { Authorization: `Bearer ${token}` },
      }).then((r) => r.json()),
    staleTime: 30_000,
  });
}

function useSaveConfig() {
  const { token } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      fetch("/api/website-config", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      }).then((r) => {
        if (!r.ok) throw new Error("Failed to save");
        return r.json();
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/website-config"] });
      toast({ title: "Settings saved" });
    },
    onError: () => toast({ title: "Failed to save settings", variant: "destructive" }),
  });
}

function Field({
  label, hint, children,
}: {
  label: string; hint?: string; children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium">{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function TextArea({
  value, onChange, placeholder, rows = 4,
}: {
  value: string; onChange: (v: string) => void; placeholder?: string; rows?: number;
}) {
  return (
    <textarea
      className="w-full px-3 py-2 text-sm border rounded-md resize-y focus:outline-none focus:ring-2 focus:ring-ring min-h-[80px]"
      rows={rows}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
    />
  );
}

export default function ErpSettingsPage() {
  const { data: config, isLoading } = useConfig();
  const save = useSaveConfig();

  // ── Company ──────────────────────────────────────────────────────────────
  const [company, setCompany] = useState({
    company_name: "",
    legal_company_name: "",
    company_address: "",
    company_ntn: "",
    company_email: "",
    company_phone: "",
    company_whatsapp: "",
    company_website: "",
    logo_url: "",
    print_logo_url: "",
  });

  // ── Quotation Defaults ───────────────────────────────────────────────────
  const [quotation, setQuotation] = useState({
    quotation_default_currency: "SAR",
    quotation_default_validity_days: "7",
    quotation_default_terms: "",
    quotation_default_notes: "",
  });

  // ── Banking ──────────────────────────────────────────────────────────────
  const [banking, setBanking] = useState({
    bank_name: "",
    bank_account: "",
    bank_iban: "",
    swift_code: "",
    routing_no: "",
  });

  // ── Print & Signature ────────────────────────────────────────────────────
  const [print, setPrint] = useState({
    signature_name: "",
    signature_title: "",
    print_footer: "",
    terms_conditions: "",
  });

  // Populate from fetched config
  useEffect(() => {
    if (!config) return;
    setCompany({
      company_name: config.company_name ?? "",
      legal_company_name: config.legal_company_name ?? "",
      company_address: config.company_address ?? "",
      company_ntn: config.company_ntn ?? "",
      company_email: config.company_email ?? "",
      company_phone: config.company_phone ?? "",
      company_whatsapp: config.company_whatsapp ?? "",
      company_website: config.company_website ?? "",
      logo_url: config.logo_url ?? "",
      print_logo_url: config.print_logo_url ?? "",
    });
    setQuotation({
      quotation_default_currency: config.quotation_default_currency ?? "SAR",
      quotation_default_validity_days: config.quotation_default_validity_days ?? "7",
      quotation_default_terms: config.quotation_default_terms ?? "",
      quotation_default_notes: config.quotation_default_notes ?? "",
    });
    setBanking({
      bank_name: config.bank_name ?? "",
      bank_account: config.bank_account ?? "",
      bank_iban: config.bank_iban ?? "",
      swift_code: config.swift_code ?? "",
      routing_no: config.routing_no ?? "",
    });
    setPrint({
      signature_name: config.signature_name ?? "",
      signature_title: config.signature_title ?? "",
      print_footer: config.print_footer ?? "",
      terms_conditions: config.terms_conditions ?? "",
    });
  }, [config]);

  function saveCompany() { save.mutate(company); }
  function saveQuotation() { save.mutate(quotation); }
  function saveBanking() { save.mutate(banking); }
  function savePrint() { save.mutate(print); }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground gap-2">
        <Loader2 className="h-5 w-5 animate-spin" /> Loading settings…
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">ERP Settings</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Manage company information, quotation defaults, banking details, and print configuration.
        </p>
      </div>

      <Tabs defaultValue="company">
        <TabsList className="grid grid-cols-4 w-full">
          <TabsTrigger value="company" className="gap-2">
            <Building2 className="h-4 w-4" /> Company
          </TabsTrigger>
          <TabsTrigger value="quotations" className="gap-2">
            <FileText className="h-4 w-4" /> Quotations
          </TabsTrigger>
          <TabsTrigger value="banking" className="gap-2">
            <CreditCard className="h-4 w-4" /> Banking
          </TabsTrigger>
          <TabsTrigger value="print" className="gap-2">
            <Printer className="h-4 w-4" /> Print & Signature
          </TabsTrigger>
        </TabsList>

        {/* ── Company Tab ─────────────────────────────────────────────────── */}
        <TabsContent value="company">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-teal-600" /> Company Information
              </CardTitle>
              <CardDescription>
                This information appears on all quotations, invoices, and printed documents.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <Field label="Company Name" hint="Shown on all documents">
                  <Input
                    value={company.company_name}
                    onChange={(e) => setCompany((p) => ({ ...p, company_name: e.target.value }))}
                    placeholder="Al Musafir International"
                  />
                </Field>
                <Field label="Legal / Registered Name" hint="Full legal name for official documents">
                  <Input
                    value={company.legal_company_name}
                    onChange={(e) => setCompany((p) => ({ ...p, legal_company_name: e.target.value }))}
                    placeholder="Al Musafir International Pvt. Ltd."
                  />
                </Field>
              </div>

              <Field label="Company Address">
                <TextArea
                  rows={3}
                  value={company.company_address}
                  onChange={(v) => setCompany((p) => ({ ...p, company_address: v }))}
                  placeholder="Office 12, 3rd Floor, Plaza Name, City, Country"
                />
              </Field>

              <div className="grid grid-cols-2 gap-4">
                <Field label="NTN / Tax Number">
                  <Input
                    value={company.company_ntn}
                    onChange={(e) => setCompany((p) => ({ ...p, company_ntn: e.target.value }))}
                    placeholder="1234567-8"
                  />
                </Field>
                <Field label="Website">
                  <Input
                    value={company.company_website}
                    onChange={(e) => setCompany((p) => ({ ...p, company_website: e.target.value }))}
                    placeholder="https://almusafir.com"
                  />
                </Field>
              </div>

              <Separator />

              <div className="grid grid-cols-3 gap-4">
                <Field label="Email">
                  <Input
                    type="email"
                    value={company.company_email}
                    onChange={(e) => setCompany((p) => ({ ...p, company_email: e.target.value }))}
                    placeholder="info@almusafir.com"
                  />
                </Field>
                <Field label="Phone">
                  <Input
                    value={company.company_phone}
                    onChange={(e) => setCompany((p) => ({ ...p, company_phone: e.target.value }))}
                    placeholder="+92 21 3456 7890"
                  />
                </Field>
                <Field label="WhatsApp">
                  <Input
                    value={company.company_whatsapp}
                    onChange={(e) => setCompany((p) => ({ ...p, company_whatsapp: e.target.value }))}
                    placeholder="+923001234567"
                  />
                </Field>
              </div>

              <Separator />

              <div className="grid grid-cols-2 gap-4">
                <Field label="Logo URL" hint="Used on the public website">
                  <Input
                    value={company.logo_url}
                    onChange={(e) => setCompany((p) => ({ ...p, logo_url: e.target.value }))}
                    placeholder="https://..."
                  />
                  {company.logo_url && (
                    <img src={company.logo_url} alt="Logo preview" className="h-12 mt-2 object-contain rounded border" />
                  )}
                </Field>
                <Field label="Print Logo URL" hint="Used on printed quotations & invoices">
                  <Input
                    value={company.print_logo_url}
                    onChange={(e) => setCompany((p) => ({ ...p, print_logo_url: e.target.value }))}
                    placeholder="https://..."
                  />
                  {company.print_logo_url && (
                    <img src={company.print_logo_url} alt="Print logo preview" className="h-12 mt-2 object-contain rounded border" />
                  )}
                </Field>
              </div>

              <div className="flex justify-end pt-2">
                <Button onClick={saveCompany} disabled={save.isPending} className="bg-teal-600 hover:bg-teal-700 text-white gap-2">
                  {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Save Company Info
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Quotations Tab ───────────────────────────────────────────────── */}
        <TabsContent value="quotations">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-teal-600" /> Quotation Defaults
              </CardTitle>
              <CardDescription>
                These values are pre-filled when creating a new quotation. Staff can override them per quotation.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <Field label="Default Currency" hint="Base currency for new quotations">
                  <Select
                    value={quotation.quotation_default_currency}
                    onValueChange={(v) => setQuotation((p) => ({ ...p, quotation_default_currency: v }))}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CURRENCIES.map((c) => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Default Validity (days)" hint="How many days a quotation is valid by default">
                  <Input
                    type="number"
                    min={1}
                    max={365}
                    value={quotation.quotation_default_validity_days}
                    onChange={(e) => setQuotation((p) => ({ ...p, quotation_default_validity_days: e.target.value }))}
                    placeholder="7"
                  />
                </Field>
              </div>

              <Separator />

              <Field
                label="Default Terms & Conditions"
                hint="Pre-filled on every new quotation. Staff can edit per quotation."
              >
                <TextArea
                  rows={10}
                  value={quotation.quotation_default_terms}
                  onChange={(v) => setQuotation((p) => ({ ...p, quotation_default_terms: v }))}
                  placeholder={`Example:
1. 50% advance payment required to confirm booking.
2. Balance due 14 days before departure.
3. Cancellation within 48 hours is non-refundable.
4. All prices are subject to availability.
5. Visa approval is subject to embassy decision.`}
                />
              </Field>

              <Field
                label="Default Internal Notes"
                hint="Pre-filled internal notes on every new quotation (not shown to clients)."
              >
                <TextArea
                  rows={4}
                  value={quotation.quotation_default_notes}
                  onChange={(v) => setQuotation((p) => ({ ...p, quotation_default_notes: v }))}
                  placeholder="e.g. Verify hotel availability before sending to client."
                />
              </Field>

              <div className="flex justify-end pt-2">
                <Button onClick={saveQuotation} disabled={save.isPending} className="bg-teal-600 hover:bg-teal-700 text-white gap-2">
                  {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Save Quotation Defaults
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Banking Tab ─────────────────────────────────────────────────── */}
        <TabsContent value="banking">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-teal-600" /> Banking Details
              </CardTitle>
              <CardDescription>
                Printed on quotations and invoices to facilitate client payments.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <Field label="Bank Name">
                  <Input
                    value={banking.bank_name}
                    onChange={(e) => setBanking((p) => ({ ...p, bank_name: e.target.value }))}
                    placeholder="Meezan Bank"
                  />
                </Field>
                <Field label="Account Number / Title">
                  <Input
                    value={banking.bank_account}
                    onChange={(e) => setBanking((p) => ({ ...p, bank_account: e.target.value }))}
                    placeholder="0123456789 — Al Musafir International"
                  />
                </Field>
              </div>

              <Field label="IBAN" hint="International Bank Account Number">
                <Input
                  value={banking.bank_iban}
                  onChange={(e) => setBanking((p) => ({ ...p, bank_iban: e.target.value }))}
                  placeholder="PK36MZNB0123456789012345"
                  className="font-mono"
                />
              </Field>

              <div className="grid grid-cols-2 gap-4">
                <Field label="SWIFT / BIC Code">
                  <Input
                    value={banking.swift_code}
                    onChange={(e) => setBanking((p) => ({ ...p, swift_code: e.target.value }))}
                    placeholder="MZNBPKKA"
                    className="font-mono"
                  />
                </Field>
                <Field label="Routing Number" hint="Used for international wire transfers">
                  <Input
                    value={banking.routing_no}
                    onChange={(e) => setBanking((p) => ({ ...p, routing_no: e.target.value }))}
                    placeholder="021000021"
                    className="font-mono"
                  />
                </Field>
              </div>

              <div className="flex justify-end pt-2">
                <Button onClick={saveBanking} disabled={save.isPending} className="bg-teal-600 hover:bg-teal-700 text-white gap-2">
                  {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Save Banking Details
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Print & Signature Tab ────────────────────────────────────────── */}
        <TabsContent value="print">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Printer className="h-5 w-5 text-teal-600" /> Print & Signature Settings
              </CardTitle>
              <CardDescription>
                Controls what appears at the bottom of printed quotations, invoices, and vouchers.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <Field label="Authorised Signatory Name">
                  <Input
                    value={print.signature_name}
                    onChange={(e) => setPrint((p) => ({ ...p, signature_name: e.target.value }))}
                    placeholder="Muhammad Ahmed"
                  />
                </Field>
                <Field label="Signatory Title / Designation">
                  <Input
                    value={print.signature_title}
                    onChange={(e) => setPrint((p) => ({ ...p, signature_title: e.target.value }))}
                    placeholder="Reservation Officer"
                  />
                </Field>
              </div>

              <Field label="Print Footer" hint="Appears at the very bottom of every printed document">
                <TextArea
                  rows={3}
                  value={print.print_footer}
                  onChange={(v) => setPrint((p) => ({ ...p, print_footer: v }))}
                  placeholder="Thank you for choosing Al Musafir International. May Allah accept your Umrah."
                />
              </Field>

              <Separator />

              <Field
                label="Default Terms & Conditions (Print)"
                hint="These terms print on documents when no per-quotation terms are set."
              >
                <TextArea
                  rows={8}
                  value={print.terms_conditions}
                  onChange={(v) => setPrint((p) => ({ ...p, terms_conditions: v }))}
                  placeholder="1. All bookings are subject to availability.&#10;2. Payments are non-refundable after departure.&#10;..."
                />
              </Field>

              <div className="flex justify-end pt-2">
                <Button onClick={savePrint} disabled={save.isPending} className="bg-teal-600 hover:bg-teal-700 text-white gap-2">
                  {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Save Print Settings
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
