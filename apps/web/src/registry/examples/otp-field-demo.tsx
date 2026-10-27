"use client";

import { useEffect, useId, useRef, useState } from "react";

import {
	OTPField,
	type OTPFieldStatus,
} from "@/registry/components/otp-field/otp-field";

/** The code this demo accepts. */
const CODE = "123456";
/** Ms the fake server takes to check a code. */
const VERIFY_MS = 900;

function OTPFieldDemo() {
	const titleId = useId();
	const hintId = useId();
	const [code, setCode] = useState("");
	const [status, setStatus] = useState<OTPFieldStatus>("idle");
	const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	useEffect(
		() => () => {
			if (timerRef.current) clearTimeout(timerRef.current);
		},
		[],
	);

	const verify = (value: string) => {
		setStatus("verifying");
		timerRef.current = setTimeout(() => {
			setStatus(value === CODE ? "success" : "error");
		}, VERIFY_MS);
	};

	const handleValueChange = (value: string) => {
		setCode(value);
		if (status === "error") setStatus("idle");
	};

	const resend = () => {
		if (timerRef.current) clearTimeout(timerRef.current);
		setCode("");
		setStatus("idle");
	};

	return (
		<div className="w-full max-w-sm rounded-2xl border bg-card p-5 text-card-foreground shadow-xs">
			<div className="mb-4">
				<p id={titleId} className="font-medium text-sm">
					Check your email
				</p>
				<p id={hintId} className="text-muted-foreground text-xs">
					Enter the 6-digit code sent to ada@example.com. Try 123456.
				</p>
			</div>
			<OTPField
				aria-labelledby={titleId}
				aria-describedby={hintId}
				name="code"
				groups={[3, 3]}
				value={code}
				onValueChange={handleValueChange}
				onComplete={verify}
				status={status}
			/>
			<p className="mt-4 text-muted-foreground text-xs">
				Didn't get a code?{" "}
				<button
					type="button"
					onClick={resend}
					className="cursor-pointer rounded-sm underline underline-offset-4 outline-none transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
				>
					Resend
				</button>
			</p>
		</div>
	);
}

export default OTPFieldDemo;
