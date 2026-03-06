import Image from "next/image";

export default function GetTheBook() {
	return (
		<Image
			src="/get-the-book-qrcode.svg"
			width={175}
			height={1}
			className="w-[175px] h-[175px]"
			alt="Scan QRcode to Get David's Marketing Book"
		/>
	);
}
