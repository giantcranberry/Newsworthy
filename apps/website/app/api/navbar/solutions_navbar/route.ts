import { NextResponse } from 'next/server'
import { getNavBarSectionBySlug } from '@/sanity/sanity-utils';

export async function GET() {

  const res = await getNavBarSectionBySlug('solutions-dropdown');
//   const data = JSON.stringify(res); 
  return NextResponse.json({ res })
}