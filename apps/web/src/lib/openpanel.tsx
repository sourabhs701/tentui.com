import { OpenPanel } from "@openpanel/web";

export const op = new OpenPanel({
	apiUrl: "https://op.srb.codes/api",
	clientId: process.env.NEXT_PUBLIC_OPENPANEL_CLIENT_ID!,
	trackScreenViews: true,
});
