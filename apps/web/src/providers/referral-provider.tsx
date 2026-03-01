import { createContext, useCallback, useContext, useState } from "react";

interface ReferralContextValue {
  isOpen: boolean;
  openReferral: () => void;
  closeReferral: () => void;
}

const ReferralContext = createContext<ReferralContextValue | null>(null);

export function ReferralProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  const openReferral = useCallback(() => setIsOpen(true), []);
  const closeReferral = useCallback(() => setIsOpen(false), []);

  return (
    <ReferralContext.Provider value={{ isOpen, openReferral, closeReferral }}>
      {children}
    </ReferralContext.Provider>
  );
}

export function useReferral() {
  const ctx = useContext(ReferralContext);
  if (!ctx) {
    throw new Error("useReferral must be used within a ReferralProvider");
  }
  return ctx;
}
