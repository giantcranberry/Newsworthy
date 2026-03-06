export interface ElasticNwRelease {
    _index: string;
    _id: string;
    _score: number | null;
    _source: {
        pr_id: number;
        created_at: string;
        release_at: string;
        headline: string;
        abstract: string;
        location: string;
        partner: string;
        body: string;
        pr_uuid: string;
        dateline: string;
        edscore: number;
        user_id: number;
        company_id: number;
        company_uuid: string;
        url: string;
        news_image: string;
        og_image: string;
        regions: number[];
        categories: number[];
        circuits: string[];
        placements: string[];
        qrcode: string;
        updated_at: string;
    };
    sort: number[];
}
