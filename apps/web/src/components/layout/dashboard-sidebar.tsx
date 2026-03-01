import { Logo } from "@/components/common/logo";
import { SidebarNavButton, SidebarNavItem } from "@/components/layout/sidebar-nav-item";
import { Separator } from "@/components/ui/separator";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ROUTES } from "@/lib/routes";
import { useFeedback } from "@/providers/feedback-provider";
import { useReferral } from "@/providers/referral-provider";
import { useSidebar } from "@/providers/sidebar-provider";
import {
  CreditCard,
  LayoutDashboard,
  MessageSquare,
  PanelLeftClose,
  PanelLeftOpen,
  Receipt,
  Settings,
  UserPlus,
} from "lucide-react";
import { useTranslation } from "react-i18next";

const navItems = [
  { titleKey: "nav.dashboard", href: ROUTES.DASHBOARD, icon: LayoutDashboard },
  { titleKey: "nav.orders", href: ROUTES.ORDERS, icon: Receipt },
  { titleKey: "nav.settings", href: ROUTES.SETTINGS, icon: Settings },
  { titleKey: "nav.billing", href: ROUTES.BILLING, icon: CreditCard },
];

interface DashboardSidebarProps {
  mobile?: boolean;
}

export function DashboardSidebar({ mobile }: DashboardSidebarProps) {
  const { t } = useTranslation("common");
  const sidebar = mobile ? null : useSidebarSafe();
  const collapsed = mobile ? false : (sidebar?.collapsed ?? false);
  const feedback = useFeedbackSafe();
  const referral = useReferralSafe();

  return (
    <TooltipProvider>
      <aside
        className={
          mobile
            ? "flex h-full w-64 flex-col bg-background"
            : "hidden flex-shrink-0 border-r bg-background transition-all duration-200 lg:flex lg:flex-col"
        }
        style={mobile ? undefined : { width: collapsed ? 52 : 256 }}
      >
        {/* Logo */}
        <div className="flex h-16 items-center border-b px-4">
          <Logo compact={collapsed} />
          {!mobile && (
            <button
              type="button"
              onClick={sidebar?.toggle}
              className="ml-auto text-muted-foreground hover:text-foreground transition-colors"
            >
              {collapsed ? (
                <PanelLeftOpen className="h-4 w-4" />
              ) : (
                <PanelLeftClose className="h-4 w-4" />
              )}
            </button>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 px-2 py-4">
          {navItems.map((item) => (
            <SidebarNavItem
              key={item.href}
              title={t(item.titleKey)}
              href={item.href}
              icon={item.icon}
              collapsed={collapsed}
            />
          ))}
        </nav>

        {/* Bottom actions */}
        <div className="px-2 pb-4 space-y-1">
          <Separator className="mb-2" />
          {feedback && (
            <SidebarNavButton
              title={t("nav.feedback")}
              icon={MessageSquare}
              collapsed={collapsed}
              onClick={feedback.openFeedback}
            />
          )}
          {referral && (
            <SidebarNavButton
              title={t("nav.inviteFriends")}
              icon={UserPlus}
              collapsed={collapsed}
              onClick={referral.openReferral}
            />
          )}
        </div>
      </aside>
    </TooltipProvider>
  );
}

function useSidebarSafe() {
  try {
    return useSidebar();
  } catch {
    return null;
  }
}

function useFeedbackSafe() {
  try {
    return useFeedback();
  } catch {
    return null;
  }
}

function useReferralSafe() {
  try {
    return useReferral();
  } catch {
    return null;
  }
}
