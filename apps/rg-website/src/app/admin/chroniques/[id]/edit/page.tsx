import { notFound } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

import EditChronicleClient from "./EditChronicleClient";

interface PageProps {
	params: Promise<{ id: string }>;
}

export default async function EditChroniclePage({ params }: PageProps) {
	const { id } = await params;
	const supabase = await createClient();

	const { data: article } = await supabase
		.from("articles")
		.select("*")
		.eq("id", id)
		.eq("app", "website")
		.single();

	if (!article) {
		notFound();
	}

	return <EditChronicleClient article={article} />;
}
