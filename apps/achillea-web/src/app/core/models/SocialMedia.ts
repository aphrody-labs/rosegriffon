export type SocialMediaDTO = {
	platform: SocialMedia;
	username: string;
	canonicalUrl: string;
};

export enum SocialMedia {
	X,
	Instagram,
	TikTok,
	Youtube,
	Twitch,
}
