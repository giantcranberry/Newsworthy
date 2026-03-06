"use client";

import { useState, useEffect } from "react";
import { ExternalLink } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface Placement {
  url: string;
  logo: string;
  handle: string;
  placement: string;
}

interface MetaJson {
  placements?: Placement[];
}

interface MetaData {
  meta_json?: string;
  placements?: Placement[];
}

interface MediaPlacementsProps {
  prhashId: string;
}

const ALLOWED_HANDLES = [
  "burstable-es",
  "burstable-fr",
  "burstable-pt",
  "burstable-de",
  "newscrafters",
];

export default function MediaPlacements({ prhashId }: MediaPlacementsProps) {
  const [placements, setPlacements] = useState<Placement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    if (!prhashId) {
      setIsLoading(false);
      return;
    }

    const fetchMetaData = async () => {
      try {
        const response = await fetch(
          `https://cdn.newsramp.net/meta/${prhashId}`
        );
        if (!response.ok) {
          setHasError(true);
          setIsLoading(false);
          return;
        }
        const data: MetaData = await response.json();

        // Placements can be at top level or inside meta_json string
        let placementsArray: Placement[] = [];

        if (data.placements && Array.isArray(data.placements)) {
          placementsArray = data.placements;
        } else if (data.meta_json) {
          try {
            const parsed: MetaJson = JSON.parse(data.meta_json);
            if (parsed.placements && Array.isArray(parsed.placements)) {
              placementsArray = parsed.placements;
            }
          } catch (e) {
            // Failed to parse meta_json
          }
        }

        if (placementsArray.length > 0) {
          const filteredPlacements = placementsArray.filter((p) =>
            ALLOWED_HANDLES.includes(p.handle)
          );
          setPlacements(filteredPlacements);
        }
      } catch (error) {
        setHasError(true);
      } finally {
        setIsLoading(false);
      }
    };

    fetchMetaData();
  }, [prhashId]);

  if (isLoading) {
    return (
      <div className="w-full">
        <Skeleton className="h-20 w-full rounded-lg" />
      </div>
    );
  }

  if (hasError || placements.length === 0) {
    return null;
  }

  return (
    <div className="w-full pt-4">
      <div className="bg-slate-50 border border-gray-200 rounded-lg p-4">
      <h3 className="text-sm font-medium text-gray-500 mb-3">
        Also Featured On
      </h3>
      <div className="flex flex-col gap-2">
        {placements.map((placement) => (
          <a
            key={placement.handle}
            href={placement.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between w-full px-3 py-2 bg-white border border-gray-200 rounded-lg hover:border-gray-300 transition-colors"
            title={`View on ${placement.placement || placement.handle}`}
          >
            <img
              src={placement.logo}
              alt={placement.handle}
              className="h-7 w-auto max-w-[160px] object-contain"
              loading="lazy"
            />
            <ExternalLink className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
          </a>
        ))}
      </div>
      </div>
    </div>
  );
}
