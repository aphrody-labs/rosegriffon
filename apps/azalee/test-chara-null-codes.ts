import { createSupabaseServiceClient } from "@rose-griffon/db/service";

async function run() {
	const supabase = createSupabaseServiceClient();
	
	// Total characters
	const { count: totalCount } = await supabase
		.from("inagle_characters")
		.select("*", { count: "exact", head: true });

	// Characters with null internal_code
	const { count: nullCodeCount } = await supabase
		.from("inagle_characters")
		.select("*", { count: "exact", head: true })
		.is("internal_code", null);

	// Characters with null internal_code but having zukan_hash
	const { count: nullCodeWithHashCount } = await supabase
		.from("inagle_characters")
		.select("*", { count: "exact", head: true })
		.is("internal_code", null)
		.not("zukan_hash", "is", null);

	console.log("Stats on character codes:");
	console.log("- Total characters:", totalCount);
	console.log("- Characters with null internal_code:", nullCodeCount);
	console.log("- Characters with null internal_code but having zukan_hash:", nullCodeWithHashCount);

	// Retrieve a sample of characters with null internal_code but having zukan_hash
	const { data: sample } = await supabase
		.from("inagle_characters")
		.select("id, name_fr, chara_id, internal_code, zukan_hash")
		.is("internal_code", null)
		.not("zukan_hash", "is", null)
		.limit(10);
	
	console.log("Sample characters with null internal_code and existing zukan_hash:", sample);
}

run().catch(console.error);
