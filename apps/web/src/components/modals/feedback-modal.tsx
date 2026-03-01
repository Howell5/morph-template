import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import { useFeedback } from "@/providers/feedback-provider";
import { FEEDBACK_TYPE_LABELS, type FeedbackType } from "@repo/shared";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

export function FeedbackModal() {
  const { t } = useTranslation("dashboard");
  const { t: tc } = useTranslation("common");
  const { isOpen, closeFeedback } = useFeedback();
  const [type, setType] = useState<FeedbackType>("general");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await api.api.feedback.$post({
        json: { type, title, description },
      });
      const json = await res.json();
      if (!json.success) throw new Error("Failed to submit feedback");
      return json.data;
    },
    onSuccess: () => {
      toast.success(t("feedback.successMessage"));
      resetAndClose();
    },
  });

  const resetAndClose = () => {
    setType("general");
    setTitle("");
    setDescription("");
    closeFeedback();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && resetAndClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("feedback.title")}</DialogTitle>
          <DialogDescription>{t("feedback.description")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>{t("feedback.type")}</Label>
            <Select value={type} onValueChange={(v) => setType(v as FeedbackType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.entries(FEEDBACK_TYPE_LABELS) as [FeedbackType, string][]).map(
                  ([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ),
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="feedback-title">{t("feedback.feedbackTitle")}</Label>
            <Input
              id="feedback-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t("feedback.feedbackTitlePlaceholder")}
              maxLength={200}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="feedback-desc">{t("feedback.feedbackDescription")}</Label>
            <Textarea
              id="feedback-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("feedback.feedbackDescriptionPlaceholder")}
              rows={4}
              maxLength={5000}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={resetAndClose}>
            {tc("actions.cancel")}
          </Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !title.trim() || !description.trim()}
          >
            {mutation.isPending ? tc("actions.submitting") : tc("actions.submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
