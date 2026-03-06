import { NextResponse } from 'next/server'
import { getNavBarSectionBySlug } from '@/sanity/sanity-utils';

export async function GET() {

  const res = await getNavBarSectionBySlug('about-dropdown');
  return NextResponse.json({ res });
}