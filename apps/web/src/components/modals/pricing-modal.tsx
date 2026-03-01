import { PricingCard } from "@/components/modals/pricing-card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { api } from "@/lib/api";
import { useSession } from "@/lib/auth-client";
import { usePaywall } from "@/providers/paywall-provider";
import { usePricing } from "@/providers/pricing-provider";
import { type BillingInterval, CREDIT_PACKAGES, PRICING_PLANS, formatPrice } from "@repo/shared";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";

export function PricingModal() {
  const { t } = useTranslation("common");
  const { isOpen, closePricing } = usePricing();
  const { paywallError, clearPaywall } = usePaywall();
  const { data: session } = useSession();
  const [interval, setInterval] = useState<BillingInterval>("month");

  const showModal = isOpen || !!paywallError;

  const handleClose = () => {
    closePricing();
    clearPaywall();
  };

  const userQuery = useQuery({
    queryKey: ["user", "me"],
    queryFn: async () => {
      const res = await api.api.user.me.$get();
      const json = await res.json();
      if (!json.success) throw new Error("Failed to load user data");
      return json.data;
    },
    enabled: showModal && !!session,
  });

  const subscriptionMutation = useMutation({
    mutationFn: async ({
      planId,
      billingInterval,
    }: { planId: string; billingInterval: BillingInterval }) => {
      const res = await api.api.checkout.subscription.$post({
        json: { planId: planId as "starter" | "pro" | "max", interval: billingInterval },
      });
      const json = await res.json();
      if (!json.success) throw new Error("Failed to create checkout");
      return json.data;
    },
    onSuccess: (data) => {
      window.location.href = data.checkoutUrl;
    },
  });

  const creditMutation = useMutation({
    mutationFn: async (packageId: string) => {
      const res = await api.api.checkout.$post({ json: { packageId } });
      const json = await res.json();
      if (!json.success) throw new Error("Failed to create checkout");
      return json.data;
    },
    onSuccess: (data) => {
      window.location.href = data.checkoutUrl;
    },
  });

  const currentTier = userQuery.data?.subscriptionTier || "free";

  return (
    <Dialog open={showModal} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("pricing.title")}</DialogTitle>
          <DialogDescription>{t("pricing.subtitle")}</DialogDescription>
        </DialogHeader>

        {/* Billing toggle */}
        <div className="flex items-center justify-center gap-3 py-2">
          <span className="text-sm">{t("pricing.monthly")}</span>
          <Switch
            checked={interval === "year"}
            onCheckedChange={(checked) => setInterval(checked ? "year" : "month")}
          />
          <span className="text-sm">{t("pricing.annual")}</span>
        </div>

        {/* Subscription plans */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PRICING_PLANS.map((plan) => (
            <PricingCard
              key={plan.id}
              plan={plan}
              interval={interval}
              currentTier={currentTier}
              onSelect={(planId, billingInterval) =>
                subscriptionMutation.mutate({ planId, billingInterval })
              }
              isLoading={subscriptionMutation.isPending}
            />
          ))}
        </div>

        {/* Credit packages */}
        <div className="mt-6">
          <h3 className="mb-1 text-lg font-semibold">{t("pricing.creditPackages")}</h3>
          <p className="mb-4 text-sm text-muted-foreground">
            {t("pricing.creditPackagesSubtitle")}
          </p>
          <div className="grid gap-4 sm:grid-cols-3">
            {CREDIT_PACKAGES.map((pkg) => (
              <div key={pkg.id} className="flex items-center justify-between rounded-lg border p-4">
                <div>
                  <p className="font-medium">{pkg.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {pkg.credits.toLocaleString()} credits
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => creditMutation.mutate(pkg.id)}
                  disabled={creditMutation.isPending}
                >
                  {formatPrice(pkg.price, pkg.currency)}
                </Button>
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
