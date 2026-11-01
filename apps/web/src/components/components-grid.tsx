"use client";

import { MotionConfig } from "motion/react";
import { Fragment } from "react";

import { FEED_SPONSOR_INDEX } from "@/config/sponsor";

import { components } from "@/registry/components/_registry";

import { ComponentCard } from "./component-card";
import { SponsorCard } from "./sponsor-card";

export function ComponentsGrid() {
	return (
		<MotionConfig reducedMotion="user">
			<div className="mb-10 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
				{components.map((component, index) => (
					<Fragment key={component.name}>
						{index === FEED_SPONSOR_INDEX && <SponsorCard index={index} />}
						<ComponentCard
							component={component}
							index={index < FEED_SPONSOR_INDEX ? index : index + 1}
						/>
					</Fragment>
				))}
			</div>
		</MotionConfig>
	);
}
