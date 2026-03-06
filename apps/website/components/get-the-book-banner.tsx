import Image from "next/image";
import Link from "next/link";

export default function GetTheBookBanner() {
	return (
		<div className="bg-teal-800/80 text-white text-center py-2">
			<p>
				Get your free copy of the News Marketing Book
				{""}
				<Link
					href={"https://newsmarketingbook.com"}
					className="font-bold underline ml-1">
					here
				</Link>
			</p>
		</div>
	);
}
