"use client";

import { MotionConfig } from "motion/react";
import { components } from "@/registry/components/_registry";
import { ComponentCard } from "./component-card";

export default function ComponentsPage() {
	return (
		<MotionConfig reducedMotion="user">
			<div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
				{components.map((component, index) => (
					<ComponentCard
						key={component.name}
						component={component}
						index={index}
					/>
				))}
			</div>
		</MotionConfig>
	);
}
