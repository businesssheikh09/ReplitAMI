import React, { useState } from "react";
import { Link, useLocation } from "wouter";
import { useGetWebsiteConfig } from "@workspace/api-client-react";
import { getPortalUser, usePortalAuth } from "@/lib/portal-auth";
import { User, LogOut, Ticket, ChevronDown, Menu, X } from "lucide-react";

export function Navbar() {
  const { data: config } = useGetWebsiteConfig();
  const siteName = config?.siteName ?? "Al Musafir International";
  const { user, logout, isAuthenticated } = usePortalAuth();
  const [, navigate] = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-background/90 backdrop-blur-md border-b border-border/40 transition-all duration-300">
      <div className="container mx-auto px-4 md:px-6 h-20 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          {config?.logoUrl ? (
            <img src={config.logoUrl} alt={siteName} className="h-10 max-w-[160px] object-contain" />
          ) : (
            <span className="font-serif text-2xl font-semibold tracking-wide text-primary">{siteName}</span>
          )}
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-8">
          <a href="/#about" className="text-sm font-medium text-foreground/80 hover:text-primary transition-colors">Our Promise</a>
          <Link href="/flights" className="text-sm font-medium text-foreground/80 hover:text-primary transition-colors">Flights</Link>
          <a href="/#customize" className="text-sm font-medium text-foreground/80 hover:text-primary transition-colors">Build Package</a>
          <a href="/#packages" className="text-sm font-medium text-foreground/80 hover:text-primary transition-colors">Journeys</a>
          <a href="/#experience" className="text-sm font-medium text-foreground/80 hover:text-primary transition-colors">Experience</a>
        </nav>

        {/* Actions */}
        <div className="hidden md:flex items-center gap-3">
          {isAuthenticated && user ? (
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate("/my-bookings")}
                className="flex items-center gap-1.5 text-sm font-medium text-foreground/80 hover:text-primary transition-colors"
              >
                <Ticket className="h-4 w-4" />
                My Bookings
              </button>
              <div className="w-px h-4 bg-border" />
              <button
                onClick={() => { logout(); }}
                className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <LogOut className="h-4 w-4" />
                Sign Out
              </button>
            </div>
          ) : (
            <div className="hidden sm:flex items-center gap-2">
              <button
                onClick={() => navigate("/portal-login")}
                className="h-9 inline-flex items-center justify-center gap-1.5 rounded-md border border-primary/20 bg-transparent px-4 py-2 text-sm font-medium text-primary shadow-sm hover:bg-primary/5 transition-colors"
              >
                <User className="h-4 w-4" />
                Login
              </button>
              <button
                onClick={() => navigate("/portal-register")}
                className="h-9 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90"
              >
                Register
              </button>
            </div>
          )}
          <Link
            href="/flights"
            className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-6 py-2 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90"
          >
            Book a Flight
          </Link>
          <a
            href="/login"
            className="text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors border-l border-border/50 pl-3"
            title="ERP Staff Login"
          >
            Staff
          </a>
        </div>

        {/* Mobile hamburger */}
        <button className="md:hidden text-foreground/80" onClick={() => setMenuOpen(!menuOpen)}>
          {menuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden border-t border-border bg-background/95 backdrop-blur-md px-4 py-5 space-y-4">
          <a href="/#group-tickets" onClick={() => setMenuOpen(false)} className="block text-sm font-medium text-foreground/80 hover:text-primary">Available Seats</a>
          <a href="/#customize" onClick={() => setMenuOpen(false)} className="block text-sm font-medium text-foreground/80 hover:text-primary">Build Package</a>
          <a href="/#packages" onClick={() => setMenuOpen(false)} className="block text-sm font-medium text-foreground/80 hover:text-primary">Journeys</a>
          {isAuthenticated ? (
            <>
              <button onClick={() => { navigate("/my-bookings"); setMenuOpen(false); }} className="block text-sm font-medium text-primary">My Bookings</button>
              <button onClick={() => { logout(); setMenuOpen(false); }} className="block text-sm text-muted-foreground">Sign Out</button>
            </>
          ) : (
            <>
              <button onClick={() => { navigate("/portal-login"); setMenuOpen(false); }} className="block text-sm font-medium text-primary">Login</button>
              <button onClick={() => { navigate("/portal-register"); setMenuOpen(false); }} className="block text-sm font-medium text-primary-foreground bg-primary px-3 py-1.5 rounded-lg w-fit">Register</button>
            </>
          )}
          <a href="/login" onClick={() => setMenuOpen(false)} className="block text-xs text-muted-foreground/60 hover:text-muted-foreground pt-2 border-t border-border/40">
            Staff / ERP Login
          </a>
        </div>
      )}
    </header>
  );
}
