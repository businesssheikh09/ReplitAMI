import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Check, ArrowLeft, Loader2, Building2, User } from "lucide-react";
import { usePortalAuth } from "@/lib/portal-auth";

type AccountType = "party" | "dc";

function InputField({
  label, type = "text", value, onChange, placeholder, required,
}: {
  label: string; type?: string; value: string; onChange: (v: string) => void; placeholder?: string; required?: boolean;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-foreground mb-1.5">
        {label} {required && <span className="text-destructive">*</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-4 py-3 rounded-xl border border-border bg-white text-sm focus:ring-2 focus:ring-teal-500/40 focus:outline-none focus:border-teal-500 transition"
      />
    </div>
  );
}

export default function PortalRegisterPage() {
  const [, navigate] = useLocation();
  const { login } = usePortalAuth();
  const [step, setStep] = useState<"type" | "form">("type");
  const [accountType, setAccountType] = useState<AccountType>("party");
  const [form, setForm] = useState({
    fullName: "", email: "", phone: "", whatsapp: "", password: "", confirmPassword: "",
    companyName: "", ownerName: "", address: "", dtsNumber: "",
  });
  const [done, setDone] = useState(false);

  const u = <K extends keyof typeof form>(k: K) => (v: string) => setForm((p) => ({ ...p, [k]: v }));

  const mutation = useMutation({
    mutationFn: async () => {
      if (form.password !== form.confirmPassword) throw new Error("Passwords do not match");
      const res = await fetch("/api/portal/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: accountType,
          fullName: form.fullName,
          email: form.email || null,
          phone: form.phone,
          whatsapp: form.whatsapp || null,
          password: form.password,
          companyName: form.companyName || null,
          ownerName: form.ownerName || null,
          address: form.address || null,
          dtsNumber: accountType === "party" ? form.dtsNumber || null : null,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Registration failed" }));
        throw new Error(err.error ?? "Registration failed");
      }
      return res.json();
    },
    onSuccess: () => {
      setDone(true);
    },
  });

  if (done) return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 text-center bg-stone-50">
      <div className="w-16 h-16 rounded-full bg-teal-50 flex items-center justify-center mx-auto mb-6">
        <Check className="h-8 w-8 text-teal-600" />
      </div>
      <h2 className="text-2xl font-serif mb-3">Application Submitted!</h2>
      <p className="text-muted-foreground max-w-sm mb-6">
        {accountType === "party"
          ? "Your party account application is under review. Our team will contact you within 1–2 business days."
          : "Your account has been created successfully. You can now sign in with your credentials."}
      </p>
      <button onClick={() => navigate("/portal-login")} className="text-teal-600 hover:underline text-sm">
        Go to sign in →
      </button>
    </div>
  );

  return (
    <div className="min-h-screen bg-stone-50">
      <div className="bg-white border-b border-border sticky top-0 z-10">
        <div className="container mx-auto px-4 h-16 flex items-center gap-4">
          <button onClick={() => step === "form" ? setStep("type") : navigate("/")} className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <span className="font-semibold text-sm">Create Portal Account</span>
        </div>
      </div>

      <div className="container mx-auto px-4 py-10 max-w-lg">
        {step === "type" && (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <h1 className="text-2xl font-serif mb-2">Choose Account Type</h1>
              <p className="text-muted-foreground text-sm">Select the type of account that matches your business.</p>
            </div>
            <div
              onClick={() => setAccountType("party")}
              className={`bg-white rounded-2xl border-2 p-6 cursor-pointer transition ${accountType === "party" ? "border-teal-500" : "border-border hover:border-teal-300"}`}
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-teal-50 flex items-center justify-center shrink-0">
                  <Building2 className="h-6 w-6 text-teal-600" />
                </div>
                <div>
                  <h3 className="font-semibold mb-1">Party Account</h3>
                  <p className="text-sm text-muted-foreground">Travel agencies with a DTS number. Book group tickets and upload payment receipts with dynamic deadlines.</p>
                </div>
                {accountType === "party" && <Check className="h-5 w-5 text-teal-500 ml-auto shrink-0" />}
              </div>
            </div>
            <div
              onClick={() => setAccountType("dc")}
              className={`bg-white rounded-2xl border-2 p-6 cursor-pointer transition ${accountType === "dc" ? "border-teal-500" : "border-border hover:border-teal-300"}`}
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
                  <User className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold mb-1">Direct Customer (DC)</h3>
                  <p className="text-sm text-muted-foreground">Individual travellers or small groups booking directly. Instant account activation.</p>
                </div>
                {accountType === "dc" && <Check className="h-5 w-5 text-teal-500 ml-auto shrink-0" />}
              </div>
            </div>
            <button
              onClick={() => setStep("form")}
              className="w-full py-4 rounded-2xl bg-teal-600 text-white font-semibold text-sm hover:bg-teal-700 transition"
            >
              Continue as {accountType === "party" ? "Party" : "DC"} →
            </button>
            <p className="text-center text-sm text-muted-foreground">
              Already have an account?{" "}
              <button onClick={() => navigate("/portal-login")} className="text-teal-600 hover:underline">Sign in</button>
            </p>
          </div>
        )}

        {step === "form" && (
          <div className="bg-white rounded-3xl border border-border p-8 space-y-5">
            <div className="mb-6">
              <h2 className="text-xl font-serif mb-1">{accountType === "party" ? "Party" : "DC"} Account Details</h2>
              <p className="text-sm text-muted-foreground">All fields marked * are required.</p>
            </div>

            <InputField label="Full Name" value={form.fullName} onChange={u("fullName")} placeholder="Your full name" required />
            <InputField label="Phone / WhatsApp" type="tel" value={form.phone} onChange={u("phone")} placeholder="+92 300 000 0000" required />
            <InputField label="WhatsApp (if different)" type="tel" value={form.whatsapp} onChange={u("whatsapp")} placeholder="+92 300 000 0000" />
            <InputField label="Email" type="email" value={form.email} onChange={u("email")} placeholder="you@example.com" />

            {accountType === "party" && (
              <>
                <div className="border-t border-border pt-5">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">Agency Details</p>
                </div>
                <InputField label="Company / Agency Name" value={form.companyName} onChange={u("companyName")} placeholder="Travel agency name" />
                <InputField label="Owner Name" value={form.ownerName} onChange={u("ownerName")} placeholder="Owner's full name" />
                <InputField label="DTS Number" value={form.dtsNumber} onChange={u("dtsNumber")} placeholder="Your IATA/DTS registration number" />
                <InputField label="Address" value={form.address} onChange={u("address")} placeholder="City, Province" />
              </>
            )}

            <div className="border-t border-border pt-5">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">Set Password</p>
            </div>
            <InputField label="Password" type="password" value={form.password} onChange={u("password")} required />
            <InputField label="Confirm Password" type="password" value={form.confirmPassword} onChange={u("confirmPassword")} required />

            {mutation.isError && (
              <p className="text-sm text-destructive">{(mutation.error as Error).message}</p>
            )}

            <button
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending || !form.fullName || !form.phone || !form.password}
              className="w-full py-4 rounded-2xl bg-teal-600 text-white font-semibold text-sm hover:bg-teal-700 disabled:opacity-60 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
            >
              {mutation.isPending ? <><Loader2 className="h-4 w-4 animate-spin" /> Creating account…</> : "Create Account"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
