import { createPublicClient } from "./lib/supabase/public";

async function test() {
	const supabase = createPublicClient();
	const res = await supabase.from("inagle_characters").select("id", { count: "exact", head: true });
	console.log("Result for inagle_characters count:", res);
}

test().catch(console.error);
