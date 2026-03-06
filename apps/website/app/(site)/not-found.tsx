import Image from "next/image";
import Link from "next/link";

function NotFoundPage() {
	return (
		<section className="mx-auto w-full xl:max-w-screen-xl">
			<div className="my-20 flex flex-col justify-center items-center max-w-none prose prose-p:text-2xl dark:prose-p:text-slate-100 prose-img:my-0">
				<Image
					src={"./nw-404.svg"}
					width={400}
					height={1}
					className="w-64lg:w-96"
					alt={"404, Page not found"}
				/>
				<p>Page not found</p>
				<Link
					href="/"
					className="bg-teal-700 hover:bg-teal-800 text-slate-100 rounded text-base py-2 px-5 no-underline">
					Go back home
				</Link>
			</div>
		</section>
	);
}

export default NotFoundPage;
