"use client";

import React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  ArrowRight,
  CalendarDays,
  Clock,
  DollarSign,
  Users,
  Shield,
  BarChart3,
  Zap,
  Check,
} from "lucide-react";

const features = [
  {
    icon: <CalendarDays size={24} />,
    title: "Smart Rostering",
    description: "Drag-and-drop weekly rosters. Assign shifts, manage availability, and prevent scheduling conflicts.",
  },
  {
    icon: <Clock size={24} />,
    title: "Clock In / Out",
    description: "PIN-based kiosk for clocking in and out. GPS tracking and manager override support.",
  },
  {
    icon: <DollarSign size={24} />,
    title: "Payroll Engine",
    description: "Auto-calculate gross pay with award rates. Support for penalties, overtime, and public holidays.",
  },
  {
    icon: <Users size={24} />,
    title: "Team Management",
    description: "Invite employees via email. Self-service onboarding with bank details and emergency contacts.",
  },
  {
    icon: <Shield size={24} />,
    title: "Leave Management",
    description: "Accrual tracking, conflict detection, and multi-level approval workflows.",
  },
  {
    icon: <BarChart3 size={24} />,
    title: "Analytics & Xero",
    description: "Labour-vs-revenue tracking, sales recording, and one-click Xero sync for invoices.",
  },
];

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
};

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[hsl(var(--background))]">
      {/* Nav */}
      <nav className="fixed top-0 z-50 w-full border-b border-[hsl(var(--border))]/50 bg-[hsl(var(--background))]/80 backdrop-blur-lg">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[hsl(var(--brand))] text-white font-bold text-sm">
              AP
            </div>
            <span className="text-lg font-bold">AU Payroll</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login">
              <Button variant="ghost">Sign in</Button>
            </Link>
            <Link href="/register">
              <Button>
                Get Started <ArrowRight size={16} />
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden pt-32 pb-20">
        <div className="mx-auto max-w-6xl px-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="inline-flex items-center gap-2 rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-4 py-1.5 text-sm mb-6">
              <Zap size={14} className="text-[hsl(var(--brand))]" />
              <span className="text-[hsl(var(--muted-foreground))]">Built for Australian businesses</span>
            </div>

            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight leading-tight mb-6">
              Workforce management,
              <br />
              <span className="bg-gradient-to-r from-[hsl(var(--brand))] to-[hsl(220,90%,70%)] bg-clip-text text-transparent">
                simplified.
              </span>
            </h1>

            <p className="mx-auto max-w-2xl text-lg sm:text-xl text-[hsl(var(--muted-foreground))] mb-10">
              Rosters, timesheets, leave, payroll, and Xero integration — all in one platform.
              Stop juggling spreadsheets. Start managing smarter.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/register">
                <Button size="xl">
                  Start Free Trial <ArrowRight size={18} />
                </Button>
              </Link>
              <Link href="/login">
                <Button variant="outline" size="xl">
                  View Demo
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>

        {/* Background gradient */}
        <div className="absolute inset-0 -z-10 overflow-hidden">
          <div className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 h-[600px] w-[600px] rounded-full bg-[hsl(var(--brand))]/10 blur-3xl" />
          <div className="absolute right-0 top-1/2 h-[400px] w-[400px] rounded-full bg-[hsl(220,90%,70%)]/10 blur-3xl" />
        </div>
      </section>

      {/* Features */}
      <section className="py-20 bg-[hsl(var(--card))]">
        <div className="mx-auto max-w-6xl px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">Everything you need</h2>
            <p className="text-lg text-[hsl(var(--muted-foreground))] max-w-xl mx-auto">
              A complete workforce management suite designed for Australian compliance.
            </p>
          </div>

          <motion.div
            variants={container}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.2 }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {features.map((feature) => (
              <motion.div
                key={feature.title}
                variants={item}
                className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-6 hover:shadow-lg hover:border-[hsl(var(--brand))]/30 transition-all duration-300"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[hsl(var(--brand-light))] text-[hsl(var(--brand))] mb-4">
                  {feature.icon}
                </div>
                <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                <p className="text-sm text-[hsl(var(--muted-foreground))] leading-relaxed">{feature.description}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Pricing teaser */}
      <section className="py-20">
        <div className="mx-auto max-w-4xl px-6 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">Simple pricing</h2>
          <p className="text-lg text-[hsl(var(--muted-foreground))] mb-10">
            No hidden fees. Cancel anytime.
          </p>

          <div className="rounded-2xl border border-[hsl(var(--brand))]/30 bg-[hsl(var(--card))] p-8 sm:p-12 shadow-lg max-w-md mx-auto">
            <p className="text-sm font-medium text-[hsl(var(--brand))] mb-2 uppercase tracking-wider">Business Plan</p>
            <div className="flex items-baseline justify-center gap-1 mb-2">
              <span className="text-5xl font-bold">$4</span>
              <span className="text-[hsl(var(--muted-foreground))]">/ employee / month</span>
            </div>
            <p className="text-sm text-[hsl(var(--muted-foreground))] mb-8">Billed monthly. No minimum commitment.</p>

            <ul className="space-y-3 text-left mb-8">
              {[
                "Unlimited rosters & shifts",
                "Clock in/out kiosk",
                "Timesheet auto-generation",
                "Leave management",
                "Payroll calculations",
                "Xero integration",
                "Audit logging",
              ].map((feat) => (
                <li key={feat} className="flex items-center gap-2 text-sm">
                  <Check size={16} className="text-[hsl(var(--success))] shrink-0" />
                  {feat}
                </li>
              ))}
            </ul>

            <Link href="/register">
              <Button className="w-full" size="lg">
                Start Free Trial <ArrowRight size={16} />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[hsl(var(--border))] py-12">
        <div className="mx-auto max-w-6xl px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[hsl(var(--brand))] text-white font-bold text-xs">
              AP
            </div>
            <span className="font-semibold">AU Payroll</span>
          </div>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            © {new Date().getFullYear()} AU Payroll. Built by Bevarlabs.
          </p>
        </div>
      </footer>
    </div>
  );
}
