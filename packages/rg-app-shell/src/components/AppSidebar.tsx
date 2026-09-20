"use client";

import { ChevronRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import * as React from "react";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
	Sidebar,
	SidebarContent,
	SidebarGroup,
	SidebarGroupContent,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarRail,
	useSidebar,
} from "@rosegriffon/ui";
import {
	itemsDeNavigation,
	estItemActif,
	type NavItem,
} from "../config/navigation";
import { iconMap } from "../lib/icons";
import { traduireNav } from "../lib/translations";

export interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
	items?: NavItem[];
	isAdmin?: boolean;
	t?: (key: string) => string;
	renderIcon?: (item: NavItem) => React.ReactNode;
	headerSlot?: React.ReactNode;
	footerSlot?: React.ReactNode;
}

function NavIcon({
	item,
	isActive,
	isCollapsed,
	depth,
	t,
	renderIcon,
}: {
	item: NavItem;
	isActive: boolean;
	isCollapsed: boolean;
	depth: number;
	t?: (key: string) => string;
	renderIcon?: (item: NavItem) => React.ReactNode;
}) {
	const customIcon = renderIcon ? renderIcon(item) : null;
	if (customIcon) {
		return <>{customIcon}</>;
	}

	const LucideIcon = iconMap[item.icon];

	if (item.imageUrl) {
		return (
			<div className="relative size-full">
				<Image
					src={item.imageUrl}
					alt={traduireNav(item.label, t)}
					fill
					className={`object-contain ${
						isActive
							? "opacity-100"
							: "opacity-70 grayscale group-hover:grayscale-0 group-hover:opacity-100"
					}`}
				/>
			</div>
		);
	}

	if (LucideIcon) {
		return (
			<LucideIcon
				size={isCollapsed && depth === 0 ? 24 : 20}
				fill={isActive ? "currentColor" : "none"}
				aria-hidden="true"
			/>
		);
	}

	return null;
}

function RecursiveNavItem({
	item,
	pathname,
	depth = 0,
	t,
	renderIcon,
}: {
	item: NavItem;
	pathname: string;
	depth?: number;
	t?: (key: string) => string;
	renderIcon?: (item: NavItem) => React.ReactNode;
}) {
	const isActive = estItemActif(pathname, item);
	const [isOpen, setIsOpen] = React.useState(isActive || Boolean(item.defaultOpen));

	React.useEffect(() => {
		if (isActive) {
			setIsOpen(true);
		}
	}, [isActive]);

	const { state, isMobile } = useSidebar();
	const isCollapsed = state === "collapsed" && !isMobile;

	const buttonClass = `relative overflow-hidden w-full transition-all duration-200 group rounded-xl focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 outline-hidden ${
		isCollapsed && depth === 0
			? "h-[56px] flex-col justify-center px-1 gap-1 group-data-[collapsible=icon]:size-auto! group-data-[collapsible=icon]:h-14! group-data-[collapsible=icon]:w-full! group-data-[collapsible=icon]:p-1!"
			: "h-11 px-4 gap-3 justify-start"
	} ${
		isActive
			? "bg-secondary-container text-on-secondary-container font-bold"
			: "text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high active:bg-surface-container-highest"
	}`;

	const iconClass = `flex items-center justify-center transition-transform duration-200 ${
		isCollapsed && depth === 0 ? "size-6" : "size-5"
	} ${isActive && !item.imageUrl && !item.commonSprite ? "scale-110" : ""} group-hover:scale-110`;

	const itemContent = (
		<>
			<div className={iconClass}>
				<NavIcon
					item={item}
					isActive={Boolean(isActive)}
					isCollapsed={isCollapsed}
					depth={depth}
					t={t}
					renderIcon={renderIcon}
				/>
			</div>

			{(!isCollapsed || depth > 0) && (
				<span
					className={`whitespace-nowrap transition-all duration-300 font-medium truncate flex-1 text-sm ${
						isActive ? "font-bold" : ""
					}`}
				>
					{traduireNav(item.label, t)}
				</span>
			)}

			{item.children && (!isCollapsed || depth > 0) && (
				<ChevronRight
					size={18}
					className={`ml-auto text-on-surface-variant/50 transition-transform duration-200 ${
						isOpen ? "rotate-90" : ""
					}`}
					aria-hidden="true"
				/>
			)}
		</>
	);

	if (item.children && !isCollapsed) {
		const isPillar = depth === 0 && item.groupOnly;
		const pillarColor = item.path === "#association"
			? "text-rose-griffon"
			: item.path === "#esport"
				? "text-achillea-violet dark:text-achillea-lime"
				: "text-secondary";

		const pillarBg = item.path === "#association"
			? "bg-rose-griffon/10 text-rose-griffon border-rose-griffon/20"
			: item.path === "#esport"
				? "bg-achillea-violet/10 dark:bg-achillea-lime/10 text-achillea-violet dark:text-achillea-lime border-achillea-violet/25 dark:border-achillea-lime/25"
				: "bg-secondary/10 text-secondary border-secondary/20";

		return (
			<Collapsible open={isOpen} onOpenChange={setIsOpen} className="w-full">
				<SidebarMenuItem>
					{item.groupOnly ? (
						<CollapsibleTrigger asChild>
							<SidebarMenuButton
								isActive={isActive}
								tooltip={traduireNav(item.label, t)}
								className={
									isPillar
										? `relative overflow-hidden w-full transition-all duration-200 group rounded-xl px-3 py-2.5 h-auto flex items-center justify-between mt-3 mb-1 first:mt-0 font-extrabold text-xs tracking-wider uppercase border outline-hidden focus-visible:ring-2 focus-visible:ring-primary ${
												isActive
													? `${pillarBg} font-black`
													: "border-outline-variant/15 text-on-surface-variant bg-surface-container-low/50 hover:bg-surface-container hover:text-on-surface"
										  }`
										: `${buttonClass} w-full`
								}
								aria-expanded={isOpen}
							>
								<div className={isPillar ? `flex items-center justify-center size-5 ${pillarColor}` : iconClass}>
									<NavIcon
										item={item}
										isActive={Boolean(isActive)}
										isCollapsed={isCollapsed}
										depth={depth}
										t={t}
										renderIcon={renderIcon}
									/>
								</div>
								<span
									className={`whitespace-nowrap transition-all duration-300 truncate flex-1 text-left ${
										isPillar ? "font-extrabold text-xs tracking-wider" : "text-sm font-medium"
									} ${isActive ? "font-bold" : ""}`}
								>
									{traduireNav(item.label, t)}
								</span>
								<ChevronRight
									size={16}
									className={`shrink-0 text-on-surface-variant/50 transition-transform duration-200 ${
										isOpen ? "rotate-90" : ""
									}`}
									aria-hidden="true"
								/>
							</SidebarMenuButton>
						</CollapsibleTrigger>
					) : (
						<div className="flex items-center w-full">
							<SidebarMenuButton
								asChild
								isActive={isActive}
								tooltip={traduireNav(item.label, t)}
								className={`${buttonClass} flex-1 min-w-0 !pr-0`}
							>
								<Link href={item.path} aria-current={isActive ? "page" : undefined}>
									<div className={iconClass}>
										<NavIcon
											item={item}
											isActive={Boolean(isActive)}
											isCollapsed={isCollapsed}
											depth={depth}
											t={t}
											renderIcon={renderIcon}
										/>
									</div>
									<span
										className={`whitespace-nowrap transition-all duration-300 font-medium truncate flex-1 text-sm ${
											isActive ? "font-bold" : ""
										}`}
									>
										{traduireNav(item.label, t)}
									</span>
								</Link>
							</SidebarMenuButton>
							<CollapsibleTrigger asChild>
								<button className="size-9 flex items-center justify-center rounded-lg text-on-surface-variant/50 hover:text-on-surface-variant hover:bg-on-surface/[0.08] transition-colors shrink-0">
									<ChevronRight
										size={18}
										className={`transition-transform duration-200 ${isOpen ? "rotate-90" : ""}`}
										aria-hidden="true"
									/>
								</button>
							</CollapsibleTrigger>
						</div>
					)}
					<CollapsibleContent className="overflow-hidden data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down">
						<SidebarMenu className="mt-1 ml-4 border-l-2 border-outline-variant/20 pl-2 space-y-1">
							{item.children.map((child) => (
								<RecursiveNavItem
									key={child.path}
									item={child}
									pathname={pathname}
									depth={depth + 1}
									t={t}
									renderIcon={renderIcon}
								/>
							))}
						</SidebarMenu>
					</CollapsibleContent>
				</SidebarMenuItem>
			</Collapsible>
		);
	}

	const href = item.groupOnly ? (item.children?.[0]?.path ?? item.path) : item.path;

	return (
		<SidebarMenuItem>
			<SidebarMenuButton
				asChild
				isActive={isActive}
				tooltip={traduireNav(item.label, t)}
				className={buttonClass}
			>
				<Link href={href} aria-current={isActive ? "page" : undefined}>
					{itemContent}
				</Link>
			</SidebarMenuButton>
		</SidebarMenuItem>
	);
}

export function AppSidebar({
	items,
	isAdmin = false,
	t,
	renderIcon,
	headerSlot,
	footerSlot,
	className,
	...props
}: AppSidebarProps) {
	const pathname = usePathname() || "/";
	const resolvedNavItems = items ?? itemsDeNavigation();

	const [mounted, setMounted] = React.useState(false);
	React.useEffect(() => {
		setMounted(true);
	}, []);

	const filteredNavItems = resolvedNavItems.filter(
		(item) => !item.adminOnly || (mounted && isAdmin)
	);

	return (
		<Sidebar
			collapsible="icon"
			variant="sidebar"
			className={`border-none bg-surface ${className ?? ""}`}
			{...props}
		>
			<div className="absolute inset-0 bg-surface -z-10" />

			{headerSlot}

			<SidebarContent className="py-4 bg-surface">
				<SidebarGroup>
					<SidebarGroupContent>
						<SidebarMenu className="gap-1">
							{filteredNavItems.map((item) => (
								<div key={item.path} className="w-full">
									<RecursiveNavItem
										item={item}
										pathname={pathname}
										t={t}
										renderIcon={renderIcon}
									/>
								</div>
							))}
						</SidebarMenu>
					</SidebarGroupContent>
				</SidebarGroup>
			</SidebarContent>

			{footerSlot}

			<SidebarRail />
		</Sidebar>
	);
}

export { AppSidebar as WikiSidebar };
export default AppSidebar;
