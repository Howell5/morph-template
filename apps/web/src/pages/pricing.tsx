import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { api } from "@/lib/api";
import { useSession } from "@/lib/auth-client";
import { CREDIT_PACKAGES, formatPrice } from "@repo/shared";
import { useMutation } from "@tanstack/react-query";
import { CheckCircle2 } from "lucide-react";
import { useTranslation } from "react-i18next";

export function PricingPage() {
  const { t } = useTranslation("common");
  const { data: session } = useSession();

  const checkoutMutation = useMutation({
    mutationFn: async (packageId: string) => {
      const response = await api.api.checkout.$post({
        json: { packageId },
      });
      const json = await response.json();
      if (!json.success) {
        throw new Error(json.error?.message || "Failed to create checkout session");
      }
      return json.data;
    },
    onSuccess: (data) => {
      window.location.href = data.checkoutUrl;
    },
  });

  const handlePurchase = (packageId: string) => {
    if (!session) return;
    checkoutMutation.mutate(packageId);
  };

  return (
    <div className="container mx-auto py-12">
      <div className="mb-12 text-center">
        <h1 className="mb-4 text-4xl font-bold">{t("pricing.title")}</h1>
        <p className="text-lg text-muted-foreground">{t("pricing.subtitle")}</p>
      </div>

      <div className="grid gap-8 md:grid-cols-3">
        {CREDIT_PACKAGES.map((pkg) => (
          <Card key={pkg.id} className={pkg.popular ? "border-primary shadow-lg" : ""}>
            <CardHeader>
              {pkg.popular && (
                <div className="mb-2 inline-block rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">
                  {t("landing.mostPopular")}
                </div>
              )}
              <CardTitle className="text-2xl">{pkg.name}</CardTitle>
              <CardDescription>{pkg.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-6">
                <span className="text-4xl font-bold">{formatPrice(pkg.price, pkg.currency)}</span>
              </div>
              <ul className="space-y-2">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-primary" />
                  <span>{pkg.credits} credits</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-primary" />
                  <span>{t("pricing.neverExpire")}</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-primary" />
                  <span>{t("pricing.securePayment")}</span>
                </li>
              </ul>
            </CardContent>
            <CardFooter>
              <Button
                className="w-full"
                onClick={() => handlePurchase(pkg.id)}
                disabled={checkoutMutation.isPending}
                variant={pkg.popular ? "default" : "outline"}
              >
                {checkoutMutation.isPending ? t("actions.processing") : t("actions.purchase")}
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}
