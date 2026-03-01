import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import { useSession } from "@/lib/auth-client";
import { ROUTES } from "@/lib/routes";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { CreditCard, History, Settings, Zap } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
};

export function DashboardPage() {
  const { t } = useTranslation("dashboard");
  const { t: tc } = useTranslation("common");
  const { data: session } = useSession();

  const { data: userData, isLoading } = useQuery({
    queryKey: ["user", "me"],
    queryFn: async () => {
      const response = await api.api.user.me.$get();
      const json = await response.json();
      if (!json.success) {
        throw new Error(json.error?.message || "Failed to fetch user data");
      }
      return json.data;
    },
  });

  const quickActions = [
    {
      title: t("buyCredits"),
      description: t("buyCreditsDesc"),
      icon: CreditCard,
      href: ROUTES.BILLING,
    },
    {
      title: t("orderHistory"),
      description: t("orderHistoryDesc"),
      icon: History,
      href: ROUTES.ORDERS,
    },
    {
      title: tc("nav.settings"),
      description: t("settingsDesc"),
      icon: Settings,
      href: ROUTES.SETTINGS,
    },
  ];

  return (
    <div className="space-y-8">
      {/* Welcome Section */}
      <motion.div
        variants={fadeInUp}
        initial="initial"
        animate="animate"
        transition={{ duration: 0.4 }}
      >
        <h1 className="text-3xl font-bold">
          {session?.user.name ? t("welcome", { name: session.user.name }) : t("welcomeDefault")}
        </h1>
        <p className="mt-2 text-muted-foreground">{t("overview")}</p>
      </motion.div>

      {/* Credits Card */}
      <motion.div
        variants={fadeInUp}
        initial="initial"
        animate="animate"
        transition={{ duration: 0.4, delay: 0.1 }}
      >
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("creditsBalance")}</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold">
              {isLoading ? (
                <span className="text-muted-foreground">...</span>
              ) : (
                (userData?.credits?.total?.toLocaleString() ?? 0)
              )}
            </div>
            <Button asChild className="mt-4" size="sm">
              <Link to={ROUTES.BILLING}>{t("buyCredits")}</Link>
            </Button>
          </CardContent>
        </Card>
      </motion.div>

      {/* Quick Actions */}
      <motion.div
        variants={fadeInUp}
        initial="initial"
        animate="animate"
        transition={{ duration: 0.4, delay: 0.2 }}
      >
        <h2 className="mb-4 text-xl font-semibold">{t("quickActions")}</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {quickActions.map((action) => (
            <Link key={action.href} to={action.href}>
              <Card className="h-full transition-colors hover:bg-muted/50">
                <CardHeader>
                  <action.icon className="h-8 w-8 text-muted-foreground" />
                  <CardTitle className="text-lg">{action.title}</CardTitle>
                  <CardDescription>{action.description}</CardDescription>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
