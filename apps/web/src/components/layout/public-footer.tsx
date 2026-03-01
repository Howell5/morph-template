import { Logo } from "@/components/common/logo";
import { ROUTES } from "@/lib/routes";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

export function PublicFooter() {
  const { t } = useTranslation("common");

  return (
    <footer className="border-t bg-background">
      <div className="container mx-auto px-4 py-12">
        <div className="grid gap-8 md:grid-cols-4">
          {/* Brand */}
          <div className="md:col-span-2">
            <Logo className="text-2xl" />
            <p className="mt-4 max-w-xs text-sm text-muted-foreground">{t("footer.description")}</p>
          </div>

          {/* Links */}
          <div>
            <h3 className="font-semibold">{t("footer.product")}</h3>
            <ul className="mt-4 space-y-2">
              <li>
                <Link
                  to={ROUTES.PRICING}
                  className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  {t("nav.pricing")}
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h3 className="font-semibold">{t("footer.legal")}</h3>
            <ul className="mt-4 space-y-2">
              <li>
                <span className="text-sm text-muted-foreground">{t("footer.privacyPolicy")}</span>
              </li>
              <li>
                <span className="text-sm text-muted-foreground">{t("footer.termsOfService")}</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom */}
        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t pt-8 md:flex-row">
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} Morph. {t("footer.allRightsReserved")}
          </p>
        </div>
      </div>
    </footer>
  );
}
