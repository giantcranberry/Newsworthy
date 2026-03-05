"use client";

import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import dynamic from "next/dynamic";

const Editor = dynamic(
  () => import("@tinymce/tinymce-react").then((mod) => mod.Editor),
  { ssr: false, loading: () => <div className="h-[800px] bg-gray-50 dark:bg-gray-950 rounded border border-gray-200 dark:border-gray-800 animate-pulse" /> },
);
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { MultiSelect } from "@/components/ui/multi-select";
import { HelpTip } from "@/components/ui/help-tip";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Loader2,
  Save,
  Send,
  Plus,
  X,
  Sparkles,
  Lightbulb,
  AlertCircle,
  Upload,
  FileText,
  Link,
  Monitor,
  Tablet,
  Smartphone,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { PreviewPanel } from "@/components/pr-wizard/preview-panel";
import { ResizeHandle } from "@/components/ui/resize-handle";

const PREVIEW_MIN_WIDTH = 300;
const PREVIEW_MAX_WIDTH = 900;
const PREVIEW_DEFAULT_WIDTH = 500;

function widthToDevice(width: number): 'desktop' | 'tablet' | 'mobile' {
  if (width <= 430) return 'mobile';
  if (width <= 768) return 'tablet';
  return 'desktop';
}

const DEVICE_SNAP_WIDTHS: Record<string, number> = {
  desktop: PREVIEW_MAX_WIDTH,
  tablet: 768,
  mobile: 375,
};

interface Suggestion {
  headline: string;
  strategy: string;
  explanation: string;
}

interface BrandableChunk {
  chunkContent: string;
  brandability: "High" | "Medium" | "Low";
  currentIssue: string;
  recommendation: string;
}

const HELP_TEXT = {
  headline: `Your Headline is the most read part of your press release. Be creative but not deceptive. Your headline must have between 30 and 120 Alphanumeric Characters. Use "Title Case" (AVOID ALL CAPS).`,

  abstract: `The second most read portion of your press release. Your abstract gets syndicated and appears alongside your headline in news readers and news apps.`,

  pullquote: `Also known as a pull quote. A pull quote is a key phrase, quotation, or excerpt that draws readers into your news release — and makes your news release more visually appealing. A pull quote is typically pulled from your news release copy and highlights the key message from your news. One sentence is sufficient.`,

  releaseDate: `Press releases should rarely be scheduled last-minute. Allow yourself time to make any edits and optimize your release prior to distribution. We recommend that you submit your release the day prior to its release.

For PayGO press release customers (Non Subscribers), release dates should be at least 24-hours in advance of your desired distribution time. PayGo customers may pay an extra fee for expedited same-day distribution.`,

  location: `The city and state/province where the news is being reported (Example: Vancouver, BC, Canada). This is typically the city and state of your primary corporate offices. A country is optionally acceptable.`,

  body: `• Minimum length is 200 words.
• While no upper limit exists, the recommended length is about 500 words.
• Hyperlinks should be embedded hyperlinks and fully functional at the time of submission (no 'page not found').
• Limit your hyperlinks to 1% of your release copy, or one link per 100 words.
• If your news release contains ticker symbols, C-Suite executive appointments or M&A and Partnership news, Newsworthy.ai will require authorization from a company executive before your news release can be approved for distribution. Approval requests must be sent to a qualified individual at the corporate email domain for each mentioned company.`,

  regions: `Select up to 5 MSA/Regions (depending on your membership level).`,

  categories: `Select up to 5 relevant categories (depending on membership level). Cross posting to irrelevant topics is discouraged and monitored by our editorial staff.`,

  contact: `Name, email, phone of the individual readers should contact if they have an interest in your news. Email addresses within the body of the news release may be altered to avoid unwanted spam.`,

  videoUrl: `Embedded videos must be provided from a hosting service such as Youtube, Vimeo, etc.`,

  landingPage: `The landing page url should not be your company's top level domain (company.com). Instead, insert a link that directs readers to more information regarding the main topic of the release. Think of the Landing Page url as the 'tip of your funnel'. Examples: If you are launching a book, direct readers to a page where they can learn more about the book and purchase. If the release is a new company hire, direct users to a bio of the new hire. UTM tracking links are recommended.

Power tip, you can include anchor text by adding your text in brackets before the url like this [my anchor text] https://yoururl.com`,

  driveUrl: `The use of a public "drive" url is the perfect way to share files that are relevant to your news. Think about media swipe files, hi-res headshots, powerpoint files, etc. By including a drive URL you have more control of what exists in the shared drive space than by attaching those assets directly to your press release.

Public Dropbox, Google Drive, Box.com, and other such services can be included in your news release to direct readers to additional information pertaining to your news.`,
};

const TIMEZONES = [
  { value: "America/New_York", label: "Eastern Time (ET)" },
  { value: "America/Chicago", label: "Central Time (CT)" },
  { value: "America/Denver", label: "Mountain Time (MT)" },
  { value: "America/Los_Angeles", label: "Pacific Time (PT)" },
  { value: "America/Anchorage", label: "Alaska Time (AKT)" },
  { value: "Pacific/Honolulu", label: "Hawaii Time (HT)" },
  { value: "UTC", label: "UTC" },
];

interface Company {
  id: number;
  uuid: string;
  companyName: string;
  logoUrl?: string | null;
  timezone?: string | null;
  contacts: Array<{
    id: number;
    name: string;
    email: string | null;
    phone: string | null;
  }>;
}

interface Category {
  id: number;
  slug: string;
  name: string;
  parentSlug: string | null;
  parentCategory: string | null;
}

interface Region {
  id: number;
  slug: string;
  name: string;
  state: string;
}

interface PRFormProps {
  companies: Company[];
  categories?: Category[];
  topCategories?: Category[];
  regions?: Region[];
  readOnly?: boolean;
  pageTitle?: string;
  pageDescription?: string;
  children?: React.ReactNode;
  creditsByCompany?: Record<number, number>;
  userCredits?: number;
  showPreview?: boolean;
  initialData?: {
    id?: number;
    uuid?: string;
    title?: string;
    abstract?: string;
    body?: string;
    pullquote?: string;
    companyId?: number;
    primaryContactId?: number | null;
    status?: string;
    location?: string;
    releaseAt?: Date | null;
    timezone?: string | null;
    videoUrl?: string | null;
    landingPage?: string | null;
    publicDrive?: string | null;
    selectedCategories?: number[];
    selectedRegions?: number[];
    topcat?: number | null;
  };
}

// Get minimum release date (12 hours from now)
function getMinReleaseDate() {
  const minDate = new Date(Date.now() + 12 * 60 * 60 * 1000);
  return minDate.toISOString().slice(0, 10);
}

function getMinReleaseDateTime() {
  return new Date(Date.now() + 12 * 60 * 60 * 1000);
}

export function PRForm({
  companies: initialCompanies,
  categories = [],
  topCategories = [],
  regions = [],
  readOnly = false,
  pageTitle = "Press Release",
  pageDescription,
  children,
  creditsByCompany = {},
  userCredits = 0,
  showPreview = false,
  initialData,
}: PRFormProps) {
  const router = useRouter();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const editorRef = useRef<any>(null);
  const [previewWidth, setPreviewWidth] = useState(PREVIEW_DEFAULT_WIDTH);
  const previewDevice = useMemo(() => widthToDevice(previewWidth), [previewWidth]);

  const handlePreviewResize = useCallback((delta: number) => {
    setPreviewWidth(prev => Math.min(PREVIEW_MAX_WIDTH, Math.max(PREVIEW_MIN_WIDTH, prev + delta)));
  }, []);

  const handleDeviceClick = useCallback((mode: 'desktop' | 'tablet' | 'mobile') => {
    setPreviewWidth(Math.min(PREVIEW_MAX_WIDTH, Math.max(PREVIEW_MIN_WIDTH, DEVICE_SNAP_WIDTHS[mode])));
  }, []);
  const [isLoading, setIsLoading] = useState(false);
  const [dateError, setDateError] = useState<string | null>(null);
  const [companies, setCompanies] = useState(initialCompanies);
  const [selectedCompanyId, setSelectedCompanyId] = useState<number>(() => {
    if (initialData?.companyId) return initialData.companyId;
    // Auto-select first company with credits
    if (Object.keys(creditsByCompany).length > 0) {
      const withCredits = initialCompanies.find((c) => (creditsByCompany[c.id] || 0) > 0);
      if (withCredits) return withCredits.id;
    }
    return initialCompanies[0]?.id || 0;
  });
  const [showContactModal, setShowContactModal] = useState(false);
  const [contactForm, setContactForm] = useState({
    name: "",
    title: "",
    email: "",
    phone: "",
  });
  const [contactError, setContactError] = useState("");
  const [savingContact, setSavingContact] = useState(false);

  // Expert Suggestions state
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [brandableChunks, setBrandableChunks] = useState<BrandableChunk[]>([]);
  const [suggestedPullquote, setSuggestedPullquote] = useState<string | null>(
    null,
  );
  const [suggestedAbstract, setSuggestedAbstract] = useState<string | null>(
    null,
  );
  const [suggestionsError, setSuggestionsError] = useState<string | null>(null);

  // Document Import state
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [googleDocsUrl, setGoogleDocsUrl] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // AI Draft state
  const [showAIDraftDialog, setShowAIDraftDialog] = useState(false);
  const [aiDraftInput, setAiDraftInput] = useState("");
  const [aiDraftSourceUrl, setAiDraftSourceUrl] = useState("");
  const [isGeneratingDraft, setIsGeneratingDraft] = useState(false);
  const [isFetchingUrl, setIsFetchingUrl] = useState(false);
  const MIN_DRAFT_INPUT_LENGTH = 100;

  const handleExpertSuggestions = async () => {
    if (!formData.title || !formData.body) {
      toast.error(
        "Please enter a headline and body content before getting suggestions",
      );
      return;
    }

    setShowSuggestions(true);
    setIsLoadingSuggestions(true);
    setSuggestionsError(null);
    setSuggestions([]);
    setBrandableChunks([]);
    setSuggestedPullquote(null);
    setSuggestedAbstract(null);

    // Get current body content from editor
    const currentBody = editorRef.current?.getContent() || formData.body;

    try {
      const response = await fetch(
        `/api/pr/${initialData?.uuid || "new"}/ai-suggestions`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: formData.title,
            abstract: formData.abstract,
            body: currentBody,
            pullquote: formData.pullquote,
          }),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to generate suggestions");
      }

      setSuggestions(data.suggestions);
      setBrandableChunks(data.brandableChunks || []);
      setSuggestedPullquote(data.suggestedPullquote || null);
      setSuggestedAbstract(data.suggestedAbstract || null);
    } catch (err) {
      setSuggestionsError(
        err instanceof Error ? err.message : "An error occurred",
      );
    } finally {
      setIsLoadingSuggestions(false);
    }
  };

  const handleImportFromFile = async (file: File) => {
    setIsImporting(true);
    setImportError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append(
        "categories",
        JSON.stringify(
          topCategories.map((c) => ({ id: c.id, name: c.name, slug: c.slug })),
        ),
      );
      formData.append(
        "regions",
        JSON.stringify(
          regions.map((r) => ({ id: r.id, name: r.name, state: r.state })),
        ),
      );

      const response = await fetch("/api/pr/import-document", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to import document");
      }

      // Apply imported data to form
      setFormData((prev) => ({
        ...prev,
        title: data.title || prev.title,
        abstract: data.abstract || prev.abstract,
        body: data.body || prev.body,
        pullquote: data.pullquote || prev.pullquote,
        location: data.location || prev.location,
        topcat: data.suggestedCategoryId?.toString() || prev.topcat,
        selectedRegions: data.suggestedRegionIds || prev.selectedRegions,
      }));

      // Update TinyMCE editor if it exists
      if (editorRef.current && data.body) {
        editorRef.current.setContent(data.body);
      }

      setShowImportDialog(false);
      setGoogleDocsUrl("");
      toast.success(
        "Document imported successfully! Review and adjust the content as needed.",
      );
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsImporting(false);
    }
  };

  const handleImportFromGoogleDocs = async () => {
    if (!googleDocsUrl.trim()) {
      setImportError("Please enter a Google Docs URL");
      return;
    }

    setIsImporting(true);
    setImportError(null);

    try {
      const response = await fetch("/api/pr/import-document", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: googleDocsUrl,
          categories: topCategories.map((c) => ({
            id: c.id,
            name: c.name,
            slug: c.slug,
          })),
          regions: regions.map((r) => ({
            id: r.id,
            name: r.name,
            state: r.state,
          })),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to import document");
      }

      // Apply imported data to form
      setFormData((prev) => ({
        ...prev,
        title: data.title || prev.title,
        abstract: data.abstract || prev.abstract,
        body: data.body || prev.body,
        pullquote: data.pullquote || prev.pullquote,
        location: data.location || prev.location,
        topcat: data.suggestedCategoryId?.toString() || prev.topcat,
        selectedRegions: data.suggestedRegionIds || prev.selectedRegions,
      }));

      // Update TinyMCE editor if it exists
      if (editorRef.current && data.body) {
        editorRef.current.setContent(data.body);
      }

      setShowImportDialog(false);
      setGoogleDocsUrl("");
      toast.success(
        "Document imported successfully! Review and adjust the content as needed.",
      );
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsImporting(false);
    }
  };

  const handleGenerateAIDraft = async () => {
    if (
      aiDraftInput.trim().length < MIN_DRAFT_INPUT_LENGTH &&
      !aiDraftSourceUrl.trim()
    ) {
      setImportError(
        `Please provide at least ${MIN_DRAFT_INPUT_LENGTH} characters of information about your news, or provide a source URL.`,
      );
      return;
    }

    setImportError(null);
    let sourceContent = "";

    // If URL provided, fetch it first
    if (aiDraftSourceUrl.trim()) {
      setIsFetchingUrl(true);
      try {
        const fetchResponse = await fetch("/api/pr/fetch-url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: aiDraftSourceUrl.trim() }),
        });

        const fetchData = await fetchResponse.json();

        if (!fetchResponse.ok) {
          throw new Error(fetchData.error || "Failed to fetch URL content");
        }

        sourceContent = fetchData.content;
      } catch (err) {
        setImportError(
          err instanceof Error ? err.message : "Failed to fetch URL content",
        );
        setIsFetchingUrl(false);
        return;
      }
      setIsFetchingUrl(false);
    }

    setIsGeneratingDraft(true);

    try {
      const response = await fetch("/api/pr/generate-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          input: aiDraftInput,
          sourceUrl: aiDraftSourceUrl.trim() || undefined,
          sourceContent: sourceContent || undefined,
          categories: topCategories.map((c) => ({
            id: c.id,
            name: c.name,
            slug: c.slug,
          })),
          regions: regions.map((r) => ({
            id: r.id,
            name: r.name,
            state: r.state,
          })),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to generate draft");
      }

      // Apply generated data to form
      setFormData((prev) => ({
        ...prev,
        title: data.title || prev.title,
        abstract: data.abstract || prev.abstract,
        body: data.body || prev.body,
        pullquote: data.pullquote || prev.pullquote,
        location: data.location || prev.location,
        topcat: data.suggestedCategoryId?.toString() || prev.topcat,
        selectedRegions: data.suggestedRegionIds || prev.selectedRegions,
      }));

      // Update TinyMCE editor if it exists
      if (editorRef.current && data.body) {
        editorRef.current.setContent(data.body);
      }

      setShowAIDraftDialog(false);
      setAiDraftInput("");
      setAiDraftSourceUrl("");
      toast.success(
        "Draft generated successfully! Review and adjust the content as needed.",
      );
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsGeneratingDraft(false);
    }
  };

  const selectedCompany = companies.find((c) => c.id === selectedCompanyId);

  const [formData, setFormData] = useState({
    title: initialData?.title || "",
    abstract: initialData?.abstract || "",
    body: initialData?.body || "",
    pullquote: initialData?.pullquote || "",
    location: initialData?.location || "",
    primaryContactId: initialData?.primaryContactId || (selectedCompany?.contacts.length === 1 ? selectedCompany.contacts[0].id : null),
    releaseDate: initialData?.releaseAt
      ? new Date(initialData.releaseAt).toISOString().slice(0, 10)
      : new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    releaseTime: initialData?.releaseAt
      ? new Date(initialData.releaseAt).toISOString().slice(11, 16)
      : "09:00",
    timezone:
      initialData?.timezone || selectedCompany?.timezone || "America/New_York",
    videoUrl: initialData?.videoUrl || "",
    landingPage: initialData?.landingPage || "",
    publicDrive: initialData?.publicDrive || "",
    topcat: initialData?.topcat?.toString() || "",
    selectedCategories: initialData?.selectedCategories || [],
    selectedRegions: initialData?.selectedRegions || [],
  });

  const handleCategoryChange = (categoryId: number) => {
    setFormData((prev) => {
      const selected = prev.selectedCategories.includes(categoryId)
        ? prev.selectedCategories.filter((id) => id !== categoryId)
        : [...prev.selectedCategories, categoryId];
      return { ...prev, selectedCategories: selected };
    });
  };

  const handleRegionChange = (regionId: number) => {
    setFormData((prev) => {
      const selected = prev.selectedRegions.includes(regionId)
        ? prev.selectedRegions.filter((id) => id !== regionId)
        : prev.selectedRegions.length < 5
          ? [...prev.selectedRegions, regionId]
          : prev.selectedRegions;
      return { ...prev, selectedRegions: selected };
    });
  };

  const handleCreateContact = async () => {
    if (!contactForm.name.trim()) {
      setContactError("Contact name is required");
      return;
    }

    setSavingContact(true);
    setContactError("");

    try {
      const response = await fetch(
        `/api/company/${selectedCompany?.uuid}/contacts`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(contactForm),
        },
      );

      if (response.ok) {
        const newContact = await response.json();
        // Update the companies state with the new contact
        setCompanies((prev) =>
          prev.map((c) =>
            c.id === selectedCompanyId
              ? { ...c, contacts: [...c.contacts, newContact] }
              : c,
          ),
        );
        // Select the new contact
        setFormData((prev) => ({ ...prev, primaryContactId: newContact.id }));
        // Reset and close modal
        setContactForm({ name: "", title: "", email: "", phone: "" });
        setShowContactModal(false);
      } else {
        const error = await response.json();
        setContactError(error.error || "Failed to create contact");
      }
    } catch (error) {
      setContactError("An error occurred");
    } finally {
      setSavingContact(false);
    }
  };

  const handleSubmit = async (action: "save" | "submit") => {
    const validationErrors: string[] = [];

    // Validate release date is at least 12 hours from now
    if (formData.releaseDate && formData.releaseTime) {
      const selectedDateTime = new Date(
        `${formData.releaseDate}T${formData.releaseTime}`,
      );
      const minDateTime = getMinReleaseDateTime();
      if (selectedDateTime < minDateTime) {
        validationErrors.push(
          "Release date must be at least 12 hours from now",
        );
        setDateError("Release date must be at least 12 hours from now");
      }
    }

    // Always save what we can, but show errors
    setIsLoading(true);

    try {
      const body = editorRef.current?.getContent() || formData.body;

      // Use valid date or null if invalid
      let releaseAt = null;
      if (formData.releaseDate && formData.releaseTime) {
        const selectedDateTime = new Date(
          `${formData.releaseDate}T${formData.releaseTime}`,
        );
        const minDateTime = getMinReleaseDateTime();
        if (selectedDateTime >= minDateTime) {
          releaseAt = `${formData.releaseDate}T${formData.releaseTime}`;
        }
      }

      const response = await fetch("/api/pr", {
        method: initialData?.uuid ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          body,
          releaseAt,
          companyId: selectedCompanyId,
          uuid: initialData?.uuid,
          action,
        }),
      });

      if (response.ok) {
        const data = await response.json();

        // Show validation errors if any, but data was saved
        if (validationErrors.length > 0) {
          toast.error("Please fix the following issues", {
            description: validationErrors.join(". "),
          });
          // Stay on page, don't navigate
          return;
        }

        toast.success("Release saved successfully");

        if (action === "submit") {
          // Continue to the next wizard step — skip logo if one already exists
          const nextStep = selectedCompany?.logoUrl ? `/pr/${data.uuid}/faq` : `/pr/${data.uuid}/logo`;
          router.push(nextStep);
        } else {
          // Save as draft - stay on edit page
          router.push(`/pr/${data.uuid}`);
        }
        router.refresh();
      } else {
        const error = await response.json();
        toast.error(error.message || "Failed to save release");
      }
    } catch (error) {
      console.error("Error saving release:", error);
      toast.error("An error occurred while saving");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={showPreview ? "flex gap-6" : ""}>
    <div className={showPreview ? "flex-1 min-w-0 -mt-6" : "-mt-6"}>
      {/* Sticky Action Bar */}
      <div data-tour="pr-create-action-bar" className="sticky top-0 z-10 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 -mx-6 px-6 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{pageTitle}</h1>
            {pageDescription && (
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">{pageDescription}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => router.back()}
              disabled={isLoading}
              className="cursor-pointer"
            >
              Cancel
            </Button>
            {initialData?.uuid && (
              <Button
                variant="outline"
                onClick={handleExpertSuggestions}
                disabled={isLoading}
                className="cursor-pointer"
              >
                <Sparkles className="h-4 w-4" />
                Expert Suggestions
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => handleSubmit("save")}
              disabled={isLoading || readOnly || !formData.primaryContactId}
              className="gap-2 cursor-pointer"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Save Draft
            </Button>
            <Button
              onClick={() => handleSubmit("submit")}
              disabled={
                isLoading ||
                readOnly ||
                !formData.primaryContactId ||
                !formData.title ||
                !formData.abstract ||
                !formData.location ||
                !!dateError
              }
              className="gap-2 bg-cyan-800 dark:bg-cyan-600 text-white dark:text-white hover:bg-cyan-900 dark:hover:bg-cyan-700 cursor-pointer"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              Save & Continue
            </Button>
          </div>
        </div>
      </div>

      <div className="space-y-8 mt-8">
      {children}

      {readOnly && (
        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-4 flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
          <p className="text-sm text-amber-800 dark:text-amber-400">
            This release cannot be edited because it has status{" "}
            <strong className="capitalize">{initialData?.status}</strong>.
          </p>
        </div>
      )}

      {/* Import/Generate options - only show for new releases or drafts */}
      {!readOnly && !initialData?.uuid && (
        <div data-tour="pr-create-import-generate" className="grid xl:grid-cols-2 gap-4">
          {/* Import from Document */}
          <Card className="border border-blue-200/60 dark:border-blue-800/60 bg-blue-50/30 dark:bg-blue-950/20">
            <CardContent className="py-4 space-y-3">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                <p className="font-medium text-gray-900 dark:text-gray-100">
                  Import from Document
                </p>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Upload a Word doc or Google Docs URL.
                <span className="block text-xs text-gray-500 dark:text-gray-500 mt-0.5">If you use this option AI will complete most of this form for you.</span>
              </p>
              <button
                type="button"
                onClick={() => setShowImportDialog(true)}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 cursor-pointer"
              >
                <Upload className="h-4 w-4" />
                Import
              </button>
            </CardContent>
          </Card>

          {/* Generate with AI */}
          <Card className="border border-purple-200/60 dark:border-purple-800/60 bg-purple-50/30 dark:bg-purple-950/20">
            <CardContent className="py-4 space-y-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                <p className="font-medium text-gray-900 dark:text-gray-100">Generate with AI</p>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Tell us about your news and we'll draft it and populate this form below.
                <span className="block text-xs text-gray-500 dark:text-gray-500 mt-0.5">You are responsible for editing the generated release and verifying all content.</span>
              </p>
              <button
                type="button"
                onClick={() => setShowAIDraftDialog(true)}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-md bg-purple-600 text-white hover:bg-purple-700 cursor-pointer"
              >
                <Sparkles className="h-4 w-4" />
                Generate
              </button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Hidden file input for Word doc upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".doc,.docx"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            handleImportFromFile(file);
          }
          e.target.value = "";
        }}
      />

      {/* Import Document Dialog */}
      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              Import from Document
            </DialogTitle>
            <DialogDescription>
              Upload a Word document or provide a Google Docs URL. We will
              analyze the content and auto-fill the form.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {importError && (
              <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg p-3 flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400 mt-0.5" />
                <p className="text-sm text-red-800 dark:text-red-400">{importError}</p>
              </div>
            )}

            {/* Word Document Upload */}
            <div className="space-y-2">
              <Label>Upload Word Document</Label>
              <Button
                variant="outline"
                className="w-full justify-start gap-2 cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
                disabled={isImporting}
              >
                <Upload className="h-4 w-4" />
                Choose .docx file...
              </Button>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                Supports .doc and .docx files
              </p>
            </div>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200 dark:border-gray-800" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white dark:bg-gray-900 px-2 text-gray-600 dark:text-gray-400">or</span>
              </div>
            </div>

            {/* Google Docs URL */}
            <div className="space-y-2">
              <Label htmlFor="googleDocsUrl">Google Docs URL</Label>
              <div className="flex gap-2">
                <Input
                  id="googleDocsUrl"
                  placeholder="https://docs.google.com/document/d/..."
                  value={googleDocsUrl}
                  onChange={(e) => setGoogleDocsUrl(e.target.value)}
                  disabled={isImporting}
                />
                <Button
                  onClick={handleImportFromGoogleDocs}
                  disabled={isImporting || !googleDocsUrl.trim()}
                >
                  {isImporting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Link className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                Document must be publicly shared (Anyone with the link can view)
              </p>
            </div>

            {isImporting && (
              <div className="flex items-center justify-center gap-2 py-4 text-blue-600 dark:text-blue-400">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span className="text-sm">Analyzing document...</span>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* AI Draft Generation Dialog */}
      <Dialog open={showAIDraftDialog} onOpenChange={setShowAIDraftDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-600" />
              Generate Press Release with AI
            </DialogTitle>
            <DialogDescription>
              Tell us about your news and we'll create a professional press
              release draft.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {importError && (
              <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg p-3 flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400 mt-0.5" />
                <p className="text-sm text-red-800 dark:text-red-400">{importError}</p>
              </div>
            )}

            {/* Source URL */}
            <div className="space-y-2">
              <Label htmlFor="sourceUrl">Source URL (optional)</Label>
              <Input
                id="sourceUrl"
                placeholder="https://yourblog.com/announcement or event page URL..."
                value={aiDraftSourceUrl}
                onChange={(e) => setAiDraftSourceUrl(e.target.value)}
                disabled={isGeneratingDraft || isFetchingUrl}
              />
              <p className="text-xs text-gray-600 dark:text-gray-400">
                Have a blog post or event page? We'll use it to help generate
                your press release.
              </p>
            </div>

            <div className="bg-purple-50 dark:bg-purple-950/20 rounded-md p-3 text-sm text-gray-600 dark:text-gray-400 border border-purple-100 dark:border-purple-800">
              <p className="font-medium text-gray-700 dark:text-gray-300 mb-2">
                Add details about your news:
              </p>
              <ul className="space-y-1 ml-4 list-disc">
                <li>
                  <strong>Who</strong> - Who is involved? (company, people,
                  partners)
                </li>
                <li>
                  <strong>What</strong> - What is the news or announcement?
                </li>
                <li>
                  <strong>Where</strong> - Where is this happening? (city,
                  state/country)
                </li>
                <li>
                  <strong>When</strong> - When is this happening or being
                  announced?
                </li>
                <li>
                  <strong>Why</strong> - Why is this important or newsworthy?
                </li>
                <li>
                  <strong>Quote</strong> - A quote from someone at your company
                  (optional but recommended)
                </li>
              </ul>
              <p className="mt-2 text-gray-600 dark:text-gray-400 italic">
                You can use bullet points or free-form text.{" "}
                {aiDraftSourceUrl.trim()
                  ? "This will be combined with the content from your URL."
                  : ""}
              </p>
            </div>

            <Textarea
              placeholder="Example:&#10;&#10;• Company: Acme Corp, a leading tech startup based in San Francisco&#10;• What: Launching a new AI-powered productivity tool called SmartWidget&#10;• Where: San Francisco, CA&#10;• When: February 15, 2026&#10;• Why: First of its kind, will revolutionize how people manage daily tasks&#10;• Quote from CEO John Smith: 'This represents years of innovation and we're thrilled to finally share it with the world.'"
              value={aiDraftInput}
              onChange={(e) => setAiDraftInput(e.target.value)}
              disabled={isGeneratingDraft || isFetchingUrl}
              rows={8}
              className="resize-none"
            />

            <div className="flex items-center justify-between">
              <p
                className={`text-xs ${aiDraftInput.length < MIN_DRAFT_INPUT_LENGTH && !aiDraftSourceUrl.trim() ? "text-amber-600" : "text-green-600 dark:text-green-400"}`}
              >
                {aiDraftSourceUrl.trim()
                  ? "URL provided - additional details optional"
                  : `${aiDraftInput.length} / ${MIN_DRAFT_INPUT_LENGTH} minimum characters`}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowAIDraftDialog(false);
                    setAiDraftInput("");
                    setAiDraftSourceUrl("");
                    setImportError(null);
                  }}
                  disabled={isGeneratingDraft || isFetchingUrl}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleGenerateAIDraft}
                  disabled={
                    isGeneratingDraft ||
                    isFetchingUrl ||
                    (aiDraftInput.length < MIN_DRAFT_INPUT_LENGTH &&
                      !aiDraftSourceUrl.trim())
                  }
                  className="gap-2 bg-cyan-800 dark:bg-cyan-600 text-white dark:text-white hover:bg-cyan-900 dark:hover:bg-cyan-700 cursor-pointer"
                >
                  {isFetchingUrl ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Fetching URL...
                    </>
                  ) : isGeneratingDraft ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" />
                      Generate Draft
                    </>
                  )}
                </Button>
              </div>
            </div>

            {(isFetchingUrl || isGeneratingDraft) && (
              <div className="flex items-center justify-center gap-2 py-2 text-purple-600">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span className="text-sm">
                  {isFetchingUrl
                    ? "Fetching content from URL..."
                    : "Creating your press release..."}
                </span>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Unified Form Container */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 divide-y divide-gray-100 dark:divide-gray-800">

      {/* Brand & Contact */}
      <div data-tour="pr-create-brand-contact" className="p-6 space-y-5">
        <div>
          <h3 className="font-medium text-gray-900 dark:text-gray-100">Brand & Contact</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">Select the Brand and Primary PR Contact for this Release</p>
        </div>
          <div>
            <Label htmlFor="company">Select Brand <span className="text-xs font-normal text-gray-500 dark:text-gray-400">(Required)</span></Label>
            <Select
              id="company"
              value={selectedCompanyId.toString()}
              onChange={(e) => {
                const newId = parseInt(e.target.value);
                setSelectedCompanyId(newId);
                const newCompany = companies.find((c) => c.id === newId);
                const contacts = newCompany?.contacts || [];
                setFormData((prev) => ({
                  ...prev,
                  primaryContactId: contacts.length === 1 ? contacts[0].id : null,
                }));
              }}
              className="mt-1"
              disabled={readOnly}
            >
              {companies.map((company) => {
                const credits = creditsByCompany[company.id];
                const hasCredits = credits === undefined || credits > 0 || userCredits > 0;
                return (
                  <option key={company.id} value={company.id} disabled={!hasCredits}>
                    {company.companyName}{credits !== undefined ? ` (${credits > 0 ? `${credits} credit${credits !== 1 ? 's' : ''}` : userCredits > 0 ? `Will use 1 of your ${userCredits} account credits.` : 'No credits'})` : ''}
                  </option>
                );
              })}
            </Select>
          </div>

          {selectedCompany && (
            <div>
              <div className="flex justify-between items-center">
                <Label htmlFor="contact">Primary Contact <span className="text-xs font-normal text-gray-500 dark:text-gray-400">(Required)</span></Label>
                <button
                  type="button"
                  onClick={() => setShowContactModal(true)}
                  className="inline-flex items-center gap-1 text-xs text-cyan-800 dark:text-cyan-400 hover:text-cyan-800 dark:text-cyan-400 cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add Contact
                </button>
              </div>
              <Select
                id="contact"
                value={formData.primaryContactId?.toString() || ""}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    primaryContactId: e.target.value
                      ? parseInt(e.target.value)
                      : null,
                  })
                }
                className="mt-1"
              >
                <option value="">Select contact...</option>
                {selectedCompany.contacts.map((contact) => (
                  <option key={contact.id} value={contact.id}>
                    {contact.name} {contact.email && `(${contact.email})`}
                  </option>
                ))}
              </Select>
              <HelpTip title="Contact Tips" content={HELP_TEXT.contact} />
            </div>
          )}
      </div>

      {/* Release Details */}
      <div data-tour="pr-create-release-details" className="p-6 space-y-5">
        <div>
          <h3 className="font-medium text-gray-900 dark:text-gray-100">Release Details</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">Set your headline, summary, and schedule</p>
        </div>
          <div>
            <div className="flex justify-between items-center">
              <Label htmlFor="title">Headline <span className="text-xs font-normal text-gray-500 dark:text-gray-400">(Required)</span></Label>
              <HelpTip title="Headline Tips" content={HELP_TEXT.headline} />
            </div>
            <Textarea
              id="title"
              value={formData.title}
              onChange={(e) =>
                setFormData({ ...formData, title: e.target.value })
              }
              placeholder="Enter your press release headline (30-180 characters)"
              className="mt-1"
              rows={2}
              maxLength={180}
            />
            <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
              {formData.title.length}/180 characters
              {formData.title.length > 60 && (
                <span className="text-amber-600 ml-2">
                  Warning: Headlines over 60 characters may be truncated in
                  search results
                </span>
              )}
            </p>
          </div>

          <div>
            <div className="flex justify-between items-center">
              <Label htmlFor="abstract">Summary / Abstract <span className="text-xs font-normal text-gray-500 dark:text-gray-400">(Required)</span></Label>
              <HelpTip title="Abstract Tips" content={HELP_TEXT.abstract} />
            </div>
            <Textarea
              id="abstract"
              value={formData.abstract}
              onChange={(e) =>
                setFormData({ ...formData, abstract: e.target.value })
              }
              placeholder="Brief summary of your press release (30-350 characters, min 12 words)"
              className="mt-1"
              rows={3}
              maxLength={350}
            />
            <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
              {formData.abstract.length}/350 characters
            </p>
          </div>

          <div>
            <div className="flex justify-between items-center">
              <Label htmlFor="pullquote">Notable Quote (Optional)</Label>
              <HelpTip title="Quote Tips" content={HELP_TEXT.pullquote} />
            </div>
            <Textarea
              id="pullquote"
              value={formData.pullquote}
              onChange={(e) =>
                setFormData({ ...formData, pullquote: e.target.value })
              }
              placeholder="A notable quote from your release (30-350 characters)"
              className="mt-1"
              rows={2}
              maxLength={350}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
            <div>
              <div className="flex justify-between items-center">
                <Label htmlFor="location">Location (Dateline) <span className="text-xs font-normal text-gray-500 dark:text-gray-400">(Required)</span></Label>
                <HelpTip title="Location Tips" content={HELP_TEXT.location} />
              </div>
              <Input
                id="location"
                value={formData.location}
                onChange={(e) =>
                  setFormData({ ...formData, location: e.target.value })
                }
                placeholder="e.g., NEW YORK"
                className="mt-1"
                maxLength={64}
              />
            </div>
            <div>
              <Label htmlFor="timezone">Timezone <span className="text-xs font-normal text-gray-500 dark:text-gray-400">(Required)</span></Label>
              <Select
                id="timezone"
                value={formData.timezone}
                onChange={(e) =>
                  setFormData({ ...formData, timezone: e.target.value })
                }
                className="mt-1"
              >
                {TIMEZONES.map((tz) => (
                  <option key={tz.value} value={tz.value}>
                    {tz.label}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
            <div>
              <div className="flex justify-between items-center">
                <Label htmlFor="releaseDate">Release Date <span className="text-xs font-normal text-gray-500 dark:text-gray-400">(Required)</span></Label>
                <HelpTip
                  title="Release Date Tips"
                  content={HELP_TEXT.releaseDate}
                />
              </div>
              <Input
                id="releaseDate"
                type="date"
                value={formData.releaseDate}
                min={getMinReleaseDate()}
                onChange={(e) => {
                  const newDate = e.target.value;
                  setFormData({ ...formData, releaseDate: newDate });
                  // Validate the combined date/time
                  const selectedDateTime = new Date(
                    `${newDate}T${formData.releaseTime}`,
                  );
                  if (selectedDateTime < getMinReleaseDateTime()) {
                    setDateError(
                      "Release date must be at least 12 hours from now",
                    );
                  } else {
                    setDateError(null);
                  }
                }}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="releaseTime">Release Time <span className="text-xs font-normal text-gray-500 dark:text-gray-400">(Required)</span></Label>
              <Input
                id="releaseTime"
                type="time"
                value={formData.releaseTime}
                onChange={(e) => {
                  const newTime = e.target.value;
                  setFormData({ ...formData, releaseTime: newTime });
                  // Validate the combined date/time
                  const selectedDateTime = new Date(
                    `${formData.releaseDate}T${newTime}`,
                  );
                  if (selectedDateTime < getMinReleaseDateTime()) {
                    setDateError(
                      "Release date must be at least 12 hours from now",
                    );
                  } else {
                    setDateError(null);
                  }
                }}
                className="mt-1"
              />
            </div>
          </div>
          {dateError && (
            <p className="text-sm text-red-600 dark:text-red-400 mt-1">{dateError}</p>
          )}
      </div>

      {/* Categories & Regions */}
      <div data-tour="pr-create-categories" className="p-6 space-y-5">
        <div>
          <h3 className="font-medium text-gray-900 dark:text-gray-100">Categories & Regions</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">Choose relevant topics and target markets</p>
        </div>
          {topCategories.length > 0 && (
            <div>
              <div className="flex justify-between items-center">
                <Label htmlFor="topcat">Primary Category <span className="text-xs font-normal text-gray-500 dark:text-gray-400">(Required)</span></Label>
                <HelpTip title="Category Tips" content={HELP_TEXT.categories} />
              </div>
              <Select
                id="topcat"
                value={formData.topcat}
                onChange={(e) =>
                  setFormData({ ...formData, topcat: e.target.value })
                }
                className="mt-1"
              >
                <option value="">Select primary category...</option>
                {topCategories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </Select>
            </div>
          )}

          {regions.length > 0 && (
            <div>
              <div className="flex justify-between items-center">
                <Label>Target Regions (max 5)</Label>
                <HelpTip title="Region Tips" content={HELP_TEXT.regions} />
              </div>
              <MultiSelect
                options={regions.map((r) => ({ value: r.id, label: r.name }))}
                selected={formData.selectedRegions}
                onChange={(selected) =>
                  setFormData({ ...formData, selectedRegions: selected })
                }
                placeholder="Search and select regions..."
                maxItems={5}
                className="mt-1"
              />
            </div>
          )}
      </div>

      {/* Body Content */}
      <div data-tour="pr-create-content" className="p-6 space-y-4">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="font-medium text-gray-900 dark:text-gray-100">Content <span className="text-xs font-normal text-gray-500 dark:text-gray-400">(Required)</span></h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">Write or paste your press release body</p>
          </div>
          <HelpTip title="Content Tips" content={HELP_TEXT.body} />
        </div>
          <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">Minimum 200 words</p>
          <Editor
            key={isDark ? "dark" : "light"}
            apiKey={process.env.NEXT_PUBLIC_TINYMCE_API_KEY || "no-api-key"}
            onInit={(evt, editor) => (editorRef.current = editor)}
            initialValue={formData.body}
            init={{
              height: 800,
              menubar: false,
              skin: isDark ? "oxide-dark" : "oxide",
              content_css: isDark ? "dark" : "default",
              plugins: [
                "advlist",
                "autolink",
                "lists",
                "link",
                "charmap",
                "searchreplace",
                "visualblocks",
                "code",
                "insertdatetime",
                "table",
                "help",
                "wordcount",
              ],
              toolbar:
                "undo redo | blocks | " +
                "bold italic | alignleft aligncenter " +
                "alignright alignjustify | bullist numlist outdent indent | " +
                "link | removeformat | wordcount",
              block_formats: 'Paragraph=p; Heading 2=h2; Heading 3=h3; Heading 4=h4; Heading 5=h5; Heading 6=h6; Preformatted=pre',
              content_style:
                isDark
                  ? 'body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; font-size: 14px; line-height: 1.6; background-color: #1a1a2e; color: #e0e0e0; }'
                  : 'body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; font-size: 14px; line-height: 1.6; }',
              branding: false,
            }}
          />
      </div>

      {/* Additional Links */}
      <div data-tour="pr-create-links" className="p-6 space-y-5">
        <div>
          <h3 className="font-medium text-gray-900 dark:text-gray-100">Additional Links</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">Add video, landing page, or media kit URLs</p>
        </div>
          <div>
            <div className="flex justify-between items-center">
              <Label htmlFor="videoUrl">Video URL</Label>
              <HelpTip title="Video Tips" content={HELP_TEXT.videoUrl} />
            </div>
            <Input
              id="videoUrl"
              type="url"
              value={formData.videoUrl}
              onChange={(e) =>
                setFormData({ ...formData, videoUrl: e.target.value })
              }
              placeholder="https://youtube.com/watch?v=..."
              className="mt-1"
            />
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
              YouTube or other video URL
            </p>
          </div>

          <div>
            <div className="flex justify-between items-center">
              <Label htmlFor="landingPage">Landing Page URL</Label>
              <HelpTip
                title="Landing Page Tips"
                content={HELP_TEXT.landingPage}
              />
            </div>
            <Input
              id="landingPage"
              type="url"
              value={formData.landingPage}
              onChange={(e) =>
                setFormData({ ...formData, landingPage: e.target.value })
              }
              placeholder="https://yourwebsite.com/campaign"
              className="mt-1"
            />
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">Must include https://</p>
          </div>

          <div>
            <div className="flex justify-between items-center">
              <Label htmlFor="publicDrive">Media Kit / Press Assets URL</Label>
              <HelpTip title="Press Assets Tips" content={HELP_TEXT.driveUrl} />
            </div>
            <Input
              id="publicDrive"
              type="url"
              value={formData.publicDrive}
              onChange={(e) =>
                setFormData({ ...formData, publicDrive: e.target.value })
              }
              placeholder="https://drive.google.com/..."
              className="mt-1"
            />
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
              Dropbox, Google Drive, or Box public URL
            </p>
          </div>
      </div>

      </div>

      {/* Expert Suggestions Dialog */}
      <Dialog open={showSuggestions} onOpenChange={setShowSuggestions}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-cyan-700" />
              SEO/AI Optimization Suggestions
            </DialogTitle>
            <DialogDescription>
              AI-generated recommendations to optimize your press release for
              search engines and AI systems
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {isLoadingSuggestions && (
              <div className="flex flex-col items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-cyan-700 mb-4" />
                <p className="text-gray-600 dark:text-gray-400">Analyzing your press release...</p>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Generating expert suggestions
                </p>
              </div>
            )}

            {suggestionsError && (
              <div className="flex items-center gap-2 p-4 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 rounded-lg">
                <AlertCircle className="h-5 w-5 shrink-0" />
                <span>{suggestionsError}</span>
              </div>
            )}

            {!isLoadingSuggestions &&
              !suggestionsError &&
              suggestions.length > 0 && (
                <div className="space-y-6">
                  {/* Headline Suggestions */}
                  <div className="space-y-4">
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                      Headline Suggestions
                    </h3>

                    <div className="p-3 bg-gray-50 dark:bg-gray-950 rounded-lg">
                      <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                        Current Headline
                      </p>
                      <p className="font-medium text-gray-900 dark:text-gray-100">
                        {formData.title || "Untitled"}
                      </p>
                    </div>

                    <div className="space-y-3">
                      {suggestions.map((suggestion, index) => (
                        <div
                          key={index}
                          onClick={() => {
                            setFormData({
                              ...formData,
                              title: suggestion.headline,
                            });
                            setShowSuggestions(false);
                          }}
                          className="p-4 border border-gray-200 dark:border-gray-800 rounded-lg hover:border-cyan-600 hover:bg-gray-50 dark:hover:bg-gray-800 dark:bg-gray-950 transition-colors cursor-pointer"
                        >
                          <div className="flex items-start gap-3">
                            <div className="bg-cyan-800/10 dark:bg-cyan-400/10 p-2 rounded-full shrink-0">
                              <Lightbulb className="h-4 w-4 text-cyan-700" />
                            </div>
                            <div className="flex-1 space-y-2">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-medium px-2 py-0.5 bg-cyan-800/10 dark:bg-cyan-400/10 text-cyan-800 dark:text-cyan-400 rounded">
                                  {suggestion.strategy}
                                </span>
                                <span className="text-xs text-gray-600 dark:text-gray-400">
                                  Click to use
                                </span>
                              </div>
                              <p className="font-medium text-gray-900 dark:text-gray-100">
                                {suggestion.headline}
                              </p>
                              <p className="text-sm text-gray-600 dark:text-gray-400">
                                {suggestion.explanation}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Suggested Abstract */}
                  {suggestedAbstract && !formData.abstract?.trim() && (
                    <div className="space-y-3 border-t pt-6">
                      <div>
                        <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                          Suggested Abstract
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                          No abstract provided. Here's a suggested summary for
                          your press release:
                        </p>
                      </div>

                      <div
                        onClick={() => {
                          setFormData({
                            ...formData,
                            abstract: suggestedAbstract,
                          });
                          setSuggestedAbstract(null);
                          toast.success("Abstract applied to form");
                        }}
                        className="p-4 border border-gray-200 dark:border-gray-800 rounded-lg hover:border-green-400 hover:bg-green-50 dark:hover:bg-green-950/30 transition-colors cursor-pointer"
                      >
                        <div className="flex items-start gap-3">
                          <div className="bg-green-100 dark:bg-green-900/30 p-2 rounded-full shrink-0">
                            <Lightbulb className="h-4 w-4 text-green-600 dark:text-green-400" />
                          </div>
                          <div className="flex-1 space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-gray-600 dark:text-gray-400">
                                Click to use
                              </span>
                              <span className="text-xs text-gray-600 dark:text-gray-400">
                                ({suggestedAbstract.length}/350 chars)
                              </span>
                            </div>
                            <p className="text-sm text-gray-900 dark:text-gray-100">
                              {suggestedAbstract}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Suggested Pullquote */}
                  {suggestedPullquote && !formData.pullquote?.trim() && (
                    <div className="space-y-3 border-t pt-6">
                      <div>
                        <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                          Suggested Notable Quote
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                          No pullquote provided. Here's a suggested quote from
                          your content:
                        </p>
                      </div>

                      <div
                        onClick={() => {
                          setFormData({
                            ...formData,
                            pullquote: suggestedPullquote,
                          });
                          setSuggestedPullquote(null);
                          toast.success("Pullquote applied to form");
                        }}
                        className="p-4 border border-gray-200 dark:border-gray-800 rounded-lg hover:border-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/30 transition-colors cursor-pointer"
                      >
                        <div className="flex items-start gap-3">
                          <div className="bg-purple-100 dark:bg-purple-900/30 p-2 rounded-full shrink-0">
                            <Lightbulb className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                          </div>
                          <div className="flex-1 space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-gray-600 dark:text-gray-400">
                                Click to use
                              </span>
                            </div>
                            <p className="font-medium text-gray-900 dark:text-gray-100 italic">
                              "{suggestedPullquote}"
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Brandable Chunks Analysis */}
                  {brandableChunks.length > 0 && (
                    <div className="space-y-4 border-t pt-6">
                      <div>
                        <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                          Brandable Chunks Analysis
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                          Content segments that search engines and AI will
                          likely extract for indexing
                        </p>
                      </div>

                      <div className="space-y-4">
                        {brandableChunks.map((chunk, index) => (
                          <div
                            key={index}
                            className="p-4 border border-gray-200 dark:border-gray-800 rounded-lg"
                          >
                            <div className="space-y-3">
                              <div className="flex items-center justify-between gap-3">
                                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                  Chunk {index + 1}
                                </p>
                                <span
                                  className={`text-xs font-medium px-2 py-1 rounded shrink-0 ${
                                    chunk.brandability === "High"
                                      ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
                                      : chunk.brandability === "Medium"
                                        ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400"
                                        : "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400"
                                  }`}
                                >
                                  {chunk.brandability} Brandability
                                </span>
                              </div>

                              <div className="bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded p-3">
                                <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">
                                  Content
                                </p>
                                <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                                  {chunk.chunkContent}
                                </p>
                              </div>

                              <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded p-3">
                                <p className="text-xs font-medium text-amber-800 dark:text-amber-400 mb-1">
                                  Issue
                                </p>
                                <p className="text-sm text-amber-700 dark:text-amber-400">
                                  {chunk.currentIssue}
                                </p>
                              </div>

                              <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded p-3">
                                <p className="text-xs font-medium text-green-800 dark:text-green-400 mb-1">
                                  Recommendation
                                </p>
                                <p className="text-sm text-green-700 dark:text-green-400">
                                  {chunk.recommendation}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <p className="text-xs text-gray-600 dark:text-gray-400 text-center pt-2">
                    These suggestions are AI-generated. Review and adapt them to
                    fit your brand voice and messaging goals.
                  </p>
                </div>
              )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Contact Modal */}
      {showContactModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setShowContactModal(false)}
        >
          <div
            className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-md w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-800">
              <h3 className="font-semibold text-lg text-gray-900 dark:text-gray-100">Add New Contact</h3>
              <button
                onClick={() => setShowContactModal(false)}
                className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 dark:text-gray-300 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              {contactError && (
                <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 p-2 rounded">
                  {contactError}
                </div>
              )}
              <div>
                <Label htmlFor="contactName">Contact Name <span className="text-xs font-normal text-gray-500 dark:text-gray-400">(Required)</span></Label>
                <Input
                  id="contactName"
                  value={contactForm.name}
                  onChange={(e) =>
                    setContactForm({ ...contactForm, name: e.target.value })
                  }
                  placeholder="John Smith"
                  className="mt-1"
                  maxLength={64}
                />
              </div>
              <div>
                <Label htmlFor="contactTitle">Title</Label>
                <Input
                  id="contactTitle"
                  value={contactForm.title}
                  onChange={(e) =>
                    setContactForm({ ...contactForm, title: e.target.value })
                  }
                  placeholder="Director of Communications"
                  className="mt-1"
                  maxLength={32}
                />
              </div>
              <div>
                <Label htmlFor="contactEmail">Email</Label>
                <Input
                  id="contactEmail"
                  type="email"
                  value={contactForm.email}
                  onChange={(e) =>
                    setContactForm({ ...contactForm, email: e.target.value })
                  }
                  placeholder="john@company.com"
                  className="mt-1"
                  maxLength={128}
                />
              </div>
              <div>
                <Label htmlFor="contactPhone">Phone</Label>
                <Input
                  id="contactPhone"
                  type="tel"
                  value={contactForm.phone}
                  onChange={(e) =>
                    setContactForm({ ...contactForm, phone: e.target.value })
                  }
                  placeholder="(555) 123-4567"
                  className="mt-1"
                  maxLength={30}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 p-4 border-t border-gray-100 dark:border-gray-800">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowContactModal(false);
                  setContactForm({ name: "", title: "", email: "", phone: "" });
                  setContactError("");
                }}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleCreateContact}
                disabled={savingContact}
                className="bg-cyan-800 dark:bg-cyan-600 text-white dark:text-white hover:bg-cyan-900 dark:hover:bg-cyan-700 cursor-pointer"
              >
                {savingContact ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Plus className="h-4 w-4 mr-2" />
                )}
                Add Contact
              </Button>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>

    {/* Live Preview Sidebar */}
    {showPreview && (
      <div className="hidden xl:block shrink-0 -mt-6 -mr-6 -mb-6" style={{ width: previewWidth }}>
        <div data-tour="pr-create-preview" className="sticky top-0 h-screen flex">
          <ResizeHandle onResize={handlePreviewResize} />
          <div className="flex-1 min-w-0 overflow-y-auto scrollbar-hide bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-800">
          <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">Live Preview</h3>
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">See how your press release will appear once published</p>
            </div>
            <div className="inline-flex items-center rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 shrink-0">
              {([
                { mode: 'desktop' as const, icon: Monitor, label: 'Desktop' },
                { mode: 'tablet' as const, icon: Tablet, label: 'Tablet' },
                { mode: 'mobile' as const, icon: Smartphone, label: 'Mobile' },
              ]).map(({ mode, icon: Icon, label }, i) => (
                <button
                  key={mode}
                  onClick={() => handleDeviceClick(mode)}
                  title={label}
                  className={cn(
                    'inline-flex items-center px-2 py-1.5 cursor-pointer transition-colors',
                    i === 0 && 'rounded-l-md',
                    i === 2 && 'rounded-r-md',
                    i > 0 && 'border-l border-gray-300 dark:border-gray-700',
                    previewDevice === mode
                      ? 'bg-cyan-800/10 dark:bg-cyan-400/10 text-cyan-800 dark:text-cyan-400'
                      : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 dark:bg-gray-950 hover:text-gray-700 dark:hover:text-gray-300 dark:text-gray-300'
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                </button>
              ))}
            </div>
          </div>
          <div>
            <PreviewPanel
              release={{
                title: formData.title,
                abstract: formData.abstract,
                body: formData.body,
                pullquote: formData.pullquote,
                location: formData.location,
                videoUrl: formData.videoUrl,
              }}
              company={selectedCompany ? {
                logoUrl: selectedCompany.logoUrl,
                companyName: selectedCompany.companyName,
              } : undefined}
              compact
              deviceMode={previewDevice}
            />
          </div>
          </div>
        </div>
      </div>
    )}
    </div>
  );
}
