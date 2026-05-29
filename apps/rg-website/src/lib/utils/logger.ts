/**
 * Utilitaires de logging pour le développement
 * Évite les warnings ESLint tout en gardant les logs utiles
 */

const isDev = process.env.NODE_ENV === "development";

export const logger = {
	/**
	 * Debug détaillé (seulement en dev avec flag debug)
	 */
	debug: (message: string, ...args: unknown[]) => {
		if (isDev && process.env.NEXT_PUBLIC_DEBUG === "true") {
			console.info(`🐛 ${message}`, ...args);
		}
	},

	/**
	 * Erreur (toujours affichée)
	 */
	error: (message: string, ...args: unknown[]) => {
		console.error(`❌ ${message}`, ...args);
	},

	/**
	 * Log informatif (seulement en dev)
	 */
	info: (message: string, ...args: unknown[]) => {
		if (isDev) {
			console.info(`ℹ️  ${message}`, ...args);
		}
	},

	/**
	 * Log de succès (seulement en dev)
	 */
	success: (message: string, ...args: unknown[]) => {
		if (isDev) {
			console.info(`✅ ${message}`, ...args);
		}
	},

	/**
	 * Warning (toujours affiché)
	 */
	warn: (message: string, ...args: unknown[]) => {
		console.warn(`⚠️  ${message}`, ...args);
	},
};

/**
 * Logger spécifique pour les hooks Realtime
 */
export const realtimeLogger = {
	connected: (channelName: string) => {
		logger.success(`[Realtime] Connecté au canal: ${channelName}`);
	},

	disconnected: (channelName: string, reason?: string) => {
		logger.warn(`[Realtime] Déconnecté du canal: ${channelName}`, reason);
	},

	error: (channelName: string, error: unknown) => {
		logger.error(`[Realtime] Erreur sur le canal: ${channelName}`, error);
	},

	event: (channelName: string, eventType: string, payload?: unknown) => {
		logger.debug(`[Realtime] Événement sur ${channelName}: ${eventType}`, payload);
	},

	reconnecting: (channelName: string, attempt: number) => {
		logger.info(`[Realtime] Reconnexion au canal: ${channelName} (tentative ${attempt})`);
	},
};
