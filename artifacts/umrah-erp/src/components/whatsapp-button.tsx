import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { MessageCircle, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

type SupportConfig = {
  support_wa_sales: string;
  support_wa_sales_msg: string;
  support_wa_support: string;
  support_wa_support_msg: string;
  support_wa_visa: string;
  support_wa_visa_msg: string;
  support_wa_accounts: string;
  support_wa_accounts_msg: string;
  support_wa_emergency: string;
  support_wa_emergency_msg: string;
};

const DEPT_DEFS = [
  { label: "Sales",     phoneKey: "support_wa_sales"     as keyof SupportConfig, msgKey: "support_wa_sales_msg"     as keyof SupportConfig },
  { label: "Support",   phoneKey: "support_wa_support"   as keyof SupportConfig, msgKey: "support_wa_support_msg"   as keyof SupportConfig },
  { label: "Visa",      phoneKey: "support_wa_visa"      as keyof SupportConfig, msgKey: "support_wa_visa_msg"      as keyof SupportConfig },
  { label: "Accounts",  phoneKey: "support_wa_accounts"  as keyof SupportConfig, msgKey: "support_wa_accounts_msg"  as keyof SupportConfig },
  { label: "Emergency", phoneKey: "support_wa_emergency" as keyof SupportConfig, msgKey: "support_wa_emergency_msg" as keyof SupportConfig },
];

export function WhatsAppButton() {
  const [open, setOpen] = useState(false);
  const [location] = useLocation();
  const [config, setConfig] = useState<SupportConfig | null>(null);

  useEffect(() => {
    fetch("/api/website-config")
      .then((r) => r.json())
      .then((data: SupportConfig) => setConfig(data))
      .catch(() => setConfig({} as SupportConfig));
  }, []);

  if (location === "/login") return null;

  const departments = config
    ? DEPT_DEFS.flatMap((d) => {
        const phone = config[d.phoneKey]?.trim();
        if (!phone) return [];
        const msg = config[d.msgKey]?.trim() || `Hi, I need help with ${d.label.toLowerCase()}.`;
        return [{ name: d.label, phone, message: msg }];
      })
    : [];

  const isLoading = config === null;

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {open && (
        <Card className="mb-4 w-72 shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">WhatsApp Support</CardTitle>
            <Button variant="ghost" size="icon" onClick={() => setOpen(false)} className="h-8 w-8">
              <X className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent className="grid gap-2">
            {isLoading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : departments.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-3">
                No support contacts configured yet.
              </p>
            ) : (
              departments.map((dept) => (
                <a
                  key={dept.name}
                  href={`https://wa.me/${dept.phone}?text=${encodeURIComponent(dept.message)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 p-2 hover:bg-muted rounded-md transition-colors text-sm"
                >
                  <MessageCircle className="h-4 w-4 text-green-500" />
                  {dept.name}
                </a>
              ))
            )}
          </CardContent>
        </Card>
      )}
      <Button
        onClick={() => setOpen(!open)}
        size="icon"
        className="h-14 w-14 rounded-full bg-green-500 hover:bg-green-600 text-white shadow-lg"
      >
        <MessageCircle className="h-6 w-6" />
      </Button>
    </div>
  );
}
