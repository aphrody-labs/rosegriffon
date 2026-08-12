"use client";

import { Button } from "@rosegriffon/ui";
import { Share2 } from "lucide-react";
import { toast } from "sonner";

import TwitterIcon from "@/shared/icons/twitter";

interface ShareButtonsProps {
	title: string;
	slug: string;
}

export function ShareButtons({ title, slug }: ShareButtonsProps) {
	const getUrl = () => {
		// Falls back to window.location if configured URL is missing,
		// But constructing from slug is safer for SSR consistency if we know the base URL.
		if (typeof window !== "undefined") {
			return window.location.href;
		}
		return `https://rosegriffon.fr/chroniques/${slug}`;
	};

	const handleShare = async () => {
		const url = getUrl();
		const shareData = {
			title,
			text: title,
			url,
		};

		try {
			if (navigator.share && navigator.canShare?.(shareData)) {
				await navigator.share(shareData);
			} else {
				await navigator.clipboard.writeText(url);
				toast.success("Lien copié dans le presse-papier !");
			}
		} catch (error) {
			console.error("Error sharing:", error);
			// Don't show error if user cancelled the share dialog
			if (error instanceof Error && error.name !== "AbortError") {
				toast.error("Impossible de partager le lien");
			}
		}
	};

	const handleTweet = () => {
		const url = getUrl();
		const text = `Découvrez "${title}" sur Rose Griffon !`;
		const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(
			text
		)}&url=${encodeURIComponent(url)}&via=rose_griffon`;

		window.open(twitterUrl, "_blank", "width=600,height=400");
	};

	return (
		<div className="mt-8 flex justify-end gap-4">
			<Button
				variant="outline"
				size="sm"
				onClick={handleShare}
				className="hover:bg-primary/5 hover:text-primary transition-colors"
			>
				<Share2 className="size-4 mr-2" />
				Partager
			</Button>
			<Button
				variant="outline"
				size="sm"
				onClick={handleTweet}
				className="hover:bg-[#1DA1F2]/10 hover:text-[#1DA1F2] transition-colors"
			>
				<TwitterIcon className="size-4 mr-2" />
				Tweeter
			</Button>
		</div>
	);
}
