import { motion } from "framer-motion";
import { LucideIcon } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string | number;
  change?: string;
  changeType?: "positive" | "negative" | "neutral";
  icon: LucideIcon;
  gradient?: "primary" | "secondary" | "accent";
}

const gradientMap = {
  primary: "gradient-primary",
  secondary: "gradient-secondary",
  accent: "gradient-accent",
};

export default function StatCard({ title, value, change, changeType = "neutral", icon: Icon, gradient = "primary" }: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="group relative overflow-hidden bg-card rounded-2xl p-6 shadow-card border border-border/70 transition-all duration-200 hover:shadow-elevated hover:-translate-y-0.5"
    >
      <div className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-primary/5 transition-transform duration-300 group-hover:scale-125" />
      <div className="relative flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <p className="text-[13px] text-muted-foreground font-medium">{title}</p>
          <p className="text-3xl font-heading font-extrabold tracking-tight text-card-foreground mt-2">{value}</p>
          {change && (
            <p className={`text-xs mt-2 font-medium ${
              changeType === "positive" ? "text-success" : changeType === "negative" ? "text-destructive" : "text-muted-foreground"
            }`}>
              {change}
            </p>
          )}
        </div>
        <div className={`w-12 h-12 rounded-2xl ${gradientMap[gradient]} flex items-center justify-center flex-shrink-0 shadow-card`}>
          <Icon className="w-5 h-5 text-primary-foreground" />
        </div>
      </div>
    </motion.div>

  );
}
