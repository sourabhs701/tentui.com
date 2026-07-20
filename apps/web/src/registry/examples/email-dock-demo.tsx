"use client";

import { EmailDock } from "@/registry/components/email-dock/email-dock";

const DEMO_EMAIL = "sourabh@srb.gg";

export function EmailDockDemo() {
	return (
		<div className="flex w-full justify-center px-4">
			<EmailDock
				email={DEMO_EMAIL}
				className="w-full"
				highlights={[
					{ segment: "local" },
					{ segment: "domain", href: "https://srb.gg", external: true },
					{ segment: "full", href: `mailto:${DEMO_EMAIL}` },
				]}
			/>
		</div>
	);
}

export default EmailDockDemo;
