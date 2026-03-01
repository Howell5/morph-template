import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";

interface PricingContextValue {
  isOpen: boolean;
  openPricing: () => void;
  closePricing: () => void;
}

const PricingContext = createContext<PricingContextValue | null>(null);

export function PricingProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();

  // Open pricing modal via ?pricing=1 query param
  useEffect(() => {
    if (searchParams.get("pricing") === "1") {
      setIsOpen(true);
      searchParams.delete("pricing");
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const openPricing = useCallback(() => setIsOpen(true), []);
  const closePricing = useCallback(() => setIsOpen(false), []);

  return (
    <PricingContext.Provider value={{ isOpen, openPricing, closePricing }}>
      {children}
    </PricingContext.Provider>
  );
}

export function usePricing() {
  const ctx = useContext(PricingContext);
  if (!ctx) {
    throw new Error("usePricing must be used within a PricingProvider");
  }
  return ctx;
}
