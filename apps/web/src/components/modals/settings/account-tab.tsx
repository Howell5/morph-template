import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { api } from "@/lib/api";
import { authClient, useSession } from "@/lib/auth-client";
import { ROUTES } from "@/lib/routes";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

export function AccountTab() {
  const { t } = useTranslation("dashboard");
  const { t: tc } = useTranslation("common");
  const { data: session } = useSession();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [name, setName] = useState(session?.user.name || "");

  const updateMutation = useMutation({
    mutationFn: async (newName: string) => {
      const res = await api.api.user.me.$patch({ json: { name: newName } });
      const json = await res.json();
      if (!json.success) throw new Error("Failed to update profile");
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user"] });
      toast.success(t("settings.profile"));
    },
  });

  const handleSignOut = async () => {
    await authClient.signOut();
    navigate(ROUTES.HOME);
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-medium">{t("settings.profile")}</h3>
        <p className="text-sm text-muted-foreground">{t("settings.profileDesc")}</p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">{t("settings.name")}</Label>
          <div className="flex gap-2">
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="max-w-sm"
            />
            <Button
              onClick={() => updateMutation.mutate(name)}
              disabled={updateMutation.isPending || name === session?.user.name}
              size="sm"
            >
              {updateMutation.isPending ? tc("actions.saving") : tc("actions.save")}
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <Label>{t("settings.email")}</Label>
          <Input value={session?.user.email || ""} disabled className="max-w-sm" />
          <p className="text-xs text-muted-foreground">{t("settings.emailReadOnly")}</p>
        </div>
      </div>

      <Separator />

      <div>
        <h3 className="text-sm font-medium text-destructive">{t("settings.dangerZone")}</h3>
        <p className="text-sm text-muted-foreground">{t("settings.dangerZoneDesc")}</p>
        <div className="mt-4 flex gap-2">
          <Button variant="outline" onClick={handleSignOut}>
            {tc("actions.signOut")}
          </Button>
          <Button variant="destructive" disabled>
            {tc("actions.deleteAccount")}
          </Button>
        </div>
      </div>
    </div>
  );
}
