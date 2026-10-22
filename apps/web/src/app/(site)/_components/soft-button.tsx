import Link from "next/link";
import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { cn } from "@/lib/utils";

type SoftButtonVariant = "default" | "outline";
type SoftButtonSize = "default" | "sm";

type SoftButtonStyleProps = {
	variant?: SoftButtonVariant;
	size?: SoftButtonSize;
	className?: string;
	children?: ReactNode;
};

const sizeClassNames: Record<SoftButtonSize, string> = {
	default: cn(
		"rounded-xl px-6 py-4",
		"shadow-[0_12px_0_-2px_#60a5fa,0_12px_0_0_#1d4ed8,0_22px_0_0_#dbeafe]",
		"dark:shadow-[0_12px_0_-2px_#60a5fa,0_12px_0_0_#1d4ed8,0_22px_15px_-5px_rgba(0,0,0,0.3)]",
		"hover:translate-y-1 hover:shadow-[0_8px_0_-2px_#60a5fa,0_8px_0_0_#1d4ed8,0_16px_0_0_#dbeafe]",
		"dark:hover:shadow-[0_8px_0_-2px_#60a5fa,0_8px_0_0_#1d4ed8,0_16px_10px_-5px_rgba(0,0,0,0.3)]",
		"active:translate-y-3 active:shadow-[0_0px_0_-2px_#60a5fa,0_0px_0_0_#1d4ed8,0_0px_0_0_#dbeafe]",
		"dark:active:shadow-[0_0px_0_-2px_#60a5fa,0_0px_0_0_#1d4ed8,0_0px_0_0_rgba(0,0,0,0)]",
	),
	sm: cn(
		"rounded-lg px-3 py-2 text-xs",
		"shadow-[0_6px_0_-2px_#60a5fa,0_6px_0_0_#1d4ed8,0_11px_0_0_#dbeafe]",
		"dark:shadow-[0_6px_0_-2px_#60a5fa,0_6px_0_0_#1d4ed8,0_11px_8px_-3px_rgba(0,0,0,0.3)]",
		"hover:translate-y-0.5 hover:shadow-[0_4px_0_-2px_#60a5fa,0_4px_0_0_#1d4ed8,0_8px_0_0_#dbeafe]",
		"dark:hover:shadow-[0_4px_0_-2px_#60a5fa,0_4px_0_0_#1d4ed8,0_8px_6px_-3px_rgba(0,0,0,0.3)]",
		"active:translate-y-1.5 active:shadow-[0_0px_0_-2px_#60a5fa,0_0px_0_0_#1d4ed8,0_0px_0_0_#dbeafe]",
		"dark:active:shadow-[0_0px_0_-2px_#60a5fa,0_0px_0_0_#1d4ed8,0_0px_0_0_rgba(0,0,0,0)]",
	),
};

function softButtonClassName(
	variant: SoftButtonVariant,
	size: SoftButtonSize,
	className?: string,
) {
	return cn(
		"group relative inline-flex items-center justify-center gap-1.5 border-2 font-semibold uppercase transition-all duration-150 ease-[cubic-bezier(0,0,0.58,1)]",
		sizeClassNames[size],
		variant === "default"
			? "border-blue-700 bg-blue-500 text-white hover:bg-blue-600 active:bg-blue-600"
			: "border-blue-600 bg-background text-blue-600 dark:text-blue-400",
		className,
	);
}

type SoftButtonLinkProps = SoftButtonStyleProps &
	Omit<ComponentPropsWithoutRef<typeof Link>, "className" | "children">;

type SoftButtonAnchorProps = SoftButtonStyleProps &
	Omit<ComponentPropsWithoutRef<"a">, "className" | "children" | "href"> & {
		href: string;
	};

type SoftButtonElementProps = SoftButtonStyleProps &
	Omit<ComponentPropsWithoutRef<"button">, "className" | "children"> & {
		href?: never;
	};

export function SoftButton(props: SoftButtonLinkProps): ReactNode;
export function SoftButton(props: SoftButtonAnchorProps): ReactNode;
export function SoftButton(props: SoftButtonElementProps): ReactNode;
export function SoftButton({
	variant = "default",
	size = "default",
	className,
	...props
}: SoftButtonLinkProps | SoftButtonAnchorProps | SoftButtonElementProps) {
	const classes = softButtonClassName(variant, size, className);

	if ("href" in props && props.href != null) {
		if (
			typeof props.href === "string" &&
			/^(?:https?:|mailto:)/.test(props.href)
		) {
			return (
				<a className={classes} {...(props as ComponentPropsWithoutRef<"a">)} />
			);
		}

		return (
			<Link
				className={classes}
				{...(props as ComponentPropsWithoutRef<typeof Link>)}
			/>
		);
	}

	const { type = "button", ...buttonProps } = props;
	return <button type={type} className={classes} {...buttonProps} />;
}
