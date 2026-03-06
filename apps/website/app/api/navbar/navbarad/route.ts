import { NextResponse } from 'next/server'
import { getSiteAdBySlug } from '@/sanity/sanity-utils';

export async function GET() {

  const res = await getSiteAdBySlug('exclusive-ai-features');
//   const data = JSON.stringify(res); 
  return NextResponse.json({ res })
}