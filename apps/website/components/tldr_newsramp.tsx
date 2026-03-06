"use client";

import Image from "next/image";
import React, { useState, useEffect } from "react";
import TldrSkeleton from "./tldr_skeleton";

interface TldrData {
    competitive: string;
    humanistic: string;
    methodical: string;
    spontaneous: string;
}

interface TldrResponse {
    tldr: TldrData[];
}

interface TldrComponentProps {
    url: string;
}

const TldrComponent: React.FC<TldrComponentProps> = ({ url }) => {
    const [isLoading, setIsLoading] = useState(true);
    const [tldrData, setTldrData] = useState<any | null>(null);

    useEffect(() => {
        const fetchTldr = async () => {
            setIsLoading(true);
            try {
                const response = await fetch(url);
                if (!response.ok) {
                    throw new Error("Network response was not ok");
                }
                const data = await response.json();
                setTldrData(data);
            } catch (error) {
                // Handle error
            } finally {
                setIsLoading(false);
            }
        };

        fetchTldr();
    }, [url]);

    if (isLoading) {
        return <TldrSkeleton />;
    }

    // if (!tldrData) {
    // 	return <div className="text-red-600">Error: Unable to fetch data</div>;
    // }

    if (!tldrData) return null;

    return (
        <section className="bg-yellow-700/5 rounded-lg px-5 py-5 prose max-w-none prose-h3:my-0 prose-a:text-sm prose-a:text-slate-700 prose-a:my-0 prose-img:my-0 marker:prose-ul:text-slate-900 prose-ul:list-inside">
            <div className="flex flex-col md:flex-row md:items-center gap-3 md:gap-5">
                <h3>Key Takeaways (TLDR)</h3>
                {tldrData.newsramp_url && (
                    <a
                        href={`https://newsramp.com/${tldrData.newsramp_url}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 no-underline"
                    >
                        TLDR provided by
                        <Image
                            src={`/tldr-provide-newsramp.svg`}
                            width={120}
                            height={1}
                            alt="TLDR Provided by NewsRamp"
                        />
                    </a>
                )}
            </div>
            <ul key="newsramp_tldrs">
                <li key="comptetive_tldr">{tldrData.tldr[0].competitive}</li>
                <li key="humanistic_tldr">{tldrData.tldr[0].humanistic}</li>
                <li key="methodical_tldr">{tldrData.tldr[0].methodical}</li>
                <li key="spontaneous_tldr">{tldrData.tldr[0].spontaneous}</li>
            </ul>
        </section>
    );
};

export default TldrComponent;
