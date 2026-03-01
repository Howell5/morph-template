import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { api } from "@/lib/api";
import { useSession } from "@/lib/auth-client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { CheckCircle2, User, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
};

export function SettingsPage() {
  const { t } = useTranslation("dashboard");
  const { t: tc } = useTranslation("common");
  const { data: session, refetch: refetchSession } = useSession();
  const queryClient = useQueryClient();
  const [name, setName] = useState(session?.user.name || "");
  const [saveStatus, setSaveStatus] = useState<"idle" | "success" | "error">("idle");

  // Sync name state when session changes
  useEffect(() => {
    if (session?.user.name) {
      setName(session.user.name);
    }
  }, [session?.user.name]);

  const updateMutation = useMutation({
    mutationFn: async (newName: string) => {
      const response = await api.api.user.me.$patch({
        json: { name: newName },
      });
      const json = await response.json();
      if (!json.success) {
        throw new Error(json.error?.message || "Failed to update profile");
      }
      return json.data;
    },
    onSuccess: () => {
      setSaveStatus("success");
      queryClient.invalidateQueries({ queryKey: ["user", "me"] });
      refetchSession();
      setTimeout(() => setSaveStatus("idle"), 3000);
    },
    onError: () => {
      setSaveStatus("error");
      setTimeout(() => setSaveStatus("idle"), 3000);
    },
  });

  const handleSave = () => {
    if (!name.trim()) return;
    updateMutation.mutate(name.trim());
  };

  return (
    <div className="space-y-8">
      <motion.div
        variants={fadeInUp}
        initial="initial"
        animate="animate"
        transition={{ duration: 0.4 }}
      >
        <h1 className="text-3xl font-bold">{t("settings.title")}</h1>
        <p className="mt-2 text-muted-foreground">{t("settings.profileDesc")}</p>
      </motion.div>

      <motion.div
        variants={fadeInUp}
        initial="initial"
        animate="animate"
        transition={{ duration: 0.4, delay: 0.1 }}
      >
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <User className="h-5 w-5" />
              <CardTitle>{t("settings.profile")}</CardTitle>
            </div>
            <CardDescription>{t("settings.profileDesc")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name">{t("settings.name")}</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">{t("settings.email")}</Label>
              <Input id="email" value={session?.user.email || ""} disabled className="bg-muted" />
              <p className="text-xs text-muted-foreground">{t("settings.emailReadOnly")}</p>
            </div>

            <div className="flex items-center gap-3">
              <Button onClick={handleSave} disabled={updateMutation.isPending || !name.trim()}>
                {updateMutation.isPending ? tc("actions.saving") : tc("actions.save")}
              </Button>
              {saveStatus === "success" && (
                <span className="flex items-center gap-1 text-sm text-green-600">
                  <CheckCircle2 className="h-4 w-4" />
                </span>
              )}
              {saveStatus === "error" && (
                <span className="flex items-center gap-1 text-sm text-destructive">
                  <XCircle className="h-4 w-4" />
                </span>
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div
        variants={fadeInUp}
        initial="initial"
        animate="animate"
        transition={{ duration: 0.4, delay: 0.2 }}
      >
        <Card>
          <CardHeader>
            <CardTitle className="text-destructive">{t("settings.dangerZone")}</CardTitle>
            <CardDescription>{t("settings.dangerZoneDesc")}</CardDescription>
          </CardHeader>
          <CardContent>
            <Separator className="mb-6" />
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">{tc("actions.deleteAccount")}</p>
                <p className="text-sm text-muted-foreground">{t("settings.deleteAccountDesc")}</p>
              </div>
              <Button variant="destructive" disabled>
                {tc("actions.deleteAccount")}
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
