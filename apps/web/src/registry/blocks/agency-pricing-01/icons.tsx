"use client";

import type { HTMLMotionProps, Variants } from "motion/react";
import { motion, useAnimation, useReducedMotion } from "motion/react";
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";

const EASE_IN_OUT: [number, number, number, number] = [0.77, 0, 0.175, 1];
const EASE_OUT: [number, number, number, number] = [0.23, 1, 0.32, 1];

export interface RocketHandle {
	startAnimation: () => void;
	stopAnimation: () => void;
}

interface RocketProps extends HTMLMotionProps<"div"> {
	size?: number;
	duration?: number;
	isAnimated?: boolean;
	intervalDuration?: number;
}

const RocketIcon = forwardRef<RocketHandle, RocketProps>(
	(
		{
			className,
			size = 24,
			duration = 1,
			isAnimated = true,
			intervalDuration = 3000,
			...props
		},
		ref,
	) => {
		const controls = useAnimation();
		const reduced = useReducedMotion();
		const isControlled = useRef(false);

		useImperativeHandle(ref, () => {
			isControlled.current = true;
			return {
				startAnimation: () =>
					reduced ? controls.start("normal") : controls.start("animate"),
				stopAnimation: () => controls.start("normal"),
			};
		});

		useEffect(() => {
			if (!isAnimated || reduced) return;

			if (!isControlled.current) {
				controls.start("animate");
			}

			const intervalId = setInterval(() => {
				if (!isControlled.current) {
					controls.start("animate");
				}
			}, intervalDuration);

			return () => clearInterval(intervalId);
		}, [controls, isAnimated, reduced, intervalDuration]);

		const rocketVariants: Variants = {
			normal: { transform: "translate(0px, 0px)" },
			animate: {
				transform: [
					"translate(0px, 0px)",
					"translate(3px, -3px)",
					"translate(0px, 0px)",
				],
				transition: {
					duration: 0.7 * duration,
					ease: EASE_IN_OUT,
				},
			},
		};

		const thrustVariants: Variants = {
			normal: { opacity: 1, transform: "scale(1)" },
			animate: {
				opacity: [1, 0.3, 1],
				transform: ["scale(1)", "scale(1.4)", "scale(1)"],
				transition: {
					duration: 0.4 * duration,
					ease: EASE_IN_OUT,
				},
			},
		};

		return (
			<motion.div
				className={`inline-flex items-center justify-center ${className ?? ""}`}
				{...props}
			>
				<motion.svg
					xmlns="http://www.w3.org/2000/svg"
					width={size}
					height={size}
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					strokeWidth="2"
					strokeLinecap="round"
					strokeLinejoin="round"
					aria-hidden="true"
					focusable="false"
				>
					<motion.path
						d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"
						variants={rocketVariants}
						initial="normal"
						animate={controls}
						style={{
							transformBox: "fill-box",
							transformOrigin: "center",
						}}
					/>
					<motion.path
						d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"
						variants={rocketVariants}
						initial="normal"
						animate={controls}
						style={{
							transformBox: "fill-box",
							transformOrigin: "center",
						}}
					/>
					<motion.path
						d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"
						variants={rocketVariants}
						initial="normal"
						animate={controls}
						style={{
							transformBox: "fill-box",
							transformOrigin: "center",
						}}
					/>
					<motion.path
						d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"
						variants={thrustVariants}
						initial="normal"
						animate={controls}
						style={{
							transformBox: "fill-box",
							transformOrigin: "center",
						}}
					/>
				</motion.svg>
			</motion.div>
		);
	},
);

RocketIcon.displayName = "RocketIcon";

export { RocketIcon };

export interface DashboardIconHandle {
	startAnimation: () => void;
	stopAnimation: () => void;
}

interface DashboardIconProps extends HTMLMotionProps<"div"> {
	size?: number;
	duration?: number;
	isAnimated?: boolean;
	intervalDuration?: number;
}

const DashboardIcon = forwardRef<DashboardIconHandle, DashboardIconProps>(
	(
		{
			className,
			size = 24,
			duration = 0.6,
			isAnimated = true,
			intervalDuration = 3000,
			...props
		},
		ref,
	) => {
		const controls = useAnimation();
		const reduced = useReducedMotion();
		const isControlled = useRef(false);

		useImperativeHandle(ref, () => {
			isControlled.current = true;
			return {
				startAnimation: () =>
					reduced ? controls.start("normal") : controls.start("animate"),
				stopAnimation: () => controls.start("normal"),
			};
		});

		useEffect(() => {
			if (!isAnimated || reduced) return;

			if (!isControlled.current) {
				controls.start("animate");
			}

			const intervalId = setInterval(() => {
				if (!isControlled.current) {
					controls.start("animate");
				}
			}, intervalDuration);

			return () => clearInterval(intervalId);
		}, [controls, isAnimated, reduced, intervalDuration]);

		const iconVariants: Variants = {
			normal: { transform: "scale(1) rotate(0deg)" },
			animate: {
				transform: [
					"scale(1) rotate(0deg)",
					"scale(1.06) rotate(-1.5deg)",
					"scale(0.98) rotate(1.5deg)",
					"scale(1) rotate(0deg)",
				],
				transition: { duration: 1.1 * duration, ease: EASE_IN_OUT },
			},
		};

		const tileVariants: Variants = {
			normal: { opacity: 1, transform: "translateY(0px) scale(1)" },
			animate: (i: number) => ({
				opacity: [0.6, 1],
				transform: [
					"translateY(3px) scale(0.95)",
					"translateY(-2px) scale(1.04)",
					"translateY(0px) scale(1)",
				],
				transition: {
					duration: 0.9 * duration,
					ease: EASE_IN_OUT,
					delay: i * 0.08,
				},
			}),
		};

		return (
			<motion.div
				className={`inline-flex items-center justify-center ${className ?? ""}`}
				{...props}
			>
				<motion.svg
					xmlns="http://www.w3.org/2000/svg"
					width={size}
					height={size}
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					strokeWidth="2"
					strokeLinecap="round"
					strokeLinejoin="round"
					aria-hidden="true"
					focusable="false"
					animate={controls}
					initial="normal"
					variants={iconVariants}
					style={{ transformOrigin: "center" }}
				>
					<motion.rect
						width="7"
						height="9"
						x="3"
						y="3"
						rx="1"
						variants={tileVariants}
						custom={0}
						initial="normal"
						animate={controls}
						style={{
							transformBox: "fill-box",
							transformOrigin: "center",
						}}
					/>
					<motion.rect
						width="7"
						height="5"
						x="14"
						y="3"
						rx="1"
						variants={tileVariants}
						custom={1}
						initial="normal"
						animate={controls}
						style={{
							transformBox: "fill-box",
							transformOrigin: "center",
						}}
					/>
					<motion.rect
						width="7"
						height="9"
						x="14"
						y="12"
						rx="1"
						variants={tileVariants}
						custom={2}
						initial="normal"
						animate={controls}
						style={{
							transformBox: "fill-box",
							transformOrigin: "center",
						}}
					/>
					<motion.rect
						width="7"
						height="5"
						x="3"
						y="16"
						rx="1"
						variants={tileVariants}
						custom={3}
						initial="normal"
						animate={controls}
						style={{
							transformBox: "fill-box",
							transformOrigin: "center",
						}}
					/>
				</motion.svg>
			</motion.div>
		);
	},
);

DashboardIcon.displayName = "DashboardIcon";

export { DashboardIcon };

export interface MousePointerClick01IconHandle {
	startAnimation: () => void;
	stopAnimation: () => void;
}

interface MousePointerClick01IconProps extends HTMLMotionProps<"div"> {
	size?: number;
	duration?: number;
	isAnimated?: boolean;
	intervalDuration?: number;
}

const MousePointerClick01Icon = forwardRef<
	MousePointerClick01IconHandle,
	MousePointerClick01IconProps
>(
	(
		{
			className,
			size = 24,
			duration = 1,
			isAnimated = true,
			intervalDuration = 3000,
			...props
		},
		ref,
	) => {
		const controls = useAnimation();
		const reduced = useReducedMotion();
		const isControlled = useRef(false);

		useImperativeHandle(ref, () => {
			isControlled.current = true;
			return {
				startAnimation: () =>
					reduced ? controls.start("normal") : controls.start("animate"),
				stopAnimation: () => controls.start("normal"),
			};
		});

		useEffect(() => {
			if (!isAnimated || reduced) return;

			if (!isControlled.current) {
				controls.start("animate");
			}

			const intervalId = setInterval(() => {
				if (!isControlled.current) {
					controls.start("animate");
				}
			}, intervalDuration);

			return () => clearInterval(intervalId);
		}, [controls, isAnimated, reduced, intervalDuration]);

		const pointerVariants: Variants = {
			normal: {
				transform: "translateY(0px) scale(1)",
			},
			animate: {
				transform: [
					"translateY(0px) scale(1)",
					"translateY(1px) scale(0.95)",
					"translateY(0px) scale(1)",
				],
				transition: {
					duration: 0.5 * duration,
					ease: EASE_IN_OUT,
				},
			},
		};

		const clickRayVariants: Variants = {
			normal: {
				opacity: 1,
				transform: "scale(1)",
			},
			animate: {
				opacity: [0, 1, 0, 1],
				transform: ["scale(0.6)", "scale(1.2)", "scale(1)"],
				transition: {
					duration: 0.6 * duration,
					ease: EASE_OUT,
				},
			},
		};

		return (
			<motion.div
				className={`inline-flex items-center justify-center ${className ?? ""}`}
				{...props}
			>
				<motion.svg
					xmlns="http://www.w3.org/2000/svg"
					width={size}
					height={size}
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					strokeWidth="2"
					strokeLinecap="round"
					strokeLinejoin="round"
					aria-hidden="true"
					focusable="false"
					initial="normal"
					animate={controls}
				>
					<motion.path
						d="M9 4V2"
						variants={clickRayVariants}
						style={{
							transformBox: "fill-box",
							transformOrigin: "center",
						}}
					/>
					<motion.path
						d="M5 5L3.5 3.5"
						variants={clickRayVariants}
						style={{
							transformBox: "fill-box",
							transformOrigin: "center",
						}}
					/>
					<motion.path
						d="M4 9H2"
						variants={clickRayVariants}
						style={{
							transformBox: "fill-box",
							transformOrigin: "center",
						}}
					/>
					<motion.path
						d="M5 13L3.5 14.5"
						variants={clickRayVariants}
						style={{
							transformBox: "fill-box",
							transformOrigin: "center",
						}}
					/>
					<motion.path
						d="M14.5 3.5L13 5"
						variants={clickRayVariants}
						style={{
							transformBox: "fill-box",
							transformOrigin: "center",
						}}
					/>

					<motion.path
						d="M12.669 8.35811L17.6969 10.3256C20.5969 11.4604 22.0469 12.0277 21.9988 12.9278C21.9508 13.8278 20.4375 14.2405 17.4111 15.0659C16.5099 15.3117 16.0593 15.4346 15.7469 15.7469C15.4346 16.0593 15.3117 16.5099 15.0659 17.4111C14.2405 20.4375 13.8278 21.9508 12.9278 21.9988C12.0277 22.0469 11.4604 20.5969 10.3256 17.6969L8.35811 12.669C7.17004 9.63279 6.57601 8.1147 7.34535 7.34535C8.1147 6.57601 9.63279 7.17004 12.669 8.35811Z"
						variants={pointerVariants}
						style={{
							transformBox: "fill-box",
							transformOrigin: "center",
						}}
					/>
				</motion.svg>
			</motion.div>
		);
	},
);

MousePointerClick01Icon.displayName = "MousePointerClick01Icon";

export { MousePointerClick01Icon };
