"use client";

import "./globals.css";

import { usePathname } from "next/navigation";
import { SidebarInset, SidebarProvider, Toaster } from "@rg/ui";

import { AppSidebar } from "@/components/app-sidebar";
import Footer from "@/components/layout/footer";
import { Header } from "@/components/layout/Header";
import { MobileBottomNavigation } from "@/components/layout/MobileBottomNavigation";
import SidebarNavigationHandler from "@/components/layout/SidebarNavigationHandler";
import EdgeSwipeDetector from "@/components/shared/EdgeSwipeDetector";
import MobileWatermark from "@/components/shared/MobileWatermark";
import { AuthProvider } from "@/contexts/auth-context";
import { ProfileProvider } from "@/contexts/profile-context";
import { ThemeProvider } from "@/contexts/theme-context";
import { useIsMobile } from "@/hooks/use-mobile";
import { Providers } from "@/lib/providers";
import { cn } from "@/lib/utils";
import { useSidebarStore } from "@/stores/sidebar-store";

function SidebarWrapper({ children }: { children: React.ReactNode }) {
	const { isOpen, setSidebarOpen } = useSidebarStore();
	const isMobile = useIsMobile();

	// Sur desktop avec mode offcanvas, forcer la sidebar à être toujours ouverte
	const sidebarOpen = isMobile ? isOpen : true;

	const handleOpenChange = (open: boolean) => {
		// Ne permettre la fermeture que sur mobile
		if (isMobile) {
			setSidebarOpen(open);
		}
	};

	return (
		<SidebarProvider open={sidebarOpen} onOpenChange={handleOpenChange}>
			{children}
		</SidebarProvider>
	);
}

export default function ClientLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	const isMobile = useIsMobile();
	const pathname = usePathname();
	const isAdminPage = pathname?.startsWith("/admin");

	const shouldHideSidebar = isAdminPage;

	return (
		<ThemeProvider>
			<Providers>
				<AuthProvider>
					<ProfileProvider>
						<SidebarWrapper>
							{/* Masquer AppSidebar sur les pages admin */}
							{!shouldHideSidebar && <AppSidebar />}
							<SidebarNavigationHandler />
							<EdgeSwipeDetector />
							<SidebarInset>
								<div
									className={cn(
										"flex flex-col min-h-[100dvh] w-full",
										"pb-[calc(4rem+env(safe-area-inset-bottom))] lg:pb-0", // Mobile-first padding via CSS
									)}
								>
									{isMobile && (
										<Header isMobile showSearch={false} showCart={false} />
									)}
									<div className="flex-1 w-full">
										<div className="min-h-full w-full overflow-x-hidden">
											<div className="flex-1 w-full">{children}</div>
										</div>
									</div>
									<Footer />
									<MobileWatermark />
									{/* Affiche la barre de nav du bas uniquement sur mobile */}
									{isMobile && <MobileBottomNavigation />}
								</div>
							</SidebarInset>
						</SidebarWrapper>
						<Toaster richColors position="top-right" />
					</ProfileProvider>
				</AuthProvider>
			</Providers>
		</ThemeProvider>
	);
}
