"use client";

import { useState, useEffect, useRef } from "react";
import { Play, Link2, ExternalLink } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface VideoData {
  youtube?: string;
  portrait_video_url?: string;
}

interface PortraitVideoPlayerProps {
  prhashId: string;
}

export default function PortraitVideoPlayer({ prhashId }: PortraitVideoPlayerProps) {
  const [videoData, setVideoData] = useState<VideoData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [copied, setCopied] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!prhashId) {
      setIsLoading(false);
      return;
    }

    const fetchVideoData = async () => {
      try {
        const response = await fetch(
          `https://feeds.newsramp.net/video/single/${prhashId}.json`
        );
        if (!response.ok) {
          setHasError(true);
          setIsLoading(false);
          return;
        }
        const data = await response.json();
        setVideoData(data);
      } catch (error) {
        setHasError(true);
      } finally {
        setIsLoading(false);
      }
    };

    fetchVideoData();
  }, [prhashId]);

  const handlePlayClick = () => {
    setIsPlaying(true);
    if (videoRef.current) {
      videoRef.current.play();
    }
  };

  // Don't render anything if loading with no video or error
  if (isLoading) {
    return (
      <div className="w-full max-w-[280px] mx-auto">
        <Skeleton className="w-full aspect-[9/16] rounded-lg" />
      </div>
    );
  }

  // Helper to check for non-empty string
  const hasYoutube = videoData?.youtube && videoData.youtube.trim().length > 0;
  const hasPortraitVideo = videoData?.portrait_video_url && videoData.portrait_video_url.trim().length > 0;

  // Don't render if there's no video data or neither youtube nor portrait video
  if (hasError || !videoData || (!hasYoutube && !hasPortraitVideo)) {
    return null;
  }

  // Render YouTube embed if available
  if (hasYoutube) {
    // Extract video ID from YouTube URL
    const youtubeId = extractYoutubeId(videoData.youtube!);
    if (!youtubeId) return null;

    const youtubeUrl = `https://www.youtube.com/shorts/${youtubeId}`;

    const handleCopyLink = async () => {
      try {
        await navigator.clipboard.writeText(youtubeUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        console.error("Failed to copy:", err);
      }
    };

    const shareToX = () => {
      const text = encodeURIComponent("Check out this video!");
      const url = encodeURIComponent(youtubeUrl);
      window.open(`https://twitter.com/intent/tweet?text=${text}&url=${url}`, "_blank", "noopener,noreferrer");
    };

    const shareToLinkedIn = () => {
      const url = encodeURIComponent(youtubeUrl);
      window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${url}`, "_blank", "noopener,noreferrer");
    };

    return (
      <div className="w-full max-w-[340px] mx-auto my-4">
        <div
          className="relative w-full rounded-lg overflow-hidden bg-black"
          style={{ aspectRatio: '9/16' }}
        >
          <iframe
            src={`https://www.youtube.com/embed/${youtubeId}`}
            title="Video"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="absolute inset-0 w-full h-full border-0"
            loading="lazy"
          />
        </div>
        {/* Share buttons */}
        <div className="flex items-center justify-center gap-2 mt-2 mb-4 py-2">
          <button
            onClick={handleCopyLink}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-full transition-colors"
            title="Copy link"
          >
            <Link2 className="w-3.5 h-3.5" />
            {copied ? "Copied!" : "Copy"}
          </button>
          <button
            onClick={shareToX}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-full transition-colors"
            title="Share on X"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
            </svg>
            Share
          </button>
          <button
            onClick={shareToLinkedIn}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-full transition-colors"
            title="Share on LinkedIn"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
            </svg>
          </button>
          <a
            href={youtubeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-full transition-colors"
            title="Watch on YouTube"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            YouTube
          </a>
        </div>
      </div>
    );
  }

  // Render portrait video with play button overlay
  if (hasPortraitVideo) {
    const videoUrl = videoData.portrait_video_url!;

    const handleCopyLink = async () => {
      try {
        await navigator.clipboard.writeText(videoUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        console.error("Failed to copy:", err);
      }
    };

    const shareToX = () => {
      const text = encodeURIComponent("Check out this video!");
      const url = encodeURIComponent(videoUrl);
      window.open(`https://twitter.com/intent/tweet?text=${text}&url=${url}`, "_blank", "noopener,noreferrer");
    };

    const shareToLinkedIn = () => {
      const url = encodeURIComponent(videoUrl);
      window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${url}`, "_blank", "noopener,noreferrer");
    };

    return (
      <div className="w-full max-w-[340px] mx-auto my-4">
        <div
          className="relative rounded-lg overflow-hidden bg-slate-900"
          style={{ aspectRatio: '9/16' }}
        >
          <video
            ref={videoRef}
            src={videoUrl}
            className="absolute inset-0 w-full h-full object-cover"
            controls={isPlaying}
            playsInline
            preload="metadata"
          />
          {!isPlaying && (
            <button
              onClick={handlePlayClick}
              className="absolute inset-0 flex items-center justify-center bg-black/30 hover:bg-black/40 transition-colors cursor-pointer"
              aria-label="Play video"
            >
              <Play className="w-16 h-16 text-white opacity-30 hover:scale-110 transition-transform" fill="currentColor" />
            </button>
          )}
        </div>
        {/* Share buttons */}
        <div className="flex items-center justify-center gap-2 mt-2 mb-4 py-2">
          <button
            onClick={handleCopyLink}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-full transition-colors"
            title="Copy link"
          >
            <Link2 className="w-3.5 h-3.5" />
            {copied ? "Copied!" : "Copy"}
          </button>
          <button
            onClick={shareToX}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-full transition-colors"
            title="Share on X"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
            </svg>
            Share
          </button>
          <button
            onClick={shareToLinkedIn}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-full transition-colors"
            title="Share on LinkedIn"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
            </svg>
          </button>
        </div>
      </div>
    );
  }

  return null;
}

function extractYoutubeId(url: string): string | null {
  // Handle various YouTube URL formats
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }

  return null;
}
