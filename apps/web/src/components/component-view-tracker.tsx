"use client";

import { useEffect } from "react";

import { trackEvent } from "@/lib/events";

type ComponentViewTrackerProps = {
	slug: string;
	title: string;
};

export function ComponentViewTracker({
	slug,
	title,
}: ComponentViewTrackerProps) {
	useEffect(() => {
		trackEvent({
			name: "component_view",
			properties: {
				component_slug: slug,
				component_title: title,
				component_path: `/components/${slug}`,
			},
		});
	}, [slug, title]);

	return null;
}
