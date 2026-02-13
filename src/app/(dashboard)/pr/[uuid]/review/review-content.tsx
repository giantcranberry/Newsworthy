"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Check,
  X,
  AlertCircle,
  FileText,
  Image as ImageIcon,
  Share2,
  Sparkles,
  Loader2,
  Lightbulb,
  ChevronLeft,
  AlertTriangle,
  Info,
  Calendar,
  MapPin,
  User,
  Quote,
  Tag,
  Globe,
  Video,
  RefreshCw,
  CheckCircle,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface Suggestion {
  headline: string;
  strategy: string;
  explanation: string;
}

interface BrandableChunk {
  chunkContent: string;
  brandability: string;
  currentIssue: string;
  recommendation: string;
}

interface CopyImprovement {
  originalText: string;
  improvedText: string;
  reason: string;
}

interface ReviewContentProps {
  releaseUuid: string;
  release: {
    title: string | null;
    abstract: string | null;
    body: string | null;
    pullquote: string | null;
    location: string | null;
    releaseAt: Date | null;
    videoUrl: string | null;
    landingPage: string | null;
  };
  company: {
    logoUrl: string | null;
    companyName: string | null;
  };
  contact: {
    name: string | null;
    email: string | null;
  };
  banner: {
    url: string;
  } | null;
  images: Array<{
    id: number;
    url: string;
    caption: string | null;
  }>;
  stats: {
    categoryCount: number;
    regionCount: number;
    listCount: number;
    shareWithList: boolean;
    distribution: string | null;
  };
}

interface ValidationItem {
  type: "error" | "warning" | "info";
  label: string;
  description: string;
  editPath?: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface ChecklistItem {
  label: string;
  completed: boolean;
  icon: React.ComponentType<{ className?: string }>;
  editPath?: string;
}

export function ReviewContent({
  releaseUuid,
  release,
  company,
  contact,
  banner,
  images,
  stats,
}: ReviewContentProps) {
  const router = useRouter();

  // AI Analysis state (auto-loaded on page enter)
  const [isLoadingAI, setIsLoadingAI] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [hasLoadedAI, setHasLoadedAI] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<Suggestion[]>([]);
  const [aiBrandableChunks, setAiBrandableChunks] = useState<BrandableChunk[]>(
    [],
  );
  const [aiPullquote, setAiPullquote] = useState<string | null>(null);
  const [aiAbstract, setAiAbstract] = useState<string | null>(null);
  const [aiCopyImprovements, setAiCopyImprovements] = useState<
    CopyImprovement[]
  >([]);
  const [isCached, setIsCached] = useState(false);
  const [cachedAt, setCachedAt] = useState<string | null>(null);
  const [acceptedImprovements, setAcceptedImprovements] = useState<Set<number>>(
    new Set(),
  );
  const [applyingImprovement, setApplyingImprovement] = useState<number | null>(
    null,
  );
  const [confirmIndex, setConfirmIndex] = useState<number | null>(null);

  const loadAIAnalysis = async (forceRefresh = false) => {
    setIsLoadingAI(true);
    setAiError(null);

    try {
      // First try to get cached analysis (unless forcing refresh)
      if (!forceRefresh) {
        const cacheResponse = await fetch(
          `/api/pr/${releaseUuid}/ai-suggestions`,
        );
        const cacheData = await cacheResponse.json();

        if (cacheResponse.ok && cacheData.hasAnalysis) {
          setAiSuggestions(cacheData.suggestions || []);
          setAiBrandableChunks(cacheData.brandableChunks || []);
          setAiPullquote(cacheData.suggestedPullquote || null);
          setAiAbstract(cacheData.suggestedAbstract || null);
          setAiCopyImprovements(cacheData.copyImprovements || []);
          setIsCached(true);
          setCachedAt(cacheData.cachedAt);
          setIsLoadingAI(false);
          setHasLoadedAI(true);
          return;
        }
      }

      // Generate new analysis
      const response = await fetch(`/api/pr/${releaseUuid}/ai-suggestions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: release.title,
          abstract: release.abstract,
          body: release.body,
          pullquote: release.pullquote,
          forceRefresh,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to generate suggestions");
      }

      setAiSuggestions(data.suggestions || []);
      setAiBrandableChunks(data.brandableChunks || []);
      setAiPullquote(data.suggestedPullquote || null);
      setAiAbstract(data.suggestedAbstract || null);
      setAiCopyImprovements(data.copyImprovements || []);
      setIsCached(data.cached || false);
      setCachedAt(data.cachedAt || null);
    } catch (err) {
      setAiError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoadingAI(false);
      setHasLoadedAI(true);
    }
  };

  const handleAcceptImprovement = async (index: number) => {
    const improvement = aiCopyImprovements[index];
    if (!improvement || !release.body) return;

    setApplyingImprovement(index);
    setConfirmIndex(null);

    try {
      const response = await fetch(`/api/pr/${releaseUuid}/apply-edit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          originalText: improvement.originalText,
          improvedText: improvement.improvedText,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        alert(data.error || "Failed to apply change");
        return;
      }

      // Mark as accepted (server already updated the body)
      setAcceptedImprovements((prev) => new Set([...prev, index]));
    } catch {
      alert("Failed to apply change");
    } finally {
      setApplyingImprovement(null);
    }
  };

  // Auto-load all AI analysis on mount
  useEffect(() => {
    if (hasLoadedAI || !release.title || !release.body) return;
    loadAIAnalysis();
  }, [releaseUuid, release.title, release.body, hasLoadedAI]);

  // Calculate word count for body
  const bodyWordCount = useMemo(() => {
    if (!release.body) return 0;
    const plainText = release.body
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    return plainText.split(/\s+/).filter((word) => word.length > 0).length;
  }, [release.body]);

  // Calculate abstract length
  const abstractLength = release.abstract?.length || 0;

  // Validation items
  const validationItems = useMemo<ValidationItem[]>(() => {
    const items: ValidationItem[] = [];

    // Required field errors
    if (!release.title) {
      items.push({
        type: "error",
        label: "Missing headline",
        description: "Your press release needs a headline.",
        editPath: `/pr/${releaseUuid}`,
        icon: FileText,
      });
    }

    if (!release.body) {
      items.push({
        type: "error",
        label: "Missing body content",
        description: "Your press release needs body content.",
        editPath: `/pr/${releaseUuid}`,
        icon: FileText,
      });
    }

    if (!release.abstract) {
      items.push({
        type: "error",
        label: "Missing abstract/summary",
        description:
          "Add a brief summary to help readers quickly understand your news.",
        editPath: `/pr/${releaseUuid}`,
        icon: FileText,
      });
    }

    if (!contact.name || !contact.email) {
      items.push({
        type: "error",
        label: "Missing primary contact",
        description: "Select a contact person for media inquiries.",
        editPath: `/pr/${releaseUuid}`,
        icon: User,
      });
    }

    if (stats.categoryCount === 0) {
      items.push({
        type: "error",
        label: "No categories selected",
        description:
          "Select at least one category to help journalists find your news.",
        editPath: `/pr/${releaseUuid}`,
        icon: Tag,
      });
    }

    if (stats.regionCount === 0) {
      items.push({
        type: "error",
        label: "No regions selected",
        description: "Select at least one region for distribution targeting.",
        editPath: `/pr/${releaseUuid}`,
        icon: Globe,
      });
    }

    // Warnings (optional but recommended)
    if (!banner) {
      items.push({
        type: "warning",
        label: "No banner image",
        description:
          "A banner image increases social sharing engagement by up to 200%.",
        editPath: `/pr/${releaseUuid}/images`,
        icon: ImageIcon,
      });
    }

    if (images.length === 0) {
      items.push({
        type: "warning",
        label: "No additional images",
        description: "Press releases with images get 94% more views.",
        editPath: `/pr/${releaseUuid}/images`,
        icon: ImageIcon,
      });
    }

    if (!release.pullquote) {
      items.push({
        type: "warning",
        label: "No notable quote",
        description:
          "A compelling quote makes your release more quotable by journalists.",
        editPath: `/pr/${releaseUuid}`,
        icon: Quote,
      });
    }

    if (!release.location) {
      items.push({
        type: "warning",
        label: "No dateline location",
        description:
          "Adding a location provides geographical context for your news.",
        editPath: `/pr/${releaseUuid}`,
        icon: MapPin,
      });
    }

    if (!release.releaseAt) {
      items.push({
        type: "warning",
        label: "No release date scheduled",
        description:
          "Schedule a specific release date or your release will go out immediately upon approval.",
        editPath: `/pr/${releaseUuid}`,
        icon: Calendar,
      });
    }

    // Share list suggestion
    if (stats.listCount > 0 && !stats.shareWithList) {
      items.push({
        type: "warning",
        label: "Share list not enabled",
        description: `You have ${stats.listCount} subscribers in your list. Enable sharing to reach them.`,
        editPath: `/pr/${releaseUuid}/share`,
        icon: Share2,
      });
    } else if (stats.listCount === 0) {
      items.push({
        type: "info",
        label: "No share list contacts",
        description:
          "Consider building a subscriber list to amplify your press releases.",
        editPath: `/pr/${releaseUuid}/share`,
        icon: Share2,
      });
    }

    // Upgrade suggestion
    if (!stats.distribution) {
      items.push({
        type: "warning",
        label: "No upgrade selected",
        description:
          "Expand your reach with premium news distribution upgrades.",
        editPath: `/pr/${releaseUuid}/upgrades`,
        icon: Sparkles,
      });
    }

    // Quality suggestions (info)
    if (abstractLength > 0 && abstractLength < 100) {
      items.push({
        type: "info",
        label: "Short abstract",
        description:
          "Your abstract is quite short. Consider expanding it to 150-300 characters for better SEO.",
        editPath: `/pr/${releaseUuid}`,
        icon: FileText,
      });
    }

    if (bodyWordCount > 0 && bodyWordCount < 300) {
      items.push({
        type: "info",
        label: "Short body content",
        description: `Your press release is ${bodyWordCount} words. Most effective releases are 400-700 words.`,
        editPath: `/pr/${releaseUuid}`,
        icon: FileText,
      });
    }

    if (bodyWordCount > 1000) {
      items.push({
        type: "info",
        label: "Long body content",
        description: `Your press release is ${bodyWordCount} words. Consider condensing to under 800 words for better engagement.`,
        editPath: `/pr/${releaseUuid}`,
        icon: FileText,
      });
    }

    if (!release.videoUrl && !release.landingPage) {
      items.push({
        type: "info",
        label: "No multimedia links",
        description: "Adding a video URL or landing page can boost engagement.",
        editPath: `/pr/${releaseUuid}`,
        icon: Video,
      });
    }

    return items;
  }, [
    release,
    company,
    contact,
    banner,
    images,
    stats,
    releaseUuid,
    bodyWordCount,
    abstractLength,
  ]);

  // Checklist for completion status
  const checklist: ChecklistItem[] = [
    {
      label: "Press release details",
      completed: !!(release.title && release.abstract && release.body),
      icon: FileText,
      editPath: `/pr/${releaseUuid}`,
    },
    {
      label: "Primary contact",
      completed: !!(contact.name && contact.email),
      icon: User,
      editPath: `/pr/${releaseUuid}`,
    },
    {
      label: "Categories & regions",
      completed: stats.categoryCount > 0 && stats.regionCount > 0,
      icon: Tag,
      editPath: `/pr/${releaseUuid}`,
    },
    {
      label: "Banner image",
      completed: !!banner,
      icon: ImageIcon,
      editPath: `/pr/${releaseUuid}/images`,
    },
  ];

  const errors = validationItems.filter((item) => item.type === "error");
  const warnings = validationItems.filter((item) => item.type === "warning");
  const infos = validationItems.filter((item) => item.type === "info");

  const requiredComplete = errors.length === 0;

  const handleContinue = () => {
    router.push(`/pr/${releaseUuid}/finalize`);
  };

  return (
    <div className="space-y-6">
      {/* Completion Checklist */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Check className="h-5 w-5" />
            Completion Checklist
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {checklist.map((item, idx) => {
            const Icon = item.icon;
            return (
              <div
                key={idx}
                className={cn(
                  "flex items-center justify-between p-3 rounded-lg border",
                  item.completed
                    ? "bg-green-50 border-green-200"
                    : "bg-red-50 border-red-200",
                )}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      "p-1.5 rounded-full",
                      item.completed ? "bg-green-100" : "bg-red-100",
                    )}
                  >
                    <Icon
                      className={cn(
                        "h-4 w-4",
                        item.completed ? "text-green-600" : "text-red-600",
                      )}
                    />
                  </div>
                  <span
                    className={cn(
                      "font-medium",
                      item.completed ? "text-green-900" : "text-red-900",
                    )}
                  >
                    {item.label}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {item.completed ? (
                    <Check className="h-5 w-5 text-green-600" />
                  ) : (
                    <>
                      <X className="h-5 w-5 text-red-600" />
                      <button
                        onClick={() => router.push(item.editPath!)}
                        className="text-sm text-blue-600 hover:underline"
                      >
                        Complete
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Errors - Required fields */}
      {errors.length > 0 && (
        <Card className="border-red-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2 text-red-800">
              <AlertCircle className="h-5 w-5" />
              Required ({errors.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {errors.map((item, idx) => {
              const Icon = item.icon;
              return (
                <div
                  key={idx}
                  className="flex items-start justify-between p-3 bg-red-50 rounded-lg"
                >
                  <div className="flex items-start gap-3">
                    <Icon className="h-4 w-4 text-red-600 mt-0.5 shrink-0" />
                    <div>
                      <p className="font-medium text-red-900">{item.label}</p>
                      <p className="text-sm text-red-700">{item.description}</p>
                    </div>
                  </div>
                  {item.editPath && (
                    <button
                      onClick={() => router.push(item.editPath!)}
                      className="text-sm text-red-700 hover:text-red-900 hover:underline shrink-0 ml-2"
                    >
                      Fix
                    </button>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Warnings - Recommended */}
      {warnings.length > 0 && (
        <Card className="border-amber-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2 text-amber-800">
              <AlertTriangle className="h-5 w-5" />
              Recommended ({warnings.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {warnings.map((item, idx) => {
              const Icon = item.icon;
              return (
                <div
                  key={idx}
                  className="flex items-start justify-between p-3 bg-amber-50 rounded-lg"
                >
                  <div className="flex items-start gap-3">
                    <Icon className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                    <div>
                      <p className="font-medium text-amber-900">{item.label}</p>
                      <p className="text-sm text-amber-700">
                        {item.description}
                      </p>
                    </div>
                  </div>
                  {item.editPath && (
                    <button
                      onClick={() => router.push(item.editPath!)}
                      className="text-sm text-amber-700 hover:text-amber-900 hover:underline shrink-0 ml-2"
                    >
                      Add
                    </button>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Info - Suggestions */}
      {infos.length > 0 && (
        <Card className="border-blue-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2 text-blue-800">
              <Info className="h-5 w-5" />
              Suggestions ({infos.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {infos.map((item, idx) => {
              const Icon = item.icon;
              return (
                <div
                  key={idx}
                  className="flex items-start justify-between p-3 bg-blue-50 rounded-lg"
                >
                  <div className="flex items-start gap-3">
                    <Icon className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
                    <div>
                      <p className="font-medium text-blue-900">{item.label}</p>
                      <p className="text-sm text-blue-700">
                        {item.description}
                      </p>
                    </div>
                  </div>
                  {item.editPath && (
                    <button
                      onClick={() => router.push(item.editPath!)}
                      className="text-sm text-blue-700 hover:text-blue-900 hover:underline shrink-0 ml-2"
                    >
                      Edit
                    </button>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Summary Stats */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Release Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <p className="text-2xl font-bold text-gray-900">
                {bodyWordCount}
              </p>
              <p className="text-xs text-gray-500">Words</p>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <p className="text-2xl font-bold text-gray-900">
                {images.length}
              </p>
              <p className="text-xs text-gray-500">Images</p>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <p className="text-2xl font-bold text-gray-900">
                {stats.categoryCount}
              </p>
              <p className="text-xs text-gray-500">Categories</p>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <p className="text-2xl font-bold text-gray-900">
                {stats.regionCount}
              </p>
              <p className="text-xs text-gray-500">Regions</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* AI Analysis Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-blue-600" />
              Expert Optimization Analysis
              {isCached && cachedAt && (
                <span className="text-xs font-normal text-gray-500 ml-2">
                  (cached {new Date(cachedAt).toLocaleDateString()})
                </span>
              )}
            </CardTitle>
            {hasLoadedAI && !isLoadingAI && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => loadAIAnalysis(true)}
                disabled={isLoadingAI}
              >
                <RefreshCw className="h-4 w-4 mr-1" />
                Refresh
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {isLoadingAI && (
            <div className="flex flex-col items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600 mb-4" />
              <p className="text-gray-600">Analyzing your press release...</p>
              <p className="text-sm text-gray-400 mt-1">
                Generating SEO and content optimization suggestions
              </p>
            </div>
          )}

          {aiError && (
            <div className="flex items-center gap-2 p-4 bg-red-50 text-red-700 rounded-lg">
              <AlertCircle className="h-5 w-5 shrink-0" />
              <span>{aiError}</span>
            </div>
          )}

          {!isLoadingAI && !aiError && hasLoadedAI && (
            <>
              {/* Alternative Headlines */}
              {aiSuggestions.length > 0 && (
                <div className="space-y-3">
                  <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Alternative Headlines
                  </h3>
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-xs text-gray-500 mb-1">
                      Current Headline
                    </p>
                    <p className="font-medium text-gray-900">
                      {release.title || "Untitled"}
                    </p>
                  </div>
                  <div className="space-y-3">
                    {aiSuggestions.map((suggestion, index) => (
                      <div
                        key={index}
                        className="p-4 border border-gray-200 rounded-lg hover:border-blue-300 transition-colors"
                      >
                        <div className="flex items-start gap-3">
                          <div className="bg-blue-100 p-2 rounded-full shrink-0">
                            <Lightbulb className="h-4 w-4 text-blue-600" />
                          </div>
                          <div className="flex-1 space-y-2">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-medium px-2 py-0.5 bg-blue-100 text-blue-700 rounded">
                                {suggestion.strategy}
                              </span>
                            </div>
                            <p className="font-medium text-gray-900">
                              {suggestion.headline}
                            </p>
                            <p className="text-sm text-gray-600">
                              {suggestion.explanation}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Suggested Abstract */}
              {aiAbstract && !release.abstract && (
                <div className="space-y-3">
                  <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Suggested Abstract
                  </h3>
                  <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                    <p className="text-green-900">{aiAbstract}</p>
                    <p className="text-xs text-green-600 mt-2">
                      {aiAbstract.length}/350 characters - Add this summary to
                      your press release
                    </p>
                  </div>
                </div>
              )}

              {/* Suggested Pullquote */}
              {aiPullquote && !release.pullquote && (
                <div className="space-y-3">
                  <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                    <Quote className="h-4 w-4" />
                    Suggested Notable Quote
                  </h3>
                  <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
                    <p className="text-purple-900 italic">
                      &ldquo;{aiPullquote}&rdquo;
                    </p>
                    <p className="text-xs text-purple-600 mt-2">
                      Consider adding this quote to make your release more
                      quotable
                    </p>
                  </div>
                </div>
              )}

              {/* Copy Improvements */}
              {aiCopyImprovements.length > 0 && (
                <div className="space-y-3">
                  <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Copy Improvement Suggestions
                  </h3>
                  <p className="text-sm text-gray-600">
                    Specific text changes to strengthen your press release.
                  </p>
                  <div className="space-y-4">
                    {aiCopyImprovements.map((improvement, index) => {
                      const isAccepted = acceptedImprovements.has(index);
                      const isApplying = applyingImprovement === index;
                      return (
                        <div
                          key={index}
                          className={cn(
                            "p-4 border rounded-lg",
                            isAccepted
                              ? "border-green-300 bg-green-50/50"
                              : "border-gray-200",
                          )}
                        >
                          <div className="space-y-3">
                            <div>
                              <p className="text-xs font-medium text-red-600 uppercase tracking-wide mb-1">
                                Original
                              </p>
                              <p
                                className={cn(
                                  "text-sm text-gray-700 bg-red-50 p-2 rounded border-l-2 border-red-300",
                                  isAccepted && "line-through opacity-60",
                                )}
                              >
                                {improvement.originalText}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs font-medium text-green-600 uppercase tracking-wide mb-1">
                                Suggested
                              </p>
                              <p className="text-sm text-gray-700 bg-green-50 p-2 rounded border-l-2 border-green-300">
                                {improvement.improvedText}
                              </p>
                            </div>
                            <div className="flex items-center justify-between">
                              <p className="text-xs text-gray-500 italic">
                                {improvement.reason}
                              </p>
                              {isAccepted ? (
                                <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700">
                                  <CheckCircle className="h-3.5 w-3.5" />
                                  Applied
                                </span>
                              ) : (
                                <Dialog
                                  open={confirmIndex === index}
                                  onOpenChange={(open) =>
                                    setConfirmIndex(open ? index : null)
                                  }
                                >
                                  <DialogTrigger asChild>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      disabled={isApplying}
                                      className="shrink-0 ml-2"
                                    >
                                      {isApplying ? (
                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                      ) : (
                                        <Check className="h-3.5 w-3.5" />
                                      )}
                                      {isApplying ? "Applying..." : "Accept"}
                                    </Button>
                                  </DialogTrigger>
                                  <DialogContent>
                                    <DialogHeader>
                                      <DialogTitle>
                                        Accept Copy Change
                                      </DialogTitle>
                                      <DialogDescription>
                                        This will replace the original text in
                                        your press release with the suggested
                                        improvement.
                                      </DialogDescription>
                                    </DialogHeader>
                                    <div className="space-y-3 py-2">
                                      <div>
                                        <p className="text-xs font-medium text-red-600 mb-1">
                                          Will be replaced:
                                        </p>
                                        <p className="text-sm bg-red-50 p-2 rounded border-l-2 border-red-300">
                                          {improvement.originalText}
                                        </p>
                                      </div>
                                      <div>
                                        <p className="text-xs font-medium text-green-600 mb-1">
                                          With:
                                        </p>
                                        <p className="text-sm bg-green-50 p-2 rounded border-l-2 border-green-300">
                                          {improvement.improvedText}
                                        </p>
                                      </div>
                                    </div>
                                    <DialogFooter>
                                      <Button
                                        variant="outline"
                                        onClick={() => setConfirmIndex(null)}
                                      >
                                        Cancel
                                      </Button>
                                      <Button
                                        onClick={() =>
                                          handleAcceptImprovement(index)
                                        }
                                      >
                                        Accept & Apply
                                      </Button>
                                    </DialogFooter>
                                  </DialogContent>
                                </Dialog>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Brandable Chunks */}
              {aiBrandableChunks.length > 0 && (
                <div className="space-y-3">
                  <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                    <Tag className="h-4 w-4" />
                    RAG/AI Content Chunks Analysis
                  </h3>
                  <p className="text-sm text-gray-600">
                    Content segments that AI systems and search engines will
                    likely extract for indexing.
                  </p>
                  <div className="space-y-4">
                    {aiBrandableChunks.map((chunk, index) => (
                      <div
                        key={index}
                        className="p-4 border border-gray-200 rounded-lg"
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-sm font-medium">
                            Chunk {index + 1}
                          </span>
                          <span
                            className={cn(
                              "text-xs font-medium px-2 py-0.5 rounded",
                              chunk.brandability === "High"
                                ? "bg-green-100 text-green-700"
                                : chunk.brandability === "Medium"
                                  ? "bg-amber-100 text-amber-700"
                                  : "bg-red-100 text-red-700",
                            )}
                          >
                            {chunk.brandability} Brandability
                          </span>
                        </div>
                        <div className="bg-gray-50 p-3 rounded text-sm text-gray-700 mb-3 max-h-40 overflow-y-auto">
                          {chunk.chunkContent}
                        </div>
                        <div className="text-sm">
                          <p className="text-gray-600">
                            <span className="font-medium">Issue:</span>{" "}
                            {chunk.currentIssue}
                          </p>
                          <p className="text-blue-600 mt-1">
                            <span className="font-medium">Recommendation:</span>{" "}
                            {chunk.recommendation}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {hasLoadedAI &&
                aiSuggestions.length === 0 &&
                aiCopyImprovements.length === 0 &&
                aiBrandableChunks.length === 0 && (
                  <p className="text-center text-gray-500 py-4">
                    No optimization suggestions available.
                  </p>
                )}

              <p className="text-xs text-gray-500 text-center pt-2">
                These suggestions are AI-generated. Review and adapt them to fit
                your brand voice and messaging goals.
              </p>
            </>
          )}

          {!release.title || !release.body ? (
            <p className="text-center text-gray-500 py-4">
              Add a headline and body content to receive AI optimization
              suggestions.
            </p>
          ) : null}
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex items-center justify-between pt-6 border-t border-gray-100">
        <Button
          variant="outline"
          onClick={() => router.push(`/pr/${releaseUuid}/upgrades`)}
        >
          <ChevronLeft className="h-4 w-4" />
          Back
        </Button>

        <Button onClick={handleContinue} disabled={!requiredComplete}>
          Continue to Finalize
        </Button>
      </div>

      {/* Warning if not complete */}
      {!requiredComplete && (
        <div className="flex items-start gap-2 p-4 bg-red-50 border border-red-200 rounded-lg">
          <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-red-800">
            <strong>Cannot proceed.</strong> Please complete all required items
            above before finalizing your press release.
          </div>
        </div>
      )}
    </div>
  );
}
