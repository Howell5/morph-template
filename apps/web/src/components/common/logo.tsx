import { ROUTES } from "@/lib/routes";
import { Link } from "react-router-dom";

interface LogoProps {
  className?: string;
  compact?: boolean;
}

export function Logo({ className, compact }: LogoProps) {
  return (
    <Link to={ROUTES.HOME} className={`text-xl font-bold tracking-tight ${className}`}>
      {compact ? "M" : "Morph"}
    </Link>
  );
}
