module.exports = (config) => {
	config.set({
		browsers: ["ChromeHeadlessNoSandbox"],
		customLaunchers: {
			ChromeHeadlessNoSandbox: {
				base: "ChromeHeadless",
				flags: ["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage"],
			},
		},
		frameworks: ["jasmine"],
		plugins: [
			require("karma-jasmine"),
			require("karma-chrome-launcher"),
			require("karma-coverage"),
			require("karma-jasmine-html-reporter"),
			// Karma relies on parameter comments for this provider. Bun does not
			// preserve them, so register the already-parsed value explicitly.
			{ proxies: ["value", config.proxies] },
		],
		reporters: ["progress", "kjhtml"],
		singleRun: true,
	});
};
