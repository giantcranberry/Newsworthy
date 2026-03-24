"use client";

import { useEffect, useState } from "react";
import { Menu } from "lucide-react";

import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Sidebar } from "@/components/sidebar";
import Link from "next/link";
import Image from "next/image";

export const MobileSidebar = () => {
	const [isMounted, setIsMounted] = useState(false);

	useEffect(() => {
		setIsMounted(true);
	}, []);

	if (!isMounted) {
		return null;
	}

	return (
		<Sheet>
			<div className="flex items-center justify-between">
				<Link href="/" className="xl:hidden">
					<Image
						src="/logo.svg"
						className="w-48"
						width="0"
						height="0"
						sizes="100vw"
						alt="Newsworthy Logo"
					/>
				</Link>

				<SheetTrigger asChild title={"Navigation Menu"} aria-label="Site Navigation">
					<button
						className="xl:hidden inline-flex items-center justify-center rounded-full p-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900"
						title={"Navigation Menu"}
						aria-label="Site Navigation">
						<Menu size={24} />
					</button>
				</SheetTrigger>
			</div>
			<SheetContent side="left" className="p-0 overflow-y-auto border-r-0">
				<SheetTitle className="sr-only">Navigation Menu</SheetTitle>
				<Sidebar />
			</SheetContent>
		</Sheet>
	);
};
