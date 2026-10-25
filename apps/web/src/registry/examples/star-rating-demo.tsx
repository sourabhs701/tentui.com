"use client";

import { StarRating } from "@/registry/components/star-rating/star-rating";

const labels = ["Poor", "Fair", "Good", "Great", "Excellent"];

function StarRatingDemo() {
	return (
		<div className="w-full max-w-sm rounded-2xl border bg-card p-5 text-card-foreground shadow-xs">
			<div className="mb-3">
				<p className="font-medium text-sm">Rate your stay</p>
				<p className="text-muted-foreground text-xs">
					Harbour Inn, 3 nights in October
				</p>
			</div>
			<StarRating
				aria-label="Rate your stay"
				name="rating"
				allowHalf
				labels={labels}
				className="-ms-1"
			/>
			<div className="mt-4 flex items-center justify-between gap-4 border-t pt-4">
				<div className="min-w-0">
					<p className="font-medium text-sm">Guests say</p>
					<p className="text-muted-foreground text-xs">From 1,284 reviews</p>
				</div>
				<StarRating value={4.5} readOnly size="sm" />
			</div>
		</div>
	);
}

export default StarRatingDemo;
