"use client";

import { useEffect, useState } from "react";
import { Menu } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
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
			<div className="flex justify-between">
				<Link href="/" className="lg:hidden">
					<Image
						src="/logo.svg"
						className="mr-5 w-48"
						width="0"
						height="0"
						sizes="100vw"
						alt="Newsworthy Logo"
					/>
				</Link>

				<SheetTrigger asChild title={"Navigation Menu"} aria-label="Site Navigation">
					<Button
						variant="ghost"
						size="icon"
						className="lg:hidden"
						title={"Navigation Menu"}
						aria-label="Site Navigation">
						<Menu />
					</Button>
				</SheetTrigger>
			</div>
			<SheetContent side="left" className="p-0 overflow-y-scroll">
				<Sidebar />
			</SheetContent>
		</Sheet>
	);
};
