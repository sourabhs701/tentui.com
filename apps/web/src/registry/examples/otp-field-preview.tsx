"use client";

import { OTPField } from "@/registry/components/otp-field/otp-field";

function OTPFieldPreview() {
	return (
		<OTPField
			aria-label="Verification code"
			groups={[3, 3]}
			size="lg"
			defaultValue="381"
		/>
	);
}

export default OTPFieldPreview;
