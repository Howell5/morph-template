import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5 },
  },
};

export function Features() {
  const { t } = useTranslation("common");

  const features = [
    { icon: "⚡", titleKey: "landing.featuresFast", descKey: "landing.featuresFastDesc" },
    { icon: "🔐", titleKey: "landing.featuresAuth", descKey: "landing.featuresAuthDesc" },
    { icon: "💳", titleKey: "landing.featuresPayments", descKey: "landing.featuresPaymentsDesc" },
    { icon: "🎨", titleKey: "landing.featuresUI", descKey: "landing.featuresUIDesc" },
    { icon: "📊", titleKey: "landing.featuresTypeSafe", descKey: "landing.featuresTypeSafeDesc" },
    { icon: "🚀", titleKey: "landing.featuresDeploy", descKey: "landing.featuresDeployDesc" },
  ];

  return (
    <section className="border-t py-24 md:py-32">
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-2xl text-center">
          <motion.h2
            className="text-3xl font-bold tracking-tight sm:text-4xl"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            Everything you need
          </motion.h2>
        </div>

        <motion.div
          className="mx-auto mt-16 grid max-w-5xl gap-8 sm:grid-cols-2 lg:grid-cols-3"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
        >
          {features.map((feature) => (
            <motion.div
              key={feature.titleKey}
              className="group relative rounded-2xl border bg-card p-6 transition-colors hover:bg-muted/50"
              variants={itemVariants}
            >
              <div className="mb-4 text-4xl">{feature.icon}</div>
              <h3 className="mb-2 text-lg font-semibold">{t(feature.titleKey)}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{t(feature.descKey)}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
