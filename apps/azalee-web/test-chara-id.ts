import { createSupabaseServiceClient } from "@rose-griffon/db/service";

async function run() {
	const supabase = createSupabaseServiceClient();
	const { data, error } = await supabase
		.from("inagle_characters")
		.select("id, name_fr, zukan_hash")
		.limit(20);

	if (error) {
		console.error("Error:", error);
	} else {
		console.log("Characters zukan_hash sample:", data);
	}
}

run().catch(console.error);
