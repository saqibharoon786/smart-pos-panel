import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  Boxes,
  Building2,
  CheckCircle2,
  Cloud,
  CreditCard,
  PlayCircle,
  ShieldCheck,
  Smartphone,
  Users,
} from "lucide-react";
import heroImg from "@/assets/hero-pos.jpg";
import storeImg from "@/assets/store-counter.jpg";
import { LoginDialog } from "@/components/LoginDialog";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Book POS — Smart POS for Bookstores & Libraries" },
      {
        name: "description",
        content:
          "Book POS is an all-in-one point of sale, inventory and reporting system for bookstores, libraries and educational stores.",
      },
      { property: "og:title", content: "Book POS — Smart POS for Bookstores & Libraries" },
      {
        property: "og:description",
        content: "Manage sales, stock, customers and reports for your bookstore from anywhere.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const strip = [
  { icon: Smartphone, title: "Fast & Easy POS", text: "Quick billing with barcode scan, multiple payment methods and tax support." },
  { icon: Boxes, title: "Inventory Management", text: "Track stock in real-time, get low stock alerts and avoid over-selling." },
  { icon: BookOpen, title: "Book Catalog", text: "Manage books, authors, categories and editions with ease." },
  { icon: Users, title: "Customer Management", text: "Keep customer records, loyalty programs and purchase history." },
  { icon: BarChart3, title: "Powerful Reports", text: "Sales, stock and financial reports to make better business decisions." },
  { icon: Cloud, title: "Access Anywhere", text: "Use your system from any device, anywhere, anytime." },
];

const features = [
  { icon: CreditCard, title: "POS & Checkout", text: "Fast billing, barcode scanning, multiple payment options." },
  { icon: Boxes, title: "Stock Control", text: "Real-time inventory tracking, low stock alerts." },
  { icon: BookOpen, title: "Book Management", text: "Add, edit and organize books, authors, categories." },
  { icon: Users, title: "Customer Loyalty", text: "Manage customers, offer discounts and loyalty points." },
  { icon: Building2, title: "Multi-Branch Support", text: "Manage multiple stores from one dashboard." },
  { icon: ShieldCheck, title: "Staff Management", text: "Set roles and permissions for your team." },
  { icon: BarChart3, title: "Sales & Profit Reports", text: "Detailed reports for better business growth." },
  { icon: Cloud, title: "Cloud Backup", text: "Your data is always safe and accessible." },
];

function Landing() {
  const [loginOpen, setLoginOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
          <div className="flex items-center gap-2">
            <BookOpen className="size-7 text-primary" />
            <div className="leading-none">
              <div className="text-lg font-bold tracking-tight">Book POS</div>
              <div className="text-[10px] text-muted-foreground">Manage • Sell • Grow</div>
            </div>
          </div>
          <nav className="hidden items-center gap-7 text-sm text-muted-foreground md:flex">
            <a href="#home" className="font-medium text-primary">Home</a>
            <a href="#features">Features</a>
            <a href="#why">Pricing</a>
            <a href="#about">About</a>
            <a href="#contact">Contact</a>
          </nav>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setLoginOpen(true)}
              className="h-9 rounded-lg border border-border px-4 text-sm font-medium transition hover:bg-secondary"
            >
              Login
            </button>
            <button
              onClick={() => setLoginOpen(true)}
              className="h-9 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
            >
              Get Started
            </button>
          </div>
        </div>
      </header>

      <section id="home" className="border-b border-border bg-gradient-to-b from-accent/40 to-background">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-5 py-16 md:grid-cols-2">
          <div>
            <span className="inline-block rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-foreground">
              All-in-One Bookstore Management Solution
            </span>
            <h1 className="mt-5 text-4xl font-extrabold leading-tight tracking-tight md:text-5xl">
              Smart POS for
              <br />
              Bookstores &amp; Libraries
            </h1>
            <p className="mt-4 max-w-md text-muted-foreground">
              Simplify your book sales, inventory and daily operations with our powerful Book POS
              system. Manage your store from anywhere, anytime.
            </p>
            <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-sm">
              {["Sales & POS", "Inventory", "Customer Management", "Reports"].map((t) => (
                <span key={t} className="flex items-center gap-1.5">
                  <CheckCircle2 className="size-4 text-primary" /> {t}
                </span>
              ))}
            </div>
            <div className="mt-7 flex flex-wrap gap-3">
              <button
                onClick={() => setLoginOpen(true)}
                className="flex h-11 items-center gap-2 rounded-lg bg-primary px-6 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition hover:opacity-90"
              >
                Start Free Trial <ArrowRight className="size-4" />
              </button>
              <a
                href="#features"
                className="flex h-11 items-center gap-2 rounded-lg border border-border px-6 text-sm font-semibold transition hover:bg-secondary"
              >
                Watch Demo <PlayCircle className="size-4 text-primary" />
              </a>
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              No credit card required • Setup in minutes
            </p>
          </div>
          <img
            src={heroImg}
            alt="Book POS dashboard on a laptop with barcode scanner, receipt printer and books"
            width={1200}
            height={800}
            className="w-full rounded-xl"
          />
        </div>
      </section>

      <section className="border-b border-border">
        <div className="mx-auto grid max-w-6xl grid-cols-2 divide-border px-5 py-12 md:grid-cols-3 lg:grid-cols-6 lg:divide-x">
          {strip.map((s) => (
            <div key={s.title} className="px-4 py-4 text-center">
              <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-accent text-primary">
                <s.icon className="size-5" />
              </div>
              <h3 className="mt-3 text-sm font-semibold">{s.title}</h3>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{s.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="why" className="border-b border-border bg-secondary/50">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-5 py-16 md:grid-cols-2">
          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            <div className="grid grid-cols-3 gap-3 p-5">
              {[
                ["Today's Sales", "$482", "+12%"],
                ["Books Sold", "36", "+8%"],
                ["New Customers", "12", "+20%"],
              ].map(([a, b, c]) => (
                <div key={a} className="rounded-lg border border-border p-3">
                  <div className="text-[11px] text-muted-foreground">{a}</div>
                  <div className="text-lg font-bold">{b}</div>
                  <div className="text-[11px] text-primary">{c}</div>
                </div>
              ))}
            </div>
            <div className="flex h-40 items-end gap-2 px-5 pb-6">
              {[40, 55, 35, 70, 50, 85, 65].map((h, i) => (
                <div key={i} className="flex-1 rounded-t bg-primary/70" style={{ height: `${h}%` }} />
              ))}
            </div>
          </div>
          <div>
            <span className="inline-block rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-foreground">
              Why Choose Book POS?
            </span>
            <h2 className="mt-4 text-3xl font-bold tracking-tight">
              Everything You Need
              <br />
              in One Place
            </h2>
            <p className="mt-4 text-muted-foreground">
              Book POS is designed specifically for bookstores, libraries and educational stores. It
              helps you save time, reduce errors and grow your business with smart tools and
              insights.
            </p>
            <ul className="mt-6 space-y-3 text-sm">
              {[
                "Easy to use and setup",
                "Secure and reliable",
                "Regular updates & support",
                "Suitable for single & multi-branch stores",
              ].map((t) => (
                <li key={t} className="flex items-center gap-3">
                  <CheckCircle2 className="size-5 text-primary" /> {t}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section id="features" className="border-b border-border">
        <div className="mx-auto max-w-6xl px-5 py-16">
          <div className="text-center">
            <span className="inline-block rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-foreground">
              Key Features
            </span>
            <h2 className="mt-4 text-3xl font-bold tracking-tight">
              Powerful Features for Your Bookstore
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              From sales to inventory, Book POS gives you complete control over your business.
            </p>
          </div>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((f) => (
              <div key={f.title} className="rounded-xl border border-border bg-card p-5">
                <div className="flex size-10 items-center justify-center rounded-lg bg-accent text-primary">
                  <f.icon className="size-5" />
                </div>
                <h3 className="mt-3 text-sm font-semibold">{f.title}</h3>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{f.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="about" className="border-b border-border bg-secondary/50">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-8 px-5 py-12">
          <div className="max-w-xs">
            <h3 className="text-xl font-bold">
              Better Books.
              <br />
              Smarter Business.
            </h3>
            <p className="mt-2 text-xs text-muted-foreground">
              The complete POS solution for modern bookstores and libraries.
            </p>
          </div>
          {[
            ["1,200+", "Happy Stores"],
            ["50K+", "Books Managed"],
            ["99.9%", "System Uptime"],
          ].map(([a, b]) => (
            <div key={b} className="text-center">
              <div className="text-2xl font-bold">{a}</div>
              <div className="text-xs text-muted-foreground">{b}</div>
            </div>
          ))}
          <div className="text-center">
            <button
              onClick={() => setLoginOpen(true)}
              className="flex h-11 items-center gap-2 rounded-lg bg-primary px-6 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
            >
              Get Started Now <ArrowRight className="size-4" />
            </button>
            <p className="mt-2 text-[11px] text-muted-foreground">
              Join thousands of satisfied store owners.
            </p>
          </div>
        </div>
      </section>

      <section id="contact" className="grid items-stretch md:grid-cols-2">
        <div className="px-5 py-14 md:pl-[max(1.25rem,calc((100vw-72rem)/2))]">
          <span className="inline-block rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-foreground">
            What Our Customers Say
          </span>
          <h2 className="mt-4 text-2xl font-bold tracking-tight">Trusted by Bookstore Owners</h2>
          <div className="mt-6 max-w-lg rounded-xl border border-border bg-card p-6 shadow-sm">
            <p className="text-sm text-muted-foreground">
              "Book POS has completely transformed our store. Inventory management is so easy now,
              and the reports help us make better decisions. Highly recommended!"
            </p>
            <div className="mt-4">
              <div className="text-sm font-semibold">Ahmed Raza</div>
              <div className="text-xs text-muted-foreground">Owner, Royal Books &amp; Stationery</div>
            </div>
          </div>
        </div>
        <img
          src={storeImg}
          alt="Bookstore checkout counter with POS terminal and barcode scanner"
          width={1200}
          height={912}
          loading="lazy"
          className="h-full w-full object-cover"
        />
      </section>

      <footer className="bg-sidebar text-sidebar-foreground">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-5 py-8">
          <div className="flex items-center gap-2">
            <BookOpen className="size-6" />
            <div className="leading-none">
              <div className="font-bold">Book POS</div>
              <div className="text-[10px] opacity-70">Manage • Sell • Grow</div>
            </div>
          </div>
          <nav className="flex gap-6 text-sm opacity-80">
            <a href="#home">Home</a>
            <a href="#features">Features</a>
            <a href="#why">Pricing</a>
            <a href="#about">About</a>
            <a href="#contact">Contact</a>
          </nav>
          <Link to="/app" className="text-sm underline opacity-80">
            Open Dashboard
          </Link>
        </div>
        <div className="border-t border-sidebar-border">
          <div className="mx-auto max-w-6xl px-5 py-4 text-xs opacity-70">
            © 2026 Book POS. All rights reserved.
          </div>
        </div>
      </footer>

      <LoginDialog open={loginOpen} onClose={() => setLoginOpen(false)} />
    </div>
  );
}
