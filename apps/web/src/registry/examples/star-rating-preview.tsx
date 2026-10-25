"use client";

import { StarRating } from "@/registry/components/star-rating/star-rating";

function StarRatingPreview() {
	return (
		<StarRating
			aria-label="Rating"
			name="rating"
			allowHalf
			size="lg"
			defaultValue={3.5}
		/>
	);
}

export default StarRatingPreview;
