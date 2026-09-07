const STATE_PATTERN = /^(?<discordId>\d{17,20}):(?<token>[a-f\d]{48})$/u;

export interface ProviderOAuthState {
	discordId: string;
	token: string;
}

export const parseProviderOAuthState = (value: unknown): ProviderOAuthState | null => {
	if (typeof value !== "string") {
		return null;
	}

	const match = STATE_PATTERN.exec(value);
	if (!match?.groups) {
		return null;
	}

	return {
		discordId: match.groups.discordId,
		token: match.groups.token,
	};
};
