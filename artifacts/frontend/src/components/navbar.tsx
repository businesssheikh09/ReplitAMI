import React from "react";
import { Link } from "wouter";

export function Navbar() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border/40 transition-all duration-300">
      <div className="container mx-auto px-4 md:px-6 h-20 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link href="/" className="font-serif text-2xl font-semibold tracking-wide text-primary">
            Noor Al-Haram
          </Link>
        </div>
        
        <nav className="hidden md:flex items-center gap-8">
          <a href="#about" className="text-sm font-medium text-foreground/80 hover:text-primary transition-colors">Our Promise</a>
          <a href="#packages" className="text-sm font-medium text-foreground/80 hover:text-primary transition-colors">Journeys</a>
          <a href="#experience" className="text-sm font-medium text-foreground/80 hover:text-primary transition-colors">The Experience</a>
        </nav>

        <div className="flex items-center gap-4">
          <a 
            href="/login" 
            className="hidden sm:inline-flex h-9 items-center justify-center rounded-md border border-primary/20 bg-transparent px-4 py-2 text-sm font-medium text-primary shadow-sm hover:bg-primary/5 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            Admin Login
          </a>
          <a 
            href="#packages"
            className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-6 py-2 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            Begin Journey
          </a>
        </div>
      </div>
    </header>
  );
}
