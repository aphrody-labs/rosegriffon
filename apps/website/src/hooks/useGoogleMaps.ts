import { Loader } from "@googlemaps/js-api-loader";
import { useEffect, useState } from "react";

const loader = new Loader({
	apiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY as string,
	libraries: ["marker", "places"],
	version: "weekly",
});

export const useGoogleMaps = () => {
	const [isLoaded, setIsLoaded] = useState(false);
	const [error, setError] = useState<Error | null>(null);

	useEffect(() => {
		loader
			.importLibrary("maps")
			.then(() => setIsLoaded(true))
			.catch((error) => setError(error));
	}, []);

	return { error, isLoaded, loader };
};
