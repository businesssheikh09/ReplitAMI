import { useQuery } from "@tanstack/react-query";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Branding {
  companyName: string;
  legalCompanyName: string;
  logoUrl: string;
  printLogoUrl: string;
  companyAddress: string;
  companyNtn: string;
  companyEmail: string;
  companyPhone: string;
  companyWhatsapp: string;
  bankName: string;
  bankAccount: string;
  bankIban: string;
  swiftCode: string;
  routingNo: string;
  termsConditions: string;
  printFooter: string;
  signatureName: string;
  signatureTitle: string;
}

function rawToConfig(raw: Record<string, string>): Branding {
  return {
    companyName:      raw.company_name      ?? raw.companyName      ?? "Al Musafir International",
    legalCompanyName: raw.legal_company_name ?? raw.legalCompanyName ?? "",
    logoUrl:          raw.logo_url           ?? raw.logoUrl           ?? "",
    printLogoUrl:     raw.print_logo_url     ?? raw.printLogoUrl     ?? "",
    companyAddress:   raw.company_address    ?? raw.companyAddress   ?? "",
    companyNtn:       raw.company_ntn        ?? raw.companyNtn       ?? "",
    companyEmail:     raw.company_email      ?? raw.companyEmail     ?? "",
    companyPhone:     raw.company_phone      ?? raw.companyPhone     ?? "",
    companyWhatsapp:  raw.company_whatsapp   ?? raw.companyWhatsapp  ?? "",
    bankName:         raw.bank_name          ?? raw.bankName         ?? "",
    bankAccount:      raw.bank_account       ?? raw.bankAccount      ?? "",
    bankIban:         raw.bank_iban          ?? raw.bankIban         ?? "",
    swiftCode:        raw.swift_code         ?? raw.swiftCode        ?? "",
    routingNo:        raw.routing_no         ?? raw.routingNo        ?? "",
    termsConditions:  raw.terms_conditions   ?? raw.termsConditions  ?? "",
    printFooter:      raw.print_footer       ?? raw.printFooter      ?? "",
    signatureName:    raw.signature_name     ?? raw.signatureName    ?? "",
    signatureTitle:   raw.signature_title    ?? raw.signatureTitle   ?? "Reservation Officer",
  };
}

const WATERMARK_COLORS: Record<string, string> = {
  "Definite Confirmation": "text-green-700",
  "Tentative":             "text-amber-500",
  "Cancelled":             "text-red-600",
  "Provisional":           "text-orange-500",
  "Paid":                  "text-green-600",
  "Unpaid":                "text-red-500",
  "Authorized":            "text-blue-700",
};

export interface PrintLayoutProps {
  title: string;
  refNo?: string;
  date?: string;
  toName?: string;
  attention?: string;
  fromName?: string;
  contact?: string;
  watermark?: string;
  showBankDetails?: boolean;
  showTerms?: boolean;
  showSignature?: boolean;
  amountInWords?: string;
  remarks?: string;
  children: React.ReactNode;
  onPrint?: () => void;
}

export function PrintLayout({
  title, refNo, date, toName, attention, fromName, contact,
  watermark, showBankDetails = false, showTerms = false,
  showSignature = true, amountInWords, remarks, children, onPrint,
}: PrintLayoutProps) {
  const { data: raw } = useQuery<Record<string, string>>({
    queryKey: ["/api/website-config"],
    queryFn: () => fetch("/api/website-config").then((r) => r.json()),
    staleTime: 5 * 60_000,
  });

  const b: Branding = raw ? rawToConfig(raw) : rawToConfig({});
  const logoSrc = b.printLogoUrl || b.logoUrl;
  const wmColor = watermark ? (WATERMARK_COLORS[watermark] ?? "text-blue-800") : "";

  const handlePrint = onPrint ?? (() => window.print());

  return (
    <>
      {/* Print button — screen only */}
      <div className="flex justify-end mb-4 print:hidden">
        <Button size="sm" variant="outline" onClick={handlePrint}>
          <Printer className="h-4 w-4 mr-1.5" /> Print
        </Button>
      </div>

      {/* A4 Document */}
      <div
        className="bg-white print:shadow-none shadow border border-gray-300 print:border-gray-400 relative overflow-hidden"
        style={{ fontFamily: "Arial, Helvetica, sans-serif", fontSize: "12px" }}
      >
        {/* Diagonal watermark */}
        {watermark && (
          <div
            className={`absolute inset-0 pointer-events-none flex items-center justify-center z-10`}
            aria-hidden
          >
            <span
              className={`text-[72px] font-extrabold uppercase opacity-[0.07] select-none tracking-widest ${wmColor}`}
              style={{ transform: "rotate(-35deg)", whiteSpace: "nowrap" }}
            >
              {watermark}
            </span>
          </div>
        )}

        {/* ── Header ── */}
        <div className="border-b-4 border-blue-900 pb-3 pt-4 px-6">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <div className="w-28 h-16 flex items-center">
              {logoSrc ? (
                <img src={logoSrc} alt="Company Logo" className="max-h-14 max-w-full object-contain" />
              ) : (
                <div className="h-14 w-24 bg-blue-900 rounded flex items-center justify-center text-white text-xs font-bold text-center leading-tight px-1">
                  {b.companyName}
                </div>
              )}
            </div>
            {/* Company Name + Address */}
            <div className="text-center flex-1 px-4">
              <div className="text-lg font-bold text-blue-900 uppercase tracking-wide">
                {b.companyName}
              </div>
              {b.legalCompanyName && (
                <div className="text-xs text-gray-600">{b.legalCompanyName}</div>
              )}
              {b.companyAddress && (
                <div className="text-xs text-gray-600 mt-0.5">{b.companyAddress}</div>
              )}
              <div className="text-xs text-gray-600 mt-0.5">
                {[b.companyPhone, b.companyEmail].filter(Boolean).join("  |  ")}
              </div>
              {b.companyNtn && (
                <div className="text-xs text-gray-500 mt-0.5">NTN: {b.companyNtn}</div>
              )}
            </div>
            {/* Document type / Date */}
            <div className="text-right w-28 text-xs text-gray-500">
              {date && <div>Date: <strong className="text-gray-800">{date}</strong></div>}
            </div>
          </div>
        </div>

        {/* Document Title bar */}
        <div className="bg-blue-900 text-white text-center py-1.5 text-sm font-bold uppercase tracking-widest">
          {title}
          {refNo && <span className="ml-4 font-mono tracking-normal normal-case opacity-90">#{refNo}</span>}
        </div>

        {/* Addressee row */}
        {(toName || attention || fromName || contact) && (
          <div className="grid grid-cols-2 gap-x-6 px-6 py-2 border-b border-gray-200 text-xs">
            {toName && (
              <div><span className="font-semibold text-gray-600">To:</span> {toName}</div>
            )}
            {attention && (
              <div><span className="font-semibold text-gray-600">Attention:</span> {attention}</div>
            )}
            {fromName && (
              <div><span className="font-semibold text-gray-600">From:</span> {fromName}</div>
            )}
            {contact && (
              <div><span className="font-semibold text-gray-600">Contact:</span> {contact}</div>
            )}
          </div>
        )}

        {/* Document content */}
        <div className="px-0">{children}</div>

        {/* Amount in words */}
        {amountInWords && (
          <div className="px-6 py-2 border-t border-gray-200">
            <span className="font-semibold text-gray-600 text-xs">Amount in Words: </span>
            <span className="text-xs italic">{amountInWords}</span>
          </div>
        )}

        {/* Remarks */}
        {remarks && (
          <div className="px-6 py-2 border-t border-gray-200">
            <span className="font-semibold text-gray-600 text-xs">Remarks: </span>
            <span className="text-xs">{remarks}</span>
          </div>
        )}

        {/* Terms & Conditions */}
        {showTerms && b.termsConditions && (
          <div className="px-6 py-2 border-t border-gray-200">
            <div className="font-semibold text-gray-600 text-xs mb-1">Terms & Conditions:</div>
            <div className="text-xs text-gray-600 whitespace-pre-line">{b.termsConditions}</div>
          </div>
        )}

        {/* Bank Details */}
        {showBankDetails && (b.bankName || b.bankIban) && (
          <div className="px-6 py-2 border-t border-gray-200 bg-gray-50">
            <div className="font-semibold text-gray-600 text-xs mb-1">Bank Details:</div>
            <div className="grid grid-cols-2 gap-x-8 text-xs text-gray-700">
              {b.bankName    && <div><span className="font-medium">Bank:</span> {b.bankName}</div>}
              {b.bankAccount && <div><span className="font-medium">A/C No:</span> {b.bankAccount}</div>}
              {b.bankIban    && <div><span className="font-medium">IBAN:</span> {b.bankIban}</div>}
              {b.swiftCode   && <div><span className="font-medium">Swift:</span> {b.swiftCode}</div>}
              {b.routingNo   && <div><span className="font-medium">Routing:</span> {b.routingNo}</div>}
            </div>
          </div>
        )}

        {/* Signature + Footer */}
        {showSignature && (
          <div className="px-6 pt-6 pb-4 border-t border-gray-200">
            <div className="flex justify-between items-end">
              <div className="text-center">
                <div className="border-b border-dashed border-gray-400 w-40 mb-1 h-8" />
                <div className="text-xs text-gray-500">Authorised Signatory</div>
              </div>
              <div className="text-center">
                <div className="border-b border-dashed border-gray-400 w-40 mb-1 h-8" />
                <div className="text-xs text-gray-500">
                  {b.signatureName || "Reservation Officer"}
                  {b.signatureTitle && b.signatureTitle !== b.signatureName && (
                    <div className="text-gray-400">{b.signatureTitle}</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Footer bar */}
        {b.printFooter && (
          <div className="bg-blue-900 text-white text-center py-1 text-xs">
            {b.printFooter}
          </div>
        )}

        {/* Printed by (screen-hidden in print, shown on print) */}
        <div className="hidden print:block text-center text-xs text-gray-400 py-1 border-t">
          Printed on {new Date().toLocaleString()} — {b.companyName}
        </div>
      </div>
    </>
  );
}

export function useBranding() {
  const { data: raw } = useQuery<Record<string, string>>({
    queryKey: ["/api/website-config"],
    queryFn: () => fetch("/api/website-config").then((r) => r.json()),
    staleTime: 5 * 60_000,
  });
  return raw ? rawToConfig(raw) : rawToConfig({});
}
