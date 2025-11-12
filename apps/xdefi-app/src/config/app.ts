type AppConfigType = {
	name: string;
	github: {
		title: string;
		url: string;
	};
	author: {
		name: string;
		url: string;
	};
};

export const appConfig: AppConfigType = {
	name: "xdefi.app",
	github: {
		title: "Nuwa AI",
		url: "https://github.com/nuwa-protocol/x402-exec",
	},
	author: {
		name: "Nuwa AI",
		url: "https://github.com/nuwa-protocol/x402-exec",
	},
};

export const baseUrl = "https://xdefi.app";
