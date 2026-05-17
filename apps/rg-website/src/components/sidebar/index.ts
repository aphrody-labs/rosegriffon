/**
 * Sidebar Atomic Components - Barrel Export
 *
 * These are the fundamental building blocks for the sidebar,
 * extracted to reduce duplication and improve maintainability.
 *
 * Usage:
 * import { SidebarMenuButton, SidebarCollapsibleItem } from '@/components/sidebar';
 */

export type { SidebarMenuButtonProps } from "./atoms/SidebarMenuButton";
export { SidebarMenuButton } from "./atoms/SidebarMenuButton";
export type { SidebarCollapsibleItemProps } from "./molecules/SidebarCollapsibleItem";
export { SidebarCollapsibleItem } from "./molecules/SidebarCollapsibleItem";
export type { SidebarSimpleItemProps } from "./molecules/SidebarSimpleItem";
export { SidebarSimpleItem } from "./molecules/SidebarSimpleItem";
export { SidebarNavLinks } from "./organisms/SidebarNavLinks";
