import Link from "next/link";
import { Icon } from "@/components/ui/Icon";

interface Breadcrumb {
  label: string;
  href?: string;
}

interface DashboardPageHeaderProps {
  breadcrumbs?: Breadcrumb[];
  title: string;
  subtitle?: string;
  icon?: string;
  actions?: React.ReactNode;
}

export function DashboardPageHeader({
  breadcrumbs,
  title,
  subtitle,
  icon,
  actions,
}: DashboardPageHeaderProps) {
  return (
    <div className="space-y-3 sm:space-y-4">
      {/* Breadcrumbs */}
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav className="flex items-center gap-1 text-sm text-on-surface-variant">
          {breadcrumbs.map((crumb, i) => (
            <span key={i} className="flex items-center gap-1">
              {i > 0 && (
                <Icon name="chevron_right" size={18} className="text-on-surface-variant/50" />
              )}
              {crumb.href ? (
                <Link href={crumb.href} className="hover:text-on-surface transition-colors">
                  {crumb.label}
                </Link>
              ) : (
                <span className="text-on-surface font-medium">{crumb.label}</span>
              )}
            </span>
          ))}
        </nav>
      )}

      {/* Title row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3 sm:gap-4">
          {icon && (
            <div className="size-10 sm:size-12 rounded-[16px] bg-primary-container text-on-primary-container flex items-center justify-center shrink-0">
              <Icon name={icon} size={24} />
            </div>
          )}
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-normal tracking-tight text-on-surface">
              {title}
            </h1>
            {subtitle && <p className="text-sm text-on-surface-variant mt-0.5">{subtitle}</p>}
          </div>
        </div>
        {actions && <div className="flex items-center gap-2 sm:gap-3 shrink-0">{actions}</div>}
      </div>
    </div>
  );
}
