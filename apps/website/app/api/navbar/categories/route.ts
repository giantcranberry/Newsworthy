import { NextResponse } from "next/server";
import TopCategoriesWithNews from "@/lib/prisma/category";

export async function GET() {
    const res = await TopCategoriesWithNews();

    const data = JSON.stringify(res);

    return NextResponse.json({ data });
}
