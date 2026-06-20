import React from "react";
import { useGetWebsiteConfig } from "@workspace/api-client-react";
import { Check } from "lucide-react";

const packages = [
  {
    id: "economy",
    name: "Noor Economy",
    duration: "10-14 Days",
    price: "250,000",
    description: "A comfortable and accessible journey focusing on the essentials.",
    features: [
      "3-Star Hotels near Haram",
      "Shared Transport included",
      "Visa processing assistance",
      "Guided Ziyarat in both cities",
    ],
  },
  {
    id: "standard",
    name: "Barakah Standard",
    duration: "14-21 Days",
    price: "350,000",
    description: "Enhanced comfort and longer stays for a deeply reflective trip.",
    features: [
      "4-Star Hotels with easy access",
      "Dedicated AC bus transfers",
      "Daily breakfast included",
      "Comprehensive Ziyarat tours",
      "Complimentary Ihram kits",
    ],
    popular: true,
  },
  {
    id: "premium",
    name: "Haramain Premium",
    duration: "14-21 Days",
    price: "550,000",
    description: "Exceptional quality and proximity for a seamless spiritual retreat.",
    features: [
      "5-Star Hotels walking distance to Haram",
      "Half-board meals (Breakfast & Dinner)",
      "High-speed train (Makkah-Madinah)",
      "Premium AC transport",
      "Dedicated group scholar (Alim)",
    ],
  },
  {
    id: "vip",
    name: "Firdous VIP",
    duration: "7-21 Days",
    price: "850,000",
    description: "Uncompromising luxury and privacy for an exclusive experience.",
    features: [
      "Luxury suites with Haram view options",
      "Private GMC/SUV transfers",
      "Full-board premium dining",
      "Personal guide and dedicated support",
      "Fast-track processing & exclusive lounge",
    ],
  },
];

export function PackagesSection() {
  const { data: config } = useGetWebsiteConfig();

  const title = config?.packagesTitle ?? "Curated Journeys";
  const subtitle = config?.packagesSubtitle ?? "Carefully structured packages designed to meet the needs of every pilgrim, ensuring dignity, comfort, and peace of mind.";

  return (
    <section id="packages" className="py-24 bg-muted/30 relative">
      <div className="container mx-auto px-4 md:px-6">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl md:text-5xl font-serif text-foreground mb-4">{title}</h2>
          <p className="text-lg text-muted-foreground">{subtitle}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-8">
          {packages.map((pkg) => (
            <div
              key={pkg.id}
              className={`relative flex flex-col bg-card rounded-2xl border ${pkg.popular ? "border-primary shadow-lg" : "border-border shadow-sm"} overflow-hidden transition-all hover:shadow-md`}
            >
              {pkg.popular && (
                <div className="absolute top-0 right-0 bg-primary text-primary-foreground text-xs font-bold px-3 py-1 rounded-bl-lg">
                  Most Popular
                </div>
              )}
              <div className="p-6 border-b border-border/50 bg-secondary/10">
                <h3 className="text-2xl font-serif font-medium text-foreground mb-1">{pkg.name}</h3>
                <p className="text-sm font-medium text-primary mb-4">{pkg.duration}</p>
                <div className="flex items-baseline gap-1">
                  <span className="text-sm font-medium text-muted-foreground">PKR</span>
                  <span className="text-4xl font-bold tracking-tight text-foreground">{pkg.price}</span>
                </div>
                <p className="text-sm text-muted-foreground mt-4 h-10">{pkg.description}</p>
              </div>
              <div className="p-6 flex-1 flex flex-col">
                <ul className="space-y-4 mb-8 flex-1">
                  {pkg.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <Check className="h-5 w-5 text-primary shrink-0" />
                      <span className="text-sm text-foreground/80">{feature}</span>
                    </li>
                  ))}
                </ul>
                <button
                  className={`w-full py-2.5 px-4 rounded-md text-sm font-medium transition-colors ${
                    pkg.popular
                      ? "bg-primary text-primary-foreground hover:bg-primary/90"
                      : "bg-secondary text-foreground hover:bg-secondary/80"
                  }`}
                >
                  Inquire Now
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
