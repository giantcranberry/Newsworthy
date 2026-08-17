"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import Script from "next/script";
import * as gtag from "@/gtag.js";

const GoogleAnalytics = () => {
    const pathname = usePathname();

    useEffect(() => {
        if (!gtag.GA_TRACKING_ID || typeof window.gtag !== "function") return;
        gtag.pageview(pathname);
    }, [pathname]);

    return (
        <>
            <Script
                strategy="afterInteractive"
                src={`https://www.googletagmanager.com/gtag/js?id=${gtag.GA_TRACKING_ID}`}
            />
            <Script
                id="gtag-init"
                strategy="afterInteractive"
                dangerouslySetInnerHTML={{
                    __html: `
                        window.dataLayer = window.dataLayer || [];
                        function gtag(){dataLayer.push(arguments);}
                        gtag('js', new Date());
                        gtag('config', '${gtag.GA_TRACKING_ID}', {
                        page_path: window.location.pathname,
                        });
                        gtag('config', 'AW-18056538801');
                        `,
                }}
            />
        </>
    );
};

export default GoogleAnalytics;
