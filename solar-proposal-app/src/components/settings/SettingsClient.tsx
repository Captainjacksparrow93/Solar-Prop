"use client";

import { useState } from "react";
import { Settings, Building2, Zap, DollarSign, Loader2, Sun, Send, Key } from "lucide-react";
import { toast } from "@/components/ui/Toaster";

interface User { name: string | null; email: string; }
interface Company {
  name: string;
  logo: string | null;
  website: string | null;
  phone: string | null;
  address: string | null;
  primaryColor: string;
  defaultElectricityRate: number;
  defaultPanelWattage: number;
  defaultPanelCostPerWatt: number;
  defaultIncentivePercent: number;
  attomApiKey?: string | null;
  resendApiKey?: string | null;
  fromEmail?: string | null;
  fromName?: string | null;
  calendlyLink?: string | null;
}

interface Props {
  user: User | null;
  company: Company | null;
}

export function SettingsClient({ user, company }: Props) {
  const [userName, setUserName] = useState(user?.name ?? "");
  const [companyName, setCompanyName] = useState(company?.name ?? "");
  const [website, setWebsite] = useState(company?.website ?? "");
  const [phone, setPhone] = useState(company?.phone ?? "");
  const [address, setAddress] = useState(company?.address ?? "");
  const [primaryColor, setPrimaryColor] = useState(company?.primaryColor ?? "#f97316");
  const [electricityRate, setElectricityRate] = useState(company?.defaultElectricityRate ?? 9.0);
  const [panelWattage, setPanelWattage] = useState(company?.defaultPanelWattage ?? 400);
  const [panelCostPerWatt, setPanelCostPerWatt] = useState(company?.defaultPanelCostPerWatt ?? 45.0);
  const [incentivePercent, setIncentivePercent] = useState(company?.defaultIncentivePercent ?? 30);
  // Outreach & enrichment
  const [attomApiKey, setAttomApiKey] = useState(company?.attomApiKey ?? "");
  const [resendApiKey, setResendApiKey] = useState(company?.resendApiKey ?? "");
  const [fromEmail, setFromEmail] = useState(company?.fromEmail ?? "");
  const [fromName, setFromName] = useState(company?.fromName ?? "");
  const [calendlyLink, setCalendlyLink] = useState(company?.calendlyLink ?? "");
  const [saving, setSaving] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user: { name: userName },
          company: {
            name: companyName,
            website: website || null,
            phone: phone || null,
            address: address || null,
            primaryColor,
            defaultElectricityRate: Number(electricityRate),
            defaultPanelWattage: Number(panelWattage),
            defaultPanelCostPerWatt: Number(panelCostPerWatt),
            defaultIncentivePercent: Number(incentivePercent),
            attomApiKey: attomApiKey || null,
            resendApiKey: resendApiKey || null,
            fromEmail: fromEmail || null,
            fromName: fromName || null,
            calendlyLink: calendlyLink || null,
          },
        }),
      });

      if (res.ok) {
        toast("Settings saved!", "success");
      } else {
        toast("Failed to save settings", "error");
      }
    } catch {
      toast("Network error", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="text-slate-400 text-sm mt-1">
          Configure your company profile and default financial parameters.
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-5">
        {/* Profile */}
        <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Settings className="w-5 h-5 text-orange-400" />
            Your Profile
          </h2>
          <div>
            <label className="block text-sm text-slate-400 mb-1.5">Your name</label>
            <input
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-orange-500"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1.5">Email</label>
            <input
              value={user?.email ?? ""}
              disabled
              className="w-full px-3 py-2.5 bg-slate-800/50 border border-slate-700 rounded-lg text-slate-500 text-sm cursor-not-allowed"
            />
          </div>
        </section>

        {/* Company */}
        <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Building2 className="w-5 h-5 text-orange-400" />
            Company Profile
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm text-slate-400 mb-1.5">Company name *</label>
              <input required value={companyName} onChange={(e) => setCompanyName(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-orange-500" />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1.5">Phone</label>
              <input value={phone} onChange={(e) => setPhone(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-orange-500"
                placeholder="+1 555 000 0000" />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1.5">Website</label>
              <input value={website} onChange={(e) => setWebsite(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-orange-500"
                placeholder="https://yoursite.com" />
            </div>
            <div className="col-span-2">
              <label className="block text-sm text-slate-400 mb-1.5">Address</label>
              <input value={address} onChange={(e) => setAddress(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-orange-500" />
            </div>

            {/* Branding */}
            <div>
              <label className="block text-sm text-slate-400 mb-1.5">
                <Sun className="w-3.5 h-3.5 inline mr-1" />
                Brand color (proposals)
              </label>
              <div className="flex items-center gap-3">
                <input type="color" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)}
                  className="w-10 h-10 rounded-lg border border-slate-600 bg-transparent cursor-pointer" />
                <span className="text-sm text-slate-400 font-mono">{primaryColor}</span>
              </div>
            </div>
          </div>
        </section>

        {/* Financial defaults */}
        <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-orange-400" />
            Default Financial Parameters
          </h2>
          <p className="text-xs text-slate-500">
            These are pre-filled when analyzing rooftops. You can override them per-lead.
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1.5">Electricity rate (₹/kWh)</label>
              <input type="number" min={1} max={50} step={0.5} value={electricityRate}
                onChange={(e) => setElectricityRate(Number(e.target.value))}
                className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-orange-500" />
              <p className="text-xs text-slate-600 mt-1">India commercial avg: ₹8–12/kWh</p>
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1.5">
                <Zap className="w-3.5 h-3.5 inline mr-1" />
                Panel wattage (W)
              </label>
              <input type="number" min={100} max={700} step={10} value={panelWattage}
                onChange={(e) => setPanelWattage(Number(e.target.value))}
                className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-orange-500" />
              <p className="text-xs text-slate-600 mt-1">Typical: 400–545 W monocrystalline</p>
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1.5">Install cost (₹/watt)</label>
              <input type="number" min={20} max={200} step={1} value={panelCostPerWatt}
                onChange={(e) => setPanelCostPerWatt(Number(e.target.value))}
                className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-orange-500" />
              <p className="text-xs text-slate-600 mt-1">India 2024: ₹40–55/W all-in installed</p>
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1.5">Incentive / subsidy (%)</label>
              <input type="number" min={0} max={100} step={1} value={incentivePercent}
                onChange={(e) => setIncentivePercent(Number(e.target.value))}
                className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-orange-500" />
              <p className="text-xs text-slate-600 mt-1">PM Surya Ghar (residential): 30–40% | Commercial: accelerated depreciation</p>
            </div>
          </div>
        </section>

        {/* Outreach & Enrichment */}
        <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Send className="w-5 h-5 text-orange-400" />
            Outreach & Enrichment
          </h2>
          <p className="text-xs text-slate-500">
            Configure API keys for owner lookup (ATTOM), email sending (Resend), and meeting booking (Calendly).
          </p>

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm text-slate-400 mb-1.5">
                <Key className="w-3.5 h-3.5 inline mr-1" />
                ATTOM Data API Key
              </label>
              <input type="password" value={attomApiKey} onChange={(e) => setAttomApiKey(e.target.value)}
                placeholder="Your ATTOM API key"
                className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-orange-500 font-mono" />
              <p className="text-xs text-slate-600 mt-1">Used for finding real building owners. Get yours at attomdata.com</p>
            </div>
            <div className="col-span-2">
              <label className="block text-sm text-slate-400 mb-1.5">
                <Key className="w-3.5 h-3.5 inline mr-1" />
                Resend API Key
              </label>
              <input type="password" value={resendApiKey} onChange={(e) => setResendApiKey(e.target.value)}
                placeholder="re_..."
                className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-orange-500 font-mono" />
              <p className="text-xs text-slate-600 mt-1">For sending personalised outreach emails. Get yours at resend.com (free: 100 emails/day)</p>
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1.5">From Name</label>
              <input value={fromName} onChange={(e) => setFromName(e.target.value)}
                placeholder="Jane Smith"
                className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-orange-500" />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1.5">From Email</label>
              <input type="email" value={fromEmail} onChange={(e) => setFromEmail(e.target.value)}
                placeholder="jane@yourcompany.com"
                className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-orange-500" />
              <p className="text-xs text-slate-600 mt-1">Must be verified in your Resend account</p>
            </div>
            <div className="col-span-2">
              <label className="block text-sm text-slate-400 mb-1.5">Calendly Booking Link</label>
              <input value={calendlyLink} onChange={(e) => setCalendlyLink(e.target.value)}
                placeholder="https://calendly.com/yourname/solar-consultation"
                className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-orange-500" />
              <p className="text-xs text-slate-600 mt-1">Embedded as the main CTA button in all outreach emails</p>
            </div>
          </div>
        </section>

        <button
          type="submit"
          disabled={saving}
          className="w-full py-3 bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
        >
          {saving ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</>
          ) : (
            "Save settings"
          )}
        </button>
      </form>
    </div>
  );
}
