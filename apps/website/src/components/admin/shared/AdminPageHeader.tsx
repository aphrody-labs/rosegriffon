import { cn } from "@/lib/utils";

interface AdminPageHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
	title: string;
	description?: string;
	actions?: React.ReactNode;
	icon?: React.ReactNode;
}

export function AdminPageHeader({
	title,
	description,
	actions,
	icon,
	className,
	children,
	...props
}: AdminPageHeaderProps) {
	return (
		<div
			className={cn(
				"flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-start sm:justify-between",
				className,
			)}
			{...props}
		>
			<div className="flex items-start gap-3">
				{icon && (
					<div className="mt-1 flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
						{icon}
					</div>
				)}
				<div className="space-y-1">
					<h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
						{title}
					</h1>
					{description && (
						<p className="text-sm text-muted-foreground">{description}</p>
					)}
					{children}
				</div>
			</div>
			{actions && (
				<div className="flex flex-wrap items-center gap-2 sm:justify-end">
					{actions}
				</div>
			)}
		</div>
	);
}
