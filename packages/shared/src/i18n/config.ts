export const SUPPORTED_LANGUAGES = ["en", "zh"] as const;

export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export const DEFAULT_LANGUAGE: SupportedLanguage = "en";

export const LANGUAGE_LABELS: Record<SupportedLanguage, string> = {
  en: "English",
  zh: "中文",
};

export const I18N_NAMESPACES = ["common", "dashboard"] as const;

export type I18nNamespace = (typeof I18N_NAMESPACES)[number];
