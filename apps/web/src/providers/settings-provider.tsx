import { createContext, useCallback, useContext, useState } from "react";

type SettingsTab = "account" | "preferences" | "billing" | "usage";

interface SettingsContextValue {
  isOpen: boolean;
  activeTab: SettingsTab;
  openSettings: (tab?: SettingsTab) => void;
  closeSettings: () => void;
  setActiveTab: (tab: SettingsTab) => void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<SettingsTab>("account");

  const openSettings = useCallback((tab?: SettingsTab) => {
    if (tab) setActiveTab(tab);
    setIsOpen(true);
  }, []);

  const closeSettings = useCallback(() => setIsOpen(false), []);

  return (
    <SettingsContext.Provider
      value={{ isOpen, activeTab, openSettings, closeSettings, setActiveTab }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) {
    throw new Error("useSettings must be used within a SettingsProvider");
  }
  return ctx;
}
