"use client";

import Link from "next/link";
import Image from "next/image";
import { MobileDropdown } from "@/components/mobile-sidebar-dropdown";

export const Sidebar = () => {
	return (
		<div className="space-y-5 px-7 py-5  flex flex-col h-full bg-white shadow-4xl border-0">
			<div className="flex flex-col">
				<div>
					<Link href="/" className="lg:hidden">
						<Image
							src="/logo.svg"
							className="mr-5 w-48"
							width="0"
							height="0"
							sizes="75vw"
							alt="Newsworthy Logo"
						/>
					</Link>
					<MobileDropdown />
				</div>
			</div>
		</div>
	);
};
