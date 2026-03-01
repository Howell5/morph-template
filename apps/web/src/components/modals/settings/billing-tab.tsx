import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { api } from "@/lib/api";
import { useSession } from "@/lib/auth-client";
import { usePricing } from "@/providers/pricing-provider";
import { useSettings } from "@/providers/settings-provider";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

export function BillingTab() {
  const { t } = useTranslation("dashboard");
  const { t: tc } = useTranslation("common");
  const { data: session } = useSession();
  const { openPricing } = usePricing();
  const { closeSettings } = useSettings();

  const userQuery = useQuery({
    queryKey: ["user", "me"],
    queryFn: async () => {
      const res = await api.api.user.me.$get();
      const json = await res.json();
      if (!json.success) throw new Error("Failed to load");
      return json.data;
    },
    enabled: !!session,
  });

  const manageMutation = useMutation({
    mutationFn: async () => {
      const res = await api.api.checkout.manage.$post({ json: {} });
      const json = await res.json();
      if (!json.success) throw new Error("Failed to open billing portal");
      return json.data;
    },
    onSuccess: (data) => {
      window.location.href = data.portalUrl;
    },
  });

  const data = userQuery.data;
  const credits = data?.credits;
  const tier = data?.subscriptionTier || "free";

  const handleUpgrade = () => {
    closeSettings();
    openPricing();
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-medium">{t("settings.currentPlan")}</h3>
        <div className="mt-2 flex items-center gap-2">
          <span className="text-lg font-semibold capitalize">{tier}</span>
          {tier === "free" ? (
            <Button size="sm" onClick={handleUpgrade}>
              {t("settings.upgradePlan")}
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              onClick={() => manageMutation.mutate()}
              disabled={manageMutation.isPending}
            >
              {t("settings.manageBilling")}
            </Button>
          )}
        </div>
      </div>

      <Separator />

      <div>
        <h3 className="text-sm font-medium mb-4">{t("settings.creditsOverview")}</h3>
        {credits && (
          <div className="space-y-4">
            <CreditRow
              label={t("settings.daily")}
              value={credits.daily}
              max={50}
              subtitle={t("settings.resetsAt", {
                time: new Date(credits.dailyResetsAt).toLocaleTimeString(),
              })}
            />
            {credits.subscriptionLimit > 0 && (
              <CreditRow
                label={t("settings.subscription")}
                value={credits.subscription}
                max={credits.subscriptionLimit}
                subtitle={
                  credits.subscriptionResetsAt
                    ? t("settings.resetsAt", {
                        time: new Date(credits.subscriptionResetsAt).toLocaleDateString(),
                      })
                    : undefined
                }
              />
            )}
            <CreditRow
              label={t("settings.bonus")}
              value={credits.bonus}
              subtitle={t("settings.neverExpires")}
            />
            <Separator />
            <div className="flex items-center justify-between">
              <span className="font-medium">{t("totalCredits")}</span>
              <span className="text-lg font-bold">{credits.total.toLocaleString()}</span>
            </div>
          </div>
        )}
        {!credits && <p className="text-sm text-muted-foreground">{tc("status.loading")}</p>}
      </div>
    </div>
  );
}

function CreditRow({
  label,
  value,
  max,
  subtitle,
}: {
  label: string;
  value: number;
  max?: number;
  subtitle?: string;
}) {
  const percentage = max ? Math.min((value / max) * 100, 100) : undefined;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span>{label}</span>
        <span className="font-medium">
          {value.toLocaleString()}
          {max ? ` / ${max.toLocaleString()}` : ""}
        </span>
      </div>
      {percentage !== undefined && <Progress value={percentage} className="h-2" />}
      {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
    </div>
  );
}
