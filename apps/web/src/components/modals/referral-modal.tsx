import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { api } from "@/lib/api";
import { useSession } from "@/lib/auth-client";
import { useReferral } from "@/providers/referral-provider";
import { REFERRAL_CONFIG } from "@repo/shared";
import { useQuery } from "@tanstack/react-query";
import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

export function ReferralModal() {
  const { t } = useTranslation("dashboard");
  const { t: tc } = useTranslation("common");
  const { isOpen, closeReferral } = useReferral();
  const { data: session } = useSession();
  const [copied, setCopied] = useState(false);

  const statsQuery = useQuery({
    queryKey: ["referral", "stats"],
    queryFn: async () => {
      const res = await api.api.referral.stats.$get();
      const json = await res.json();
      if (!json.success) throw new Error("Failed to load");
      return json.data;
    },
    enabled: isOpen && !!session,
  });

  const stats = statsQuery.data;
  const referralLink = stats?.referralCode
    ? `${window.location.origin}?ref=${stats.referralCode}`
    : "";
  const monthlyProgress = stats?.creditsThisMonth
    ? (stats.creditsThisMonth / REFERRAL_CONFIG.MONTHLY_LIMIT) * 100
    : 0;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(referralLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback ignored
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && closeReferral()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("referral.title")}</DialogTitle>
          <DialogDescription>{t("referral.description")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Reward info */}
          <p className="text-sm text-muted-foreground">
            {t("referral.rewardInfo", { amount: REFERRAL_CONFIG.REFERRER_REWARD })}
          </p>

          {/* Referral link */}
          <div className="space-y-2">
            <label htmlFor="referral-link" className="text-sm font-medium">
              {t("referral.yourLink")}
            </label>
            <div className="flex gap-2">
              <Input
                id="referral-link"
                value={referralLink}
                readOnly
                className="font-mono text-xs"
              />
              <Button variant="outline" size="icon" onClick={handleCopy}>
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          {/* Stats */}
          {stats && (
            <div className="space-y-4">
              <h4 className="text-sm font-medium">{t("referral.stats")}</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-lg border p-3 text-center">
                  <p className="text-2xl font-bold">{stats.totalReferrals}</p>
                  <p className="text-xs text-muted-foreground">{t("referral.totalReferrals")}</p>
                </div>
                <div className="rounded-lg border p-3 text-center">
                  <p className="text-2xl font-bold">{stats.totalCreditsEarned}</p>
                  <p className="text-xs text-muted-foreground">{t("referral.creditsEarned")}</p>
                </div>
              </div>

              {/* Monthly limit progress */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{t("referral.monthlyLimit")}</span>
                  <span>
                    {stats.creditsThisMonth} / {REFERRAL_CONFIG.MONTHLY_LIMIT}
                  </span>
                </div>
                <Progress value={monthlyProgress} className="h-2" />
              </div>
            </div>
          )}

          {statsQuery.isLoading && (
            <p className="text-sm text-muted-foreground">{tc("status.loading")}</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
