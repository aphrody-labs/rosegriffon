"use client";

import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
	type ChartConfig,
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent,
} from "@/components/ui/chart";

export interface SignupPoint {
	date: string;
	count: number;
}

const config = {
	count: {
		label: "Inscriptions",
		color: "var(--chart-1)",
	},
} satisfies ChartConfig;

export function SignupsChart({ data }: { data: SignupPoint[] }) {
	const total = data.reduce((sum, d) => sum + d.count, 0);
	const peak = data.reduce(
		(max, d) => (d.count > max.count ? d : max),
		data[0] ?? { date: "", count: 0 },
	);

	return (
		<Card>
			<CardHeader className="flex flex-row items-center justify-between space-y-0">
				<div className="space-y-1">
					<CardTitle className="text-base">Inscriptions sur 30 jours</CardTitle>
					<p className="text-xs text-muted-foreground">
						{total} nouveaux comptes
						{peak.count > 0 &&
							` · pic le ${format(new Date(peak.date), "d MMM", { locale: fr })} (${peak.count})`}
					</p>
				</div>
			</CardHeader>
			<CardContent className="pl-2">
				<ChartContainer
					config={config}
					className="h-[160px] w-full sm:h-[220px]"
				>
					<AreaChart
						data={data}
						margin={{ top: 8, right: 12, bottom: 0, left: 12 }}
					>
						<defs>
							<linearGradient id="signupsGradient" x1="0" y1="0" x2="0" y2="1">
								<stop
									offset="5%"
									stopColor="var(--color-count)"
									stopOpacity={0.4}
								/>
								<stop
									offset="95%"
									stopColor="var(--color-count)"
									stopOpacity={0.05}
								/>
							</linearGradient>
						</defs>
						<CartesianGrid vertical={false} strokeDasharray="3 3" />
						<XAxis
							dataKey="date"
							tickLine={false}
							axisLine={false}
							tickMargin={8}
							tickFormatter={(value: string) =>
								format(new Date(value), "d MMM", { locale: fr })
							}
							minTickGap={32}
						/>
						<YAxis
							tickLine={false}
							axisLine={false}
							allowDecimals={false}
							width={28}
						/>
						<ChartTooltip
							cursor={false}
							content={
								<ChartTooltipContent
									labelFormatter={(_, payload) => {
										const raw = payload?.[0]?.payload?.date;
										return raw
											? format(new Date(raw), "EEEE d MMMM", { locale: fr })
											: "";
									}}
								/>
							}
						/>
						<Area
							type="monotone"
							dataKey="count"
							stroke="var(--color-count)"
							strokeWidth={2}
							fill="url(#signupsGradient)"
						/>
					</AreaChart>
				</ChartContainer>
			</CardContent>
		</Card>
	);
}
