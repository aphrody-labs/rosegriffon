import { importLibrary, setOptions } from "@googlemaps/js-api-loader";
import { useEffect, useState } from "react";

setOptions({
	key: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY as string,
	libraries: ["marker", "places"],
	v: "weekly",
});

export const useGoogleMaps = () => {
	const [isLoaded, setIsLoaded] = useState(false);
	const [error, setError] = useState<Error | null>(null);

	useEffect(() => {
		importLibrary("maps")
			.then(() => setIsLoaded(true))
			.catch((error: unknown) => setError(error as Error));
	}, []);

	return { error, isLoaded, importLibrary };
};
