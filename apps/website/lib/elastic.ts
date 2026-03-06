import { NextResponse, NextRequest } from 'next/server';

import axios from 'axios';
import { FeedStatsType, PageStatsType, ShareStatsType } from '@/types/Stats';

export async function postESGeneric(stats: FeedStatsType | PageStatsType | ShareStatsType, es_index: string): Promise<void> {

    const url = `https://elk.newsramp.com:9200/${es_index}/_doc`;
    const auth = process.env.ES_AUTH || ""; 
  
    try {
      const response = await axios.post(url, stats, {
        headers: {
            'Authorization': `Basic ${btoa(auth)}`,
            'Content-Type': 'application/json',
        },
      });
    } catch (error) {
      console.error('Error posting data to Elasticsearch:', error);
    }
  }
  
