"use client";

import { type ReactNode, useState } from "react";

import {
	WheelPicker,
	WheelPickerGroup,
} from "@/registry/components/wheel-picker/wheel-picker";

const hours = Array.from({ length: 12 }, (_, index) => ({
	value: String(index + 1),
	label: String(index + 1),
}));

const minutes = Array.from({ length: 60 }, (_, index) => {
	const label = String(index).padStart(2, "0");
	return { value: label, label };
});

const periods = [
	{ value: "AM", label: "AM" },
	{ value: "PM", label: "PM" },
];

const sizes = ["sm", "md", "lg"] as const;

const servings = Array.from({ length: 8 }, (_, index) => ({
	value: String(index + 1),
	label: String(index + 1),
}));

const slots = [
	{ value: "09", label: "9:00" },
	{ value: "10", label: "10:00", disabled: true },
	{ value: "11", label: "11:00" },
	{ value: "12", label: "12:00", disabled: true },
	{ value: "13", label: "13:00", disabled: true },
	{ value: "14", label: "14:00" },
	{ value: "15", label: "15:00" },
	{ value: "16", label: "16:00", disabled: true },
	{ value: "17", label: "17:00" },
];

function Section({ title, children }: { title: string; children: ReactNode }) {
	return (
		<section className="flex w-full flex-col items-center gap-4">
			<p className="font-medium text-muted-foreground text-xs">{title}</p>
			{children}
		</section>
	);
}

function WheelPickerDemo() {
	const [hour, setHour] = useState("9");
	const [minute, setMinute] = useState("41");
	const [period, setPeriod] = useState("AM");

	return (
		<div className="flex w-full max-w-md flex-col items-center gap-10 py-4">
			<Section title="Time picker">
				<WheelPickerGroup aria-label="Alarm time">
					<WheelPicker
						aria-label="Hour"
						options={hours}
						value={hour}
						onValueChange={setHour}
						loop
						classNames={{ option: "justify-end" }}
					/>
					<WheelPicker
						aria-label="Minute"
						options={minutes}
						value={minute}
						onValueChange={setMinute}
						loop
					/>
					<WheelPicker
						aria-label="AM or PM"
						options={periods}
						value={period}
						onValueChange={setPeriod}
					/>
				</WheelPickerGroup>
				<p className="text-muted-foreground text-sm tabular-nums">
					Alarm at{" "}
					<span className="font-medium text-foreground">
						{hour}:{minute} {period}
					</span>
				</p>
			</Section>

			<Section title="Sizes">
				<div className="flex flex-wrap items-center justify-center gap-6">
					{sizes.map((size) => (
						<WheelPicker
							key={size}
							aria-label={`Servings, ${size}`}
							options={servings}
							defaultValue="2"
							size={size}
							visibleCount={3}
						/>
					))}
				</div>
			</Section>

			<Section title="Disabled options">
				<WheelPicker
					aria-label="Delivery slot"
					options={slots}
					defaultValue="11"
					className="w-32"
				/>
			</Section>
		</div>
	);
}

export default WheelPickerDemo;
