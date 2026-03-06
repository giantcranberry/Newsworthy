import { Skeleton } from "./ui/skeleton";

export default function TldrSkeleton() {
	return (
		<section className="bg-yellow-700/5 rounded-lg px-5 py-5">
			<div className="flex flex-col md:flex-row md:items-center gap-3 md:gap-5">
				<Skeleton className="h-6 w-2/3 bg-yellow-900/5" />
			</div>
			<ul>
				<Skeleton className="bg-yellow-900/5 h-4 flex-grow mt-3" />
				<Skeleton className="bg-yellow-900/5 h-4 flex-grow mt-3" />
				<Skeleton className="bg-yellow-900/5 h-4 flex-grow mt-3" />
				<Skeleton className="bg-yellow-900/5 h-4 flex-grow mt-3" />
			</ul>
		</section>
	);
}
