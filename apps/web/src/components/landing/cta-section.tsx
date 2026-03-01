import { Button } from "@/components/ui/button";
import { ROUTES } from "@/lib/routes";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

export function CTASection() {
  const { t } = useTranslation("common");

  return (
    <section className="border-t py-24 md:py-32">
      <div className="container mx-auto px-4">
        <motion.div
          className="mx-auto max-w-3xl text-center"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">
            {t("landing.ctaTitle")}
          </h2>
          <p className="mx-auto mt-6 max-w-xl text-lg text-muted-foreground">
            {t("landing.ctaSubtitle")}
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Button asChild size="lg" className="min-w-[160px]">
              <Link to={ROUTES.LOGIN}>{t("actions.startBuilding")}</Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="min-w-[160px]">
              <Link to={ROUTES.LOGIN}>{t("actions.signIn")}</Link>
            </Button>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
