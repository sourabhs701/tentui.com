"use client";
import Link from "next/link";

import { ThemeToggle } from "./theme-toggle";
import UserMenu from "./user-menu";

export default function Header() {
	const links = [
		{ to: "/", label: "Home" },
		{ to: "/blocks", label: "Blocks" },
		{ to: "/dashboard", label: "Dashboard" },
		{ to: "/components", label: "Components" },
	] as const;

	return (
		<div>
			<div className="flex flex-row items-center justify-between px-2 py-1">
				<nav className="flex gap-2 text-sm sm:gap-4 sm:text-lg">
					{links.map(({ to, label }) => {
						return (
							<Link key={to} href={to}>
								{label}
							</Link>
						);
					})}
				</nav>
				<div className="flex items-center gap-2">
					<ThemeToggle />
					<UserMenu />
				</div>
			</div>
			<hr />
		</div>
	);
}
