import { createDb } from "@tentui.com/db";
import { componentFeedback } from "@tentui.com/db/schema/feedback";
import { env } from "@tentui.com/env/server";
import { TRPCError } from "@trpc/server";
import { and, count, eq } from "drizzle-orm";
import { z } from "zod";
import { protectedProcedure, publicProcedure, router } from "../index";

const slugSchema = z
	.string()
	.trim()
	.min(1)
	.max(80)
	.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

async function getFeedbackCounts(slug: string) {
	const rows = await createDb()
		.select({ count: count(), rating: componentFeedback.rating })
		.from(componentFeedback)
		.where(eq(componentFeedback.componentSlug, slug))
		.groupBy(componentFeedback.rating);

	return {
		up: Number(rows.find((row) => row.rating === "up")?.count ?? 0),
		down: Number(rows.find((row) => row.rating === "down")?.count ?? 0),
	};
}

async function enforceFeedbackRateLimit(ipAddress: string) {
	const { success } = await env.FEEDBACK_RATE_LIMITER.limit({ key: ipAddress });
	if (!success) {
		throw new TRPCError({
			code: "TOO_MANY_REQUESTS",
			message: "Too many feedback attempts. Please try again in a minute.",
		});
	}
}

const feedbackRouter = router({
	counts: publicProcedure
		.input(z.object({ slug: slugSchema }))
		.query(({ input }) => getFeedbackCounts(input.slug)),
	submit: publicProcedure
		.input(
			z.object({
				feedback: z.string().trim().max(1000).optional(),
				rating: z.enum(["up", "down"]),
				slug: slugSchema,
				visitorId: z.uuid(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			await enforceFeedbackRateLimit(ctx.ipAddress);

			await createDb()
				.insert(componentFeedback)
				.values({
					componentSlug: input.slug,
					visitorId: input.visitorId,
					rating: input.rating,
					feedback: input.feedback || null,
				})
				.onConflictDoUpdate({
					target: [
						componentFeedback.componentSlug,
						componentFeedback.visitorId,
					],
					set: {
						rating: input.rating,
						feedback: input.feedback || null,
						updatedAt: new Date(),
					},
				});

			return getFeedbackCounts(input.slug);
		}),
	undo: publicProcedure
		.input(z.object({ slug: slugSchema, visitorId: z.uuid() }))
		.mutation(async ({ ctx, input }) => {
			await enforceFeedbackRateLimit(ctx.ipAddress);
			await createDb()
				.delete(componentFeedback)
				.where(
					and(
						eq(componentFeedback.componentSlug, input.slug),
						eq(componentFeedback.visitorId, input.visitorId),
					),
				);
			return getFeedbackCounts(input.slug);
		}),
});

export const appRouter = router({
	feedback: feedbackRouter,
	healthCheck: publicProcedure.query(() => {
		return "OK";
	}),
	privateData: protectedProcedure.query(({ ctx }) => {
		return {
			message: "This is private",
			user: ctx.session.user,
		};
	}),
});
export type AppRouter = typeof appRouter;
