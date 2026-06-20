import React from "react";
import { useGetWebsiteConfig } from "@workspace/api-client-react";
import patternBg from "@/assets/pattern.png";

export function Footer() {
  const { data: config } = useGetWebsiteConfig();
  const siteName = config?.siteName ?? "Noor Al-Haram";
  const email = config?.contactEmail ?? "info@nooralharam.pk";
  const phone = config?.contactPhone ?? "+92 300 1234567";

  return (
    <footer className="relative bg-primary text-primary-foreground pt-16 pb-8 overflow-hidden">
      <div
        className="absolute inset-0 z-0 opacity-5 mix-blend-overlay pointer-events-none"
        style={{ backgroundImage: `url(${patternBg})`, backgroundSize: "cover" }}
      ></div>

      <div className="container relative z-10 mx-auto px-4 md:px-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12 mb-12">
          <div>
            <h3 className="font-serif text-2xl font-semibold tracking-wide mb-4">{siteName}</h3>
            <p className="text-primary-foreground/70 text-sm max-w-xs leading-relaxed">
              Curating sacred journeys from Pakistan to Makkah and Madinah with dignity, comfort, and profound respect.
            </p>
          </div>

          <div>
            <h4 className="font-medium text-lg mb-4">Quick Links</h4>
            <ul className="space-y-2 text-sm text-primary-foreground/80">
              <li><a href="#about" className="hover:text-white transition-colors">Our Promise</a></li>
              <li><a href="#packages" className="hover:text-white transition-colors">Umrah Packages</a></li>
              <li><a href="#experience" className="hover:text-white transition-colors">The Experience</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Contact Us</a></li>
            </ul>
          </div>

          <div>
            <h4 className="font-medium text-lg mb-4">Contact</h4>
            <ul className="space-y-2 text-sm text-primary-foreground/80">
              <li>Karachi Head Office, Pakistan</li>
              <li>{email}</li>
              <li>{phone}</li>
            </ul>
          </div>
        </div>

        <div className="pt-8 border-t border-primary-foreground/20 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-xs text-primary-foreground/60">
            &copy; {new Date().getFullYear()} {siteName} Travels. All rights reserved.
          </p>
          <div className="flex gap-4 text-xs text-primary-foreground/60">
            <a href="#" className="hover:text-white">Privacy Policy</a>
            <a href="#" className="hover:text-white">Terms of Service</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
