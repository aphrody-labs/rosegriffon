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
	SidebarHeader,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarRail,
	useSidebar,
} from "@rosegriffon/ui";
import {
	domaineDeLaRoute,
	itemsDeNavigation,
	estItemActif,
	type Domaine,
	type NavItem,
} from "../config/navigation";
import { iconMap } from "../lib/icons";
import { traduireNav } from "../lib/translations";
import { UniverseSwitch } from "./UniverseSwitch";

export interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
	items?: NavItem[];
	isAdmin?: boolean;
	t?: (key: string) => string;
	renderIcon?: (item: NavItem) => React.ReactNode;
	headerSlot?: React.ReactNode;
	footerSlot?: React.ReactNode;
}

/**
 * En-tête dynamique de la barre latérale :
 * Affiche l'identité du domaine actif (Rose Griffon, Azalée, Achilléa)
 * et propose un switch d'univers instantané sans casser le layout.
 */
export function SidebarUniverseHeader({
	pathname,
	isCollapsed,
}: {
	pathname: string;
	isCollapsed: boolean;
}) {
	const activeDomaine = domaineDeLaRoute(pathname);

	const info: Record<
		Domaine,
		{
			name: string;
			badge: string;
			logo: string;
			href: string;
			badgeColor: string;
		}
	> = {
		association: {
			name: "Rose Griffon",
			badge: "Association",
			logo: "/RG_Logo_V2.5.webp",
			href: "/",
			badgeColor: "bg-primary/10 text-primary border-primary/20",
		},
		wiki: {
			name: "Azalée",
			badge: "Wiki VR",
			logo: "/RG_Azalee-logo.webp",
			href: "/wiki",
			badgeColor: "bg-secondary/15 text-secondary border-secondary/30",
		},
		esport: {
			name: "Achilléa",
			badge: "E-Sport",
			logo: "/achillea/logo1.svg",
			href: "/achillea",
			badgeColor:
				"bg-achillea-violet/15 dark:bg-achillea-lime/20 text-achillea-violet dark:text-achillea-lime border-achillea-violet/30 dark:border-achillea-lime/40",
		},
	};

	const current = info[activeDomaine];

	if (isCollapsed) {
		return (
			<SidebarHeader className="p-2 flex items-center justify-center border-b border-outline-variant/15">
				<Link
					href={current.href}
					className="relative size-10 rounded-xl p-1.5 flex items-center justify-center hover:bg-surface-container-high transition-colors"
					title={`${current.name} — ${current.badge}`}
				>
					<Image
						src={current.logo}
						alt={current.name}
						fill
						sizes="32px"
						className="object-contain"
					/>
				</Link>
			</SidebarHeader>
		);
	}

	return (
		<SidebarHeader className="p-3 border-b border-outline-variant/15 space-y-2.5">
			{/* Univers Identity */}
			<div className="flex items-center justify-between gap-2">
				<Link
					href={current.href}
					className="flex items-center gap-2.5 min-w-0 group/brand flex-1"
				>
					<div className="relative size-8 shrink-0 rounded-lg overflow-hidden p-0.5 bg-surface-container-high border border-outline-variant/20 group-hover/brand:scale-105 transition-transform">
						<Image
							src={current.logo}
							alt={current.name}
							fill
							sizes="32px"
							className="object-contain"
						/>
					</div>
					<div className="min-w-0 flex-1">
						<div className="flex items-center gap-1.5">
							<span className="font-black text-sm text-on-surface truncate group-hover/brand:text-primary transition-colors">
								{current.name}
							</span>
							<span className={`text-xs font-bold px-1.5 py-0.5 rounded border ${current.badgeColor}`}>
								{current.badge}
							</span>
						</div>
					</div>
				</Link>
			</div>

			{/* Universe Switcher intégré directement dans la sidebar */}
			<div className="flex items-center justify-center pt-0.5">
				<UniverseSwitch className="w-full justify-between px-2 py-1 bg-surface-container-low/80 border border-outline-variant/20" />
			</div>
		</SidebarHeader>
	);
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
	const activeDomaine = domaineDeLaRoute(pathname);

	// Détection si l'élément correspond à l'univers actif courant
	const isUniversePillar =
		depth === 0 &&
		((item.path === "#actualite" && activeDomaine === "association") ||
			(item.path === "#association" && activeDomaine === "association") ||
			(item.path === "#wiki" && activeDomaine === "wiki") ||
			(item.path === "#esport" && activeDomaine === "esport"));

	const [isOpen, setIsOpen] = React.useState(isActive || isUniversePillar || Boolean(item.defaultOpen));

	React.useEffect(() => {
		if (isActive || isUniversePillar) {
			setIsOpen(true);
		}
	}, [isActive, isUniversePillar]);

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
					className={`ml-auto text-on-surface-variant/75 transition-transform duration-200 ${
						isOpen ? "rotate-90" : ""
					}`}
					aria-hidden="true"
				/>
			)}
		</>
	);

	if (item.children && !isCollapsed) {
		const isPillar = depth === 0 && item.groupOnly;
		const pillarColor =
			item.path === "#association"
				? "text-rose-griffon"
				: item.path === "#esport"
					? "text-achillea-violet dark:text-achillea-lime"
					: "text-secondary";

		const pillarBg =
			item.path === "#association"
				? "bg-rose-griffon/10 text-rose-griffon border-rose-griffon/25"
				: item.path === "#esport"
					? "bg-achillea-violet/10 dark:bg-achillea-lime/10 text-achillea-violet dark:text-achillea-lime border-achillea-violet/25 dark:border-achillea-lime/30"
					: "bg-secondary/10 text-secondary border-secondary/25";

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
												isActive || isUniversePillar
													? `${pillarBg} font-black shadow-xs`
													: "border-outline-variant/20 text-on-surface-variant font-bold bg-surface-container-low/60 hover:bg-surface-container hover:text-on-surface"
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
									} ${isActive || isUniversePillar ? "font-black" : ""}`}
								>
									{traduireNav(item.label, t)}
								</span>
								{isUniversePillar && (
									<span className="text-xs font-bold px-1.5 py-0.5 rounded bg-surface/80 text-on-surface-variant mr-1.5 border border-outline-variant/20 uppercase tracking-tighter shrink-0">
										Actif
									</span>
								)}
								<ChevronRight
									size={16}
									className={`shrink-0 text-on-surface-variant/75 transition-transform duration-200 ${
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
								<button className="size-9 flex items-center justify-center rounded-lg text-on-surface-variant/75 hover:text-on-surface-variant hover:bg-on-surface/[0.08] transition-colors shrink-0">
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
	const { state, isMobile } = useSidebar();
	const isCollapsed = state === "collapsed" && !isMobile;

	const [mounted, setMounted] = React.useState(false);
	React.useEffect(() => {
		setMounted(true);
	}, []);

	const filteredNavItems = resolvedNavItems.filter(
		(item) => !item.adminOnly || (mounted && isAdmin)
	);

	const defaultHeader = (
		<SidebarUniverseHeader pathname={pathname} isCollapsed={isCollapsed} />
	);

	return (
		<Sidebar
			collapsible="icon"
			variant="sidebar"
			className={`border-none bg-surface ${className ?? ""}`}
			{...props}
		>
			<div className="absolute inset-0 bg-surface -z-10" />

			{headerSlot === undefined ? defaultHeader : headerSlot}

			<SidebarContent className="py-2 bg-surface">
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
