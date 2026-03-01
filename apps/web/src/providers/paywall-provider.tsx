import { setPaywallHandler } from "@/lib/api";
import { createContext, useCallback, useContext, useEffect, useState } from "react";

interface PaywallContextValue {
  paywallError: string | null;
  clearPaywall: () => void;
}

const PaywallContext = createContext<PaywallContextValue | null>(null);

export function PaywallProvider({ children }: { children: React.ReactNode }) {
  const [paywallError, setPaywallError] = useState<string | null>(null);

  useEffect(() => {
    setPaywallHandler((errorCode) => setPaywallError(errorCode));
    return () => setPaywallHandler(null);
  }, []);

  const clearPaywall = useCallback(() => setPaywallError(null), []);

  return (
    <PaywallContext.Provider value={{ paywallError, clearPaywall }}>
      {children}
    </PaywallContext.Provider>
  );
}

export function usePaywall() {
  const ctx = useContext(PaywallContext);
  if (!ctx) {
    throw new Error("usePaywall must be used within a PaywallProvider");
  }
  return ctx;
}
