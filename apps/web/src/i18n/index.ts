import { DEFAULT_LANGUAGE, SUPPORTED_LANGUAGES } from "@repo/shared";
import i18n from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { initReactI18next } from "react-i18next";

import enCommon from "@repo/shared/locales/en/common.json";
import enDashboard from "@repo/shared/locales/en/dashboard.json";
import zhCommon from "@repo/shared/locales/zh/common.json";
import zhDashboard from "@repo/shared/locales/zh/dashboard.json";

const resources = {
  en: {
    common: enCommon,
    dashboard: enDashboard,
  },
  zh: {
    common: zhCommon,
    dashboard: zhDashboard,
  },
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: DEFAULT_LANGUAGE,
    supportedLngs: [...SUPPORTED_LANGUAGES],
    defaultNS: "common",
    ns: ["common", "dashboard"],
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ["localStorage", "navigator"],
      lookupLocalStorage: "i18nextLng",
      caches: ["localStorage"],
    },
  });

export default i18n;
