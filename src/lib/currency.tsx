"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";

// ─── Supported currencies ─────────────────────────────────────────────────────
// Rates are approximate USD → X, refreshed client-side via open.er-api.com (free)
// Fallback hardcoded rates are used if the fetch fails.

export interface CurrencyMeta {
  code: string;
  symbol: string;
  flag: string;
  name: string;
  /** Fallback rate vs USD (1 USD = X) */
  fallbackRate: number;
}

export const CURRENCIES: CurrencyMeta[] = [
  { code: "USD", symbol: "$",   flag: "🇺🇸", name: "US Dollar",          fallbackRate: 1 },
  { code: "SGD", symbol: "S$",  flag: "🇸🇬", name: "Singapore Dollar",   fallbackRate: 1.35 },
  { code: "AUD", symbol: "A$",  flag: "🇦🇺", name: "Australian Dollar",  fallbackRate: 1.55 },
  { code: "EUR", symbol: "€",   flag: "🇪🇺", name: "Euro",               fallbackRate: 0.92 },
  { code: "GBP", symbol: "£",   flag: "🇬🇧", name: "British Pound",      fallbackRate: 0.79 },
  { code: "JPY", symbol: "¥",   flag: "🇯🇵", name: "Japanese Yen",       fallbackRate: 151 },
  { code: "CAD", symbol: "C$",  flag: "🇨🇦", name: "Canadian Dollar",    fallbackRate: 1.37 },
  { code: "MYR", symbol: "RM",  flag: "🇲🇾", name: "Malaysian Ringgit",  fallbackRate: 4.71 },
  { code: "PHP", symbol: "₱",   flag: "🇵🇭", name: "Philippine Peso",    fallbackRate: 58.5 },
  { code: "IDR", symbol: "Rp",  flag: "🇮🇩", name: "Indonesian Rupiah",  fallbackRate: 16200 },
  { code: "NZD", symbol: "NZ$", flag: "🇳🇿", name: "New Zealand Dollar", fallbackRate: 1.64 },
];

// Map country codes (from Intl locale) → currency codes
const LOCALE_CURRENCY_MAP: Record<string, string> = {
  US: "USD", SG: "SGD", AU: "AUD", DE: "EUR", FR: "EUR", IT: "EUR",
  ES: "EUR", NL: "EUR", BE: "EUR", AT: "EUR", PT: "EUR", FI: "EUR",
  GB: "GBP", JP: "JPY", CA: "CAD", MY: "MYR", PH: "PHP", ID: "IDR",
  NZ: "NZD",
};

function detectLocaleCurrency(): string {
  try {
    // Try to get country from Intl locale (works in most modern browsers)
    const locale = Intl.DateTimeFormat().resolvedOptions().locale;
    const region = new Intl.Locale(locale).region;
    if (region && LOCALE_CURRENCY_MAP[region]) {
      return LOCALE_CURRENCY_MAP[region];
    }
  } catch {
    // ignore
  }
  return "USD";
}

// ─── Context ──────────────────────────────────────────────────────────────────

interface CurrencyContextValue {
  currency: CurrencyMeta;
  setCurrencyCode: (code: string) => void;
  /** Convert USD cents → formatted string in active currency */
  formatPrice: (usdCents: number) => string;
  rates: Record<string, number>;
}

const CurrencyContext = createContext<CurrencyContextValue | null>(null);

const STORAGE_KEY = "tcgt_currency";
const RATES_CACHE_KEY = "tcgt_fx_rates";
const RATES_CACHE_TTL = 1000 * 60 * 60 * 6; // 6 hours

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [currencyCode, setCurrencyCodeState] = useState<string>("USD");
  const [rates, setRates] = useState<Record<string, number>>(
    Object.fromEntries(CURRENCIES.map((c) => [c.code, c.fallbackRate]))
  );

  // On mount: detect locale currency + load saved preference + fetch live rates
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    const initial = saved ?? detectLocaleCurrency();
    setCurrencyCodeState(initial);

    // Try to use cached rates first
    try {
      const cached = localStorage.getItem(RATES_CACHE_KEY);
      if (cached) {
        const { ts, data } = JSON.parse(cached);
        if (Date.now() - ts < RATES_CACHE_TTL) {
          setRates(data);
          return;
        }
      }
    } catch {
      // ignore
    }

    // Fetch live rates (open.er-api.com — free, no key needed)
    fetch("https://open.er-api.com/v6/latest/USD")
      .then((r) => r.json())
      .then((json) => {
        if (json?.rates) {
          const liveRates: Record<string, number> = {};
          for (const c of CURRENCIES) {
            liveRates[c.code] = json.rates[c.code] ?? c.fallbackRate;
          }
          setRates(liveRates);
          localStorage.setItem(
            RATES_CACHE_KEY,
            JSON.stringify({ ts: Date.now(), data: liveRates })
          );
        }
      })
      .catch(() => {
        // silently fall back to hardcoded rates
      });
  }, []);

  const setCurrencyCode = useCallback((code: string) => {
    setCurrencyCodeState(code);
    localStorage.setItem(STORAGE_KEY, code);
  }, []);

  const currency =
    CURRENCIES.find((c) => c.code === currencyCode) ?? CURRENCIES[0];

  const formatPrice = useCallback(
    (usdCents: number): string => {
      const usd = usdCents / 100;
      const rate = rates[currency.code] ?? currency.fallbackRate;
      const converted = usd * rate;

      // JPY, IDR — no decimal places
      const noDecimals = ["JPY", "IDR"].includes(currency.code);
      const formatted = noDecimals
        ? Math.round(converted).toLocaleString()
        : converted.toFixed(2);

      return `${currency.symbol}${formatted}`;
    },
    [currency, rates]
  );

  return (
    <CurrencyContext.Provider
      value={{ currency, setCurrencyCode, formatPrice, rates }}
    >
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency(): CurrencyContextValue {
  const ctx = useContext(CurrencyContext);
  if (!ctx) throw new Error("useCurrency must be used inside <CurrencyProvider>");
  return ctx;
}
