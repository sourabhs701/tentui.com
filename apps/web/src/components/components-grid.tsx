"use client";

import { MotionConfig } from "motion/react";
import { Fragment } from "react";

import { FEED_SPONSOR_POSITIONS } from "@/config/sponsor";

import { components } from "@/registry/components/_registry";

import { ComponentCard } from "./component-card";
import { SponsorCard } from "./sponsor-card";

// Sponsor cards take the grid positions in FEED_SPONSOR_POSITIONS and the
// components flow around them.
export function ComponentsGrid() {
	let position = 0;

	return (
		<MotionConfig reducedMotion="user">
			<div className="mb-10 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
				{components.map((component) => {
					const sponsors: number[] = [];
					while (FEED_SPONSOR_POSITIONS.includes(position)) {
						sponsors.push(position);
						position++;
					}
					const index = position++;
					return (
						<Fragment key={component.name}>
							{sponsors.map((at) => (
								<SponsorCard
									key={at}
									slot={FEED_SPONSOR_POSITIONS.indexOf(at)}
									index={at}
								/>
							))}
							<ComponentCard component={component} index={index} />
						</Fragment>
					);
				})}
			</div>
		</MotionConfig>
	);
}
