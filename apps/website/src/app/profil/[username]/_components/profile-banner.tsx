import { StorageImage } from "@rose-griffon/ui";

export function ProfileBanner({ src }: { src: string | null }) {
	return (
		<div
			className="relative h-44 w-full overflow-hidden bg-linear-to-r from-[#a14b3f] via-[#c47867] to-[#d16854] sm:h-56 md:h-64"
			aria-hidden="true"
		>
			{src ? (
				<StorageImage src={src} alt="" fill className="object-cover" />
			) : (
				<div
					className="absolute inset-0 opacity-20"
					style={{ backgroundImage: "url(/patterns/grid.svg)" }}
				/>
			)}
			<div className="absolute inset-0 bg-linear-to-t from-background/80 to-transparent" />
		</div>
	);
}
