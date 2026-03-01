import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import { formatPrice } from "@repo/shared";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Clock, XCircle } from "lucide-react";
import { useTranslation } from "react-i18next";

export function OrdersPage() {
  const { t } = useTranslation("dashboard");
  const { t: tc } = useTranslation("common");

  const { data, isLoading, error } = useQuery({
    queryKey: ["orders"],
    queryFn: async () => {
      const response = await api.api.orders.$get({
        query: { page: "1", limit: "20" },
      });
      const json = await response.json();
      if (!json.success) {
        throw new Error(json.error?.message || "Failed to fetch orders");
      }
      return json.data;
    },
  });

  if (isLoading) {
    return <p className="text-muted-foreground">{tc("status.loading")}</p>;
  }

  if (error) {
    return <p className="text-destructive">{error.message}</p>;
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return (
          <Badge variant="default" className="gap-1">
            <CheckCircle2 className="h-3 w-3" />
            {tc("status.completed")}
          </Badge>
        );
      case "pending":
        return (
          <Badge variant="secondary" className="gap-1">
            <Clock className="h-3 w-3" />
            {tc("status.pending")}
          </Badge>
        );
      case "failed":
        return (
          <Badge variant="destructive" className="gap-1">
            <XCircle className="h-3 w-3" />
            {tc("status.failed")}
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div>
      <h1 className="mb-8 text-3xl font-bold">{t("orders.title")}</h1>

      {data?.orders.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            {t("orders.noOrders")}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {data?.orders.map((order) => (
            <Card key={order.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-xl">{order.credits} Credits</CardTitle>
                  {getStatusBadge(order.status)}
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid gap-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t("orders.amount")}:</span>
                    <span className="font-medium">{formatPrice(order.amount, order.currency)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t("orders.date")}:</span>
                    <span className="font-medium">
                      {new Date(order.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t("orders.transactionId")}:</span>
                    <span className="font-mono text-xs">{order.id}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
