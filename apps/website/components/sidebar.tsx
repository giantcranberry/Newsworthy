"use client";

import Link from "next/link";
import Image from "next/image";
import { MobileDropdown } from "@/components/mobile-sidebar-dropdown";

export const Sidebar = () => {
	return (
		<div className="flex flex-col h-full bg-white">
			<div className="px-6 pt-6 pb-2">
				<Link href="/">
					<Image
						src="/logo.svg"
						className="w-40"
						width="0"
						height="0"
						sizes="75vw"
						alt="Newsworthy Logo"
					/>
				</Link>
			</div>
			<div className="flex-1 px-6 overflow-y-auto">
				<MobileDropdown />
			</div>
		</div>
	);
};
