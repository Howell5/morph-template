import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTheme } from "@/providers/theme-provider";
import { LANGUAGE_LABELS, SUPPORTED_LANGUAGES, type SupportedLanguage } from "@repo/shared";
import { useTranslation } from "react-i18next";

export function PreferencesTab() {
  const { t } = useTranslation("dashboard");
  const { t: tc } = useTranslation("common");
  const { theme, setTheme } = useTheme();
  const { i18n } = useTranslation();

  const handleLanguageChange = (lang: string) => {
    i18n.changeLanguage(lang);
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-medium">{t("settings.appearance")}</h3>
        <p className="text-sm text-muted-foreground">{t("settings.appearanceDesc")}</p>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label>{t("settings.theme")}</Label>
          <Select value={theme} onValueChange={setTheme}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="light">{tc("theme.light")}</SelectItem>
              <SelectItem value="dark">{tc("theme.dark")}</SelectItem>
              <SelectItem value="system">{tc("theme.system")}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center justify-between">
          <Label>{t("settings.language")}</Label>
          <Select
            value={i18n.language.startsWith("zh") ? "zh" : i18n.language}
            onValueChange={handleLanguageChange}
          >
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SUPPORTED_LANGUAGES.map((lang) => (
                <SelectItem key={lang} value={lang}>
                  {LANGUAGE_LABELS[lang as SupportedLanguage]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
