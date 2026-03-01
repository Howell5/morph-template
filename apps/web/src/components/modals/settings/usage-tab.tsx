import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { useSession } from "@/lib/auth-client";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";

export function UsageTab() {
  const { t } = useTranslation("dashboard");
  const { t: tc } = useTranslation("common");
  const { data: session } = useSession();
  const [page, setPage] = useState(1);

  const recordsQuery = useQuery({
    queryKey: ["credit-records", page],
    queryFn: async () => {
      const res = await api.api.user["usage-history"].$get({
        query: { page: String(page), limit: "10" },
      });
      const json = await res.json();
      if (!json.success) throw new Error("Failed to load");
      return json.data;
    },
    enabled: !!session,
  });

  const records = recordsQuery.data?.records ?? [];
  const pagination = recordsQuery.data?.pagination;

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium">{t("settings.usage")}</h3>

      {records.length === 0 && !recordsQuery.isLoading && (
        <p className="text-sm text-muted-foreground">No usage records yet.</p>
      )}

      {recordsQuery.isLoading && (
        <p className="text-sm text-muted-foreground">{tc("status.loading")}</p>
      )}

      <div className="space-y-2">
        {records.map((record) => (
          <div
            key={record.id}
            className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm"
          >
            <div className="flex items-center gap-2">
              <Badge variant={record.amount > 0 ? "default" : "secondary"} className="text-xs">
                {record.type.replace(/_/g, " ")}
              </Badge>
              <span className="text-muted-foreground">
                {new Date(record.createdAt).toLocaleDateString()}
              </span>
            </div>
            <span
              className={
                record.amount > 0 ? "text-green-600 dark:text-green-400" : "text-muted-foreground"
              }
            >
              {record.amount > 0 ? "+" : ""}
              {record.amount}
            </span>
          </div>
        ))}
      </div>

      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            {page} / {pagination.totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= pagination.totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
