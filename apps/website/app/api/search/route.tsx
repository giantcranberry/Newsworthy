import { NextResponse, NextRequest } from "next/server";

import axios from "axios";

interface QueryTemplate {
  size: number;
  from: number;
  query: {
    bool: {
      must: object[];
      should: object[];
    };
  };
  sort: {
    [key: string]: string;
  };
}

export async function GET(request: NextRequest) {
  const searchTerm: string =
    request.nextUrl.searchParams.get("search_term") || "";
  const searchFrom: number =
    parseInt(request.nextUrl.searchParams.get("search_from") as string, 0) || 0;
  const osIndex: string = request.nextUrl.searchParams.get("os_index") || "";

  function literalEval(str: string): number | string {
    if (!isNaN(Number(str))) {
      return Number(str);
    } else {
      // Handle string literals
      return str.replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1");
    }
  }

  function getQueryTerms(text: string): [any[], string] {
    const _matches: any[] = [];
    let matches = text.match(/"(?:(?!(?<!\\)").)*"/g) || [];
    for (const match of matches) {
      _matches.push(literalEval(match));
      text = text.replace(match, "");
    }

    matches = text.match(/'(?:(?!(?<!\\)\').)*'/g) || [];
    for (const match of matches) {
      _matches.push(literalEval(match));
      text = text.replace(match, "");
    }

    return [_matches, text.trim()];
  }

  const [qphrases, qterms] = getQueryTerms(searchTerm);

  const qtemplate: QueryTemplate = {
    size: 15,
    from: searchFrom,
    query: {
      bool: {
        must: [],
        should: [],
      },
    },
    sort: {
      created_at: "desc",
    },
  };

  const search_must: { bool: { must: object[] } } = {
    bool: {
      must: [],
    },
  };

  const search_should: { bool: { should: object[] } } = {
    bool: {
      should: [],
    },
  };

  if (qterms) {
    const must_terms: object = {
      match: {
        body: {
          query: qterms,
          operator: "and",
        },
      },
    };

    const should_terms: object = {
      match: {
        content: {
          query: qterms,
          operator: "and",
        },
      },
    };

    search_must.bool.must.push(must_terms);
    search_should.bool.should.push(should_terms);
  }

  for (const qphrase of qphrases) {
    const phrase: object = {
      match_phrase: {
        content: qphrase,
      },
    };
    search_must.bool.must.push(phrase);
    search_should.bool.should.push(phrase);
  }

  const query: QueryTemplate = { ...qtemplate };
  query.query.bool.must.push(search_must);

  try {
    const url = `https://elk.newsramp.com:9200/${osIndex}/_search`;
    const auth = process.env.ES_AUTH || ""; // Replace with your actual password

    const response = await axios.get(url, {
      headers: {
        "Content-Type": "application/json; compatible-with=8",
        Authorization: `Basic ${btoa(auth)}`,
      },
      data: query, // Send the query as the request body
    });

    const responseData = response.data;

    if (responseData && responseData.hits && responseData.hits.hits) {
      const hits = responseData.hits.hits;

      return NextResponse.json(hits);
    } else {
      console.error("Response data structure is unexpected:", responseData);
      return NextResponse.error();
    }
  } catch (error) {
    console.error("Error fetching data:", error);
    return NextResponse.error();
  }
}
