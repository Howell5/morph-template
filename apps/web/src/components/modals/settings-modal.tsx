import { AccountTab } from "@/components/modals/settings/account-tab";
import { BillingTab } from "@/components/modals/settings/billing-tab";
import { PreferencesTab } from "@/components/modals/settings/preferences-tab";
import { UsageTab } from "@/components/modals/settings/usage-tab";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useSettings } from "@/providers/settings-provider";
import { BarChart3, CreditCard, Palette, User } from "lucide-react";
import { useTranslation } from "react-i18next";

const tabs = [
  { id: "account" as const, icon: User, titleKey: "settings.account" },
  { id: "preferences" as const, icon: Palette, titleKey: "settings.preferences" },
  { id: "billing" as const, icon: CreditCard, titleKey: "settings.billing" },
  { id: "usage" as const, icon: BarChart3, titleKey: "settings.usage" },
];

export function SettingsModal() {
  const { t } = useTranslation("dashboard");
  const { isOpen, closeSettings, activeTab, setActiveTab } = useSettings();

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && closeSettings()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden p-0">
        <div className="flex h-full">
          {/* Vertical tab navigation */}
          <div className="w-48 shrink-0 border-r bg-muted/30 p-4">
            <DialogHeader className="mb-4 px-2">
              <DialogTitle className="text-base">{t("settings.title")}</DialogTitle>
              <DialogDescription className="sr-only">{t("settings.profileDesc")}</DialogDescription>
            </DialogHeader>
            <nav className="space-y-1">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
                    activeTab === tab.id
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <tab.icon className="h-4 w-4" />
                  {t(tab.titleKey)}
                </button>
              ))}
            </nav>
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-y-auto p-6">
            {activeTab === "account" && <AccountTab />}
            {activeTab === "preferences" && <PreferencesTab />}
            {activeTab === "billing" && <BillingTab />}
            {activeTab === "usage" && <UsageTab />}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
