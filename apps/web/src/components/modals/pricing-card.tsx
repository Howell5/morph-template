import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { BillingInterval, PricingPlan } from "@repo/shared";
import { getPriceDisplay } from "@repo/shared";
import { Check } from "lucide-react";
import { useTranslation } from "react-i18next";

interface PricingCardProps {
  plan: PricingPlan;
  interval: BillingInterval;
  currentTier?: string;
  onSelect: (planId: string, interval: BillingInterval) => void;
  isLoading?: boolean;
}

export function PricingCard({
  plan,
  interval,
  currentTier,
  onSelect,
  isLoading,
}: PricingCardProps) {
  const { t } = useTranslation("common");
  const isCurrentPlan = currentTier === plan.id;
  const isFree = plan.monthlyPrice === 0;
  const priceInfo = getPriceDisplay(plan, interval);

  return (
    <div
      className={cn(
        "relative flex flex-col rounded-xl border p-6",
        plan.popular ? "border-primary ring-1 ring-primary" : "border-border",
      )}
    >
      {plan.popular && (
        <Badge className="absolute -top-2.5 left-1/2 -translate-x-1/2">
          {t("landing.mostPopular")}
        </Badge>
      )}

      <div className="mb-4">
        <h3 className="text-lg font-semibold">{plan.name}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{plan.description}</p>
      </div>

      <div className="mb-4">
        {isFree ? (
          <div className="text-3xl font-bold">{t("pricing.freePlan")}</div>
        ) : (
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-bold">${priceInfo.displayPrice}</span>
            <span className="text-sm text-muted-foreground">{t("pricing.perMonth")}</span>
          </div>
        )}
        {priceInfo.savings && priceInfo.savings > 0 && (
          <p className="mt-1 text-xs text-green-600 dark:text-green-400">
            {t("pricing.save", { amount: `$${priceInfo.savings}` })}
          </p>
        )}
      </div>

      <div className="mb-6 text-sm text-muted-foreground">
        {plan.subscriptionCredits > 0 ? (
          <span>{plan.subscriptionCredits.toLocaleString()} credits/month</span>
        ) : (
          <span>50 daily credits</span>
        )}
      </div>

      <div className="mt-auto">
        {isCurrentPlan ? (
          <Button variant="outline" className="w-full" disabled>
            {t("pricing.currentPlan")}
          </Button>
        ) : (
          <Button
            className="w-full"
            variant={plan.popular ? "default" : "outline"}
            onClick={() => onSelect(plan.id, interval)}
            disabled={isLoading || isFree}
          >
            {isFree ? t("pricing.currentPlan") : t("pricing.choosePlan")}
          </Button>
        )}
      </div>

      {plan.subscriptionCredits > 0 && (
        <ul className="mt-4 space-y-2 text-sm">
          <li className="flex items-center gap-2">
            <Check className="h-4 w-4 text-primary" />
            <span>{plan.subscriptionCredits.toLocaleString()} credits/month</span>
          </li>
          <li className="flex items-center gap-2">
            <Check className="h-4 w-4 text-primary" />
            <span>50 daily bonus credits</span>
          </li>
        </ul>
      )}
    </div>
  );
}
