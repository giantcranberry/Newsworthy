import type { TourDefinition } from "./types"

const dashboardTour: TourDefinition = {
  id: "dashboard",
  name: "Dashboard Overview",
  description: "Learn how to navigate your dashboard and key features",
  emptyTarget: "dashboard-empty",
  emptySteps: [
    {
      id: "dashboard-stats-empty",
      target: "dashboard-stats",
      title: "Your Dashboard",
      description:
        "Welcome! This is your dashboard. These cards show your releases, brands, credits, and review status at a glance. Everything starts at zero — they'll fill up as you start creating.",
      position: "bottom",
    },
    {
      id: "dashboard-recent-releases-empty",
      target: "dashboard-recent-releases",
      title: "Recent Releases",
      description:
        "Your latest press releases will appear here. To get started, you'll first need to add a brand, then you can create and submit your first press release.",
      position: "top",
    },
    {
      id: "sidebar-nav-empty",
      target: "sidebar-nav",
      title: "Sidebar Navigation",
      description:
        "Use the sidebar to navigate the platform. Head to \"Brands\" to set up your first brand profile — that's the first step to distributing a press release.",
      position: "right",
    },
    {
      id: "header-actions-empty",
      target: "header-actions",
      title: "Header Quick Actions",
      description:
        "These buttons are always available at the top. Once you've added a brand, you'll see options here to quickly create new releases and buy credits.",
      position: "bottom",
    },
    {
      id: "header-notifications-empty",
      target: "header-notifications",
      title: "Notifications",
      description:
        "Click the bell icon to check for messages and alerts. You'll receive notifications here about review updates, system announcements, and more.",
      position: "bottom",
    },
  ],
  steps: [
    {
      id: "dashboard-stat-releases",
      target: "dashboard-stat-releases",
      title: "Total Releases",
      description:
        "This card shows the total number of press releases you've created, broken down by published and draft counts. Click it to go to your full releases list where you can search, filter, and manage them.",
      position: "bottom",
    },
    {
      id: "dashboard-stat-brands",
      target: "dashboard-stat-brands",
      title: "Your Brands",
      description:
        "See how many brand profiles you have set up. Each brand represents a company or organization you distribute press releases for. Click to view and manage all your brands.",
      position: "bottom",
    },
    {
      id: "dashboard-stat-credits",
      target: "dashboard-stat-credits",
      title: "PR Credits",
      description:
        "Your available PR credits balance. Credits are used to distribute press releases. Click this card to see a detailed breakdown of your credits by type — standard, Yahoo, enhanced, and concierge.",
      position: "bottom",
    },
    {
      id: "dashboard-stat-review",
      target: "dashboard-stat-review",
      title: "In Review",
      description:
        "Releases currently in the editorial review process. Once submitted, our editorial team reviews your press release for quality and compliance before it goes live. Click to see all releases pending review.",
      position: "bottom",
    },
    {
      id: "dashboard-action-new-release",
      target: "dashboard-action-new-release",
      title: "Create a New Release",
      description:
        "Start writing a new press release. You'll be guided through selecting a brand, writing your content, adding media, and choosing your distribution options.",
      position: "bottom",
    },
    {
      id: "dashboard-action-add-brand",
      target: "dashboard-action-add-brand",
      title: "Add a Brand",
      description:
        "Set up a new brand profile with your company name, logo, contact info, and social media links. Brand profiles are attached to your press releases and appear on published content.",
      position: "bottom",
    },
    {
      id: "dashboard-action-reports",
      target: "dashboard-action-reports",
      title: "View Reports",
      description:
        "Access analytics and performance reports for your published press releases. See distribution reach, clip counts, and engagement data to measure the impact of your PR campaigns.",
      position: "bottom",
    },
    {
      id: "dashboard-action-buy-credits",
      target: "dashboard-action-buy-credits",
      title: "Buy Credits",
      description:
        "Purchase additional PR credits when you're ready to distribute more press releases. Choose from different credit packages based on your distribution needs.",
      position: "bottom",
    },
    {
      id: "dashboard-recent-releases",
      target: "dashboard-recent-releases",
      title: "Recent Releases",
      description:
        "Your five most recent press releases are listed here with their current status — Draft, In Review, Approved, or Published. Click any release to view its full details, edit the content, or check distribution progress.",
      position: "top",
    },
    {
      id: "dashboard-brands",
      target: "dashboard-brands",
      title: "Your Brands",
      description:
        "A snapshot of your brand profiles with logos and websites. Each brand can have its own team members, credits, and press release history. Click \"Manage Brands\" to add, edit, or configure your brands.",
      position: "top",
    },
    {
      id: "sidebar-nav",
      target: "sidebar-nav",
      title: "Sidebar Navigation",
      description:
        "Your main navigation hub. Expand each section to find sub-pages — Press Releases has your drafts and reports, Brands has your brand list, and Billing has credit management and purchase history. The sidebar can be collapsed for more screen space.",
      position: "right",
    },
    {
      id: "header-actions",
      target: "header-actions",
      title: "Header Quick Actions",
      description:
        "These buttons are always available in the top bar no matter where you are in the app. Quickly create a new release or buy credits without navigating away from your current page.",
      position: "bottom",
    },
    {
      id: "header-notifications",
      target: "header-notifications",
      title: "Notifications",
      description:
        "Click the bell to see your latest messages and alerts — review updates, system announcements, and team notifications. A red badge appears when you have unread messages.",
      position: "bottom",
    },
  ],
}

const adminTour: TourDefinition = {
  id: "admin",
  name: "Admin Dashboard Overview",
  description: "Learn about the admin tools and management features",
  steps: [
    {
      id: "admin-pr-lookup",
      target: "admin-pr-lookup",
      title: "PR Lookup Tool",
      description:
        "Paste any Newsworthy URL or enter a PR ID to instantly pull up full release details. You'll see the title, status, author info, brand details, and quick action buttons to edit, view the report, or jump to the live page.",
      position: "bottom",
    },
    {
      id: "admin-sales-stats",
      target: "admin-sales-stats",
      title: "Sales Dashboard",
      description:
        "Real-time revenue tracking pulled from Stripe. Compare sales across four time periods — today, week-to-date, month-to-date, and year-to-date — each with comparisons to the previous period. Expand the outstanding invoices section to see unpaid balances.",
      position: "bottom",
    },
    {
      id: "admin-stat-users",
      target: "admin-stat-users",
      title: "Total Users",
      description:
        "The total number of registered accounts on the platform. This includes all user types — customers, team members, and staff. Head to Manage Users in Quick Actions to search, view details, or manage individual accounts.",
      position: "top",
    },
    {
      id: "admin-stat-releases",
      target: "admin-stat-releases",
      title: "Total Releases",
      description:
        "Every press release in the system across all users and brands, regardless of status. This gives you a birds-eye view of platform content volume. Use the All Releases quick action to search and filter the full list.",
      position: "top",
    },
    {
      id: "admin-stat-companies",
      target: "admin-stat-companies",
      title: "Total Companies",
      description:
        "The number of brand/company profiles created by all users. Each company has its own logo, contact info, and associated press releases. You can manage them under Admin > Brands in the sidebar.",
      position: "top",
    },
    {
      id: "admin-stat-partners",
      target: "admin-stat-partners",
      title: "Total Partners",
      description:
        "Partner organizations that resell or refer users to the platform. Each partner can have their own dashboard, user tracking, and commission structure. Manage them via the Partners quick action.",
      position: "bottom",
    },
    {
      id: "admin-action-users",
      target: "admin-action-users",
      title: "Manage Users",
      description:
        "Search and manage all user accounts. View user details, their releases, brands, credits, and team memberships. You can also impersonate users to troubleshoot issues from their perspective.",
      position: "bottom",
    },
    {
      id: "admin-action-releases",
      target: "admin-action-releases",
      title: "All Releases",
      description:
        "Browse and search the complete list of press releases across the platform. Filter by status, date, or brand. Access any release to view, edit, or check its distribution status.",
      position: "bottom",
    },
    {
      id: "admin-action-partners",
      target: "admin-action-partners",
      title: "Partners",
      description:
        "View and manage partner organizations. Partners can resell or refer users to the platform with their own dashboards, user tracking, and commission structures.",
      position: "bottom",
    },
    {
      id: "admin-action-products",
      target: "admin-action-products",
      title: "Products & Pricing",
      description:
        "Manage your product catalog — credit packages, pricing tiers, and distribution options. Configure what customers can purchase and the credit amounts included with each product.",
      position: "bottom",
    },
    {
      id: "admin-action-messages",
      target: "admin-action-messages",
      title: "Messages",
      description:
        "Send and manage system-wide announcements and individual user messages. Create global notifications that appear for all users, or send targeted messages to specific accounts.",
      position: "top",
    },
    {
      id: "admin-action-tasks",
      target: "admin-action-tasks",
      title: "Tasks",
      description:
        "Track internal tasks and to-dos for your team. Create, assign, and manage tasks related to editorial work, customer support, or platform operations.",
      position: "top",
    },
    {
      id: "admin-action-review-queue",
      target: "admin-action-review-queue",
      title: "Review Queue",
      description:
        "The editorial review queue where submitted press releases await approval. The red badge shows how many are currently pending. Review, approve, request changes, or reject releases before they go live.",
      position: "top",
    },
    {
      id: "admin-pending-review",
      target: "admin-pending-review",
      title: "Pending Review Alert",
      description:
        "This alert appears when press releases are waiting for editorial approval. It shows the exact count and provides a direct link to the review queue so you can process them quickly. Keeping this queue clear ensures fast turnaround for your customers.",
      position: "top",
    },
  ],
}

const prTour: TourDefinition = {
  id: "pr",
  name: "Press Releases",
  description: "Learn how to manage your press releases",
  emptyTarget: "pr-empty",
  emptySteps: [
    {
      id: "pr-empty",
      target: "pr-empty",
      title: "No Releases Yet",
      description:
        "This is where all your press releases will be listed — drafts, submitted, and published. Each one shows as a card with its status, brand, and actions.",
      position: "bottom",
    },
    {
      id: "pr-new-release-empty",
      target: "pr-new-release",
      title: "Get Started",
      description:
        "Click here to create your first press release. You'll pick a brand, write your headline and content, add images, and submit for editorial review.",
      position: "bottom",
    },
  ],
  steps: [
    {
      id: "pr-new-release",
      target: "pr-new-release",
      title: "Create a New Release",
      description:
        "Click here to start writing a new press release. You'll select a brand, write your headline and content, attach images, and choose distribution options before submitting for review.",
      position: "bottom",
    },
    {
      id: "pr-filters",
      target: "pr-filters",
      title: "Filter by Status",
      description:
        "Quickly narrow down your releases by status. \"All\" shows everything, \"Drafts\" shows work in progress, \"In Review\" shows releases awaiting editorial approval, and \"Published\" shows live releases. Each tab shows a count so you know exactly how many are in each stage.",
      position: "bottom",
    },
    {
      id: "pr-first-release",
      target: "pr-first-release",
      title: "Release Card",
      description:
        "Each press release is displayed as a card with its banner image, title, brand name, and a short preview of the content. Cards are sorted by creation date with the newest first.",
      position: "bottom",
    },
    {
      id: "pr-status-badge",
      target: "pr-status-badge",
      title: "Release Status",
      description:
        "The colored badge shows the current status of each release. Draft (gray) means it's still being written, In Review (yellow) means it's submitted for editorial approval, Approved (blue) means it's ready to publish, and Published (green) means it's live and distributed.",
      position: "bottom",
    },
    {
      id: "pr-release-actions",
      target: "pr-release-actions",
      title: "Release Actions",
      description:
        "Depending on the release status, you'll see different actions here. Draft releases can be edited or deleted. Releases in review can be retracted back to drafts. Published releases have a \"View\" button to see the live page on Newsworthy.ai.",
      position: "left",
    },
  ],
}

const prCreateTour: TourDefinition = {
  id: "pr-create",
  name: "Create a Press Release",
  description: "Learn how to write and submit a new press release",
  steps: [
    {
      id: "pr-create-action-bar",
      target: "pr-create-action-bar",
      title: "Action Bar",
      description:
        "The sticky action bar stays at the top as you scroll. Use \"Save Draft\" to save your work without submitting, or \"Save & Continue\" to save and proceed to the next step (logo upload and FAQ). The \"Cancel\" button takes you back to your releases list.",
      position: "bottom",
    },
    {
      id: "pr-create-import-generate",
      target: "pr-create-import-generate",
      title: "Import or Generate",
      description:
        "Speed up your workflow with two quick-start options. \"Import from Document\" lets you upload a Word doc or paste a Google Docs URL to auto-fill the form. \"Generate with AI\" creates a professional draft from your bullet points or a source URL — just describe your news and AI does the rest.",
      position: "bottom",
    },
    {
      id: "pr-create-brand-contact",
      target: "pr-create-brand-contact",
      title: "Brand & Contact",
      description:
        "Select which brand this press release is for and choose a primary PR contact. The contact's name and email will appear on the published release so journalists know who to reach out to. You can add new contacts directly from here if needed.",
      position: "top",
    },
    {
      id: "pr-create-release-details",
      target: "pr-create-release-details",
      title: "Release Details",
      description:
        "Fill in your headline (keep it under 60 characters for best SEO), a summary/abstract, and an optional notable quote. Set your dateline location (e.g., \"NEW YORK\"), timezone, and schedule the release date and time. Releases must be scheduled at least 12 hours in advance.",
      position: "top",
    },
    {
      id: "pr-create-categories",
      target: "pr-create-categories",
      title: "Categories & Regions",
      description:
        "Choose a primary category that best describes your news (e.g., Technology, Healthcare, Finance). Then select up to 5 target regions where your release will be distributed. Categories and regions help journalists and news outlets find relevant content.",
      position: "top",
    },
    {
      id: "pr-create-content",
      target: "pr-create-content",
      title: "Content Editor",
      description:
        "Write or paste the full body of your press release using the rich text editor. Format text with headings, bold, italic, lists, and links. Content should be at least 200 words. Follow standard press release structure: lead paragraph, body with supporting details, boilerplate, and contact info.",
      position: "top",
    },
    {
      id: "pr-create-links",
      target: "pr-create-links",
      title: "Additional Links",
      description:
        "Optionally add a YouTube or video URL that will be embedded in your release, a landing page URL for readers to learn more, and a media kit or press assets link (Google Drive, Dropbox, or Box) where journalists can download logos, images, and other resources.",
      position: "top",
    },
    {
      id: "pr-create-preview",
      target: "pr-create-preview",
      title: "Live Preview",
      description:
        "See a real-time preview of how your press release will look once published on Newsworthy.ai. Toggle between Desktop, Tablet, and Mobile views to check formatting across devices. The preview updates automatically as you type. Drag the left edge to resize the preview panel.",
      position: "left",
    },
  ],
}

const draftsTour: TourDefinition = {
  id: "drafts",
  name: "Drafts",
  description: "Learn how to manage your draft press releases",
  emptyTarget: "drafts-empty",
  emptySteps: [
    {
      id: "drafts-empty",
      target: "drafts-empty",
      title: "No Drafts",
      description:
        "Drafts you're working on will appear here as cards. Each draft shows its title, brand, and content preview with options to continue editing or delete.",
      position: "bottom",
    },
    {
      id: "drafts-new-release-empty",
      target: "drafts-new-release",
      title: "Start Writing",
      description:
        "Click here to create a new press release. It will automatically save here as a draft until you're ready to submit it for editorial review.",
      position: "bottom",
    },
  ],
  steps: [
    {
      id: "drafts-new-release",
      target: "drafts-new-release",
      title: "Create a New Release",
      description:
        "Click here to start writing a new press release. You'll be taken to the editor where you can select a brand, write your content, add media, and choose distribution options.",
      position: "bottom",
    },
    {
      id: "drafts-first-card",
      target: "drafts-first-card",
      title: "Draft Card",
      description:
        "Each draft is displayed as a card showing its banner image, title, brand name, and a short preview of the content. Drafts are sorted by creation date with the newest first. Click the title to open the full editor.",
      position: "bottom",
    },
    {
      id: "drafts-actions",
      target: "drafts-actions",
      title: "Draft Actions",
      description:
        "Use \"Edit\" to continue working on a draft — update the headline, content, images, or distribution settings. The trash icon permanently deletes the draft. Drafts stay here until you submit them for editorial review.",
      position: "left",
    },
  ],
}

const reportsTour: TourDefinition = {
  id: "reports",
  name: "Reports",
  description: "Learn how to view and share your press release reports",
  emptyTarget: "reports-empty",
  emptySteps: [
    {
      id: "reports-empty",
      target: "reports-empty",
      title: "No Reports Yet",
      description:
        "Once your press releases are published and distributed, performance reports will appear here showing distribution reach, media pickups, and engagement metrics.",
      position: "bottom",
    },
  ],
  steps: [
    {
      id: "reports-brand-filter",
      target: "reports-brand-filter",
      title: "Filter by Brand",
      description:
        "If you manage multiple brands, use this dropdown to filter reports by a specific brand. Select \"All Brands\" to see reports across all your brands at once.",
      position: "bottom",
    },
    {
      id: "reports-columns",
      target: "reports-columns",
      title: "Report Table",
      description:
        "Your published releases are listed in a table sorted by release date, newest first. Each row shows when the release went live, its title, and the brand it belongs to.",
      position: "bottom",
    },
    {
      id: "reports-first-row",
      target: "reports-first-row",
      title: "Release Entry",
      description:
        "Each row represents a published press release. The date column shows when it was distributed, the title column shows the headline and brand, and the reports column shows available actions or a \"Pending\" status if the report isn't ready yet.",
      position: "bottom",
    },
    {
      id: "reports-actions",
      target: "reports-actions",
      title: "Report Actions",
      description:
        "\"Full Report\" opens a detailed clipping report showing distribution reach, media pickups, and engagement metrics. \"Shareable\" opens a public version of the report you can share with clients or stakeholders — great for proving PR ROI.",
      position: "left",
    },
  ],
}

const brandsTour: TourDefinition = {
  id: "brands",
  name: "Brands",
  description: "Learn how to manage your brand profiles",
  emptyTarget: "brands-empty",
  emptySteps: [
    {
      id: "brands-empty",
      target: "brands-empty",
      title: "No Brands Yet",
      description:
        "This is where your brand profiles will be listed. Each brand has its own logo, contact info, credits, and press release history.",
      position: "bottom",
    },
    {
      id: "brands-add-empty",
      target: "brands-add",
      title: "Add Your First Brand",
      description:
        "Click here to create a brand profile. You'll enter your company name, upload a logo, and add contact details. Brands are required before you can create press releases.",
      position: "bottom",
    },
  ],
  steps: [
    {
      id: "brands-add",
      target: "brands-add",
      title: "Add a Brand",
      description:
        "Click here to create a new brand profile. You'll enter your company name, logo, website, contact info, and social media links. Each brand can have its own team members, credits, and press releases.",
      position: "bottom",
    },
    {
      id: "brands-layout-toggle",
      target: "brands-layout-toggle",
      title: "Layout Toggle",
      description:
        "Switch between grid and list views to display your brands the way you prefer. Grid view shows logo-forward cards, while list view gives a compact overview with more details visible at a glance.",
      position: "bottom",
    },
    {
      id: "brands-first-card",
      target: "brands-first-card",
      title: "Brand Card",
      description:
        "Each brand card shows the company logo, name, your role (Owner, Brand Admin, Collaborator, or Client), website link, and location. Click the brand name to view and edit the full brand profile.",
      position: "bottom",
    },
    {
      id: "brands-credits",
      target: "brands-credits",
      title: "Brand Credits",
      description:
        "The credit balance for this brand. Credits are used to distribute press releases. Each brand can have its own credit pool, separate from your account-level credits. Green means credits are available, gray means none remaining.",
      position: "top",
    },
    {
      id: "brands-actions",
      target: "brands-actions",
      title: "Brand Actions",
      description:
        "\"Edit\" opens the full brand profile where you can update company details, logo, contacts, and team members. \"New Release\" takes you straight to the press release editor with this brand pre-selected.",
      position: "left",
    },
  ],
}

const brandAddTour: TourDefinition = {
  id: "brand-add",
  name: "Add a Brand",
  description: "Learn how to create a new brand profile",
  steps: [
    {
      id: "brand-form-action-bar",
      target: "brand-form-action-bar",
      title: "Action Bar",
      description:
        "The sticky action bar stays at the top as you fill out the form. Click \"Create Brand\" when you're done, or \"Cancel\" to go back. The brand name field is required before you can save.",
      position: "bottom",
    },
    {
      id: "brand-form-basic-info",
      target: "brand-form-basic-info",
      title: "Basic Information",
      description:
        "Enter your company name (required) and website URL. Upload a logo by clicking the upload area or dragging and dropping an image file. Your logo appears on published press releases and in your brand profile. Supported formats: PNG, JPG, WebP, SVG (max 5MB).",
      position: "top",
    },
    {
      id: "brand-form-contact-info",
      target: "brand-form-contact-info",
      title: "Contact Information",
      description:
        "Add a general email and phone number for this brand. This is the company-level contact info — you'll add individual PR contacts (the people journalists reach out to) after creating the brand.",
      position: "top",
    },
    {
      id: "brand-form-address",
      target: "brand-form-address",
      title: "Address",
      description:
        "Enter your company's mailing address. This information is used for billing and may appear in your press release boilerplate. Select your country from the dropdown — US, Canada, UK, and Australia are supported.",
      position: "top",
    },
  ],
}

const editorialQueueTour: TourDefinition = {
  id: "editorial-queue",
  name: "Editorial Queue",
  description: "Learn how to review and manage submitted press releases",
  emptyTarget: "queue-empty",
  emptySteps: [
    {
      id: "queue-empty",
      target: "queue-empty",
      title: "All Caught Up!",
      description:
        "Your review queue is clear — no press releases are waiting for editorial review right now. When a customer submits a release, it will appear here sorted by release date with the most urgent ones first.",
      position: "bottom",
    },
    {
      id: "queue-pending-count-empty",
      target: "queue-pending-count",
      title: "Pending Counter",
      description:
        "This badge tracks how many releases are awaiting review. Right now it shows zero — check back when new submissions come in.",
      position: "bottom",
    },
  ],
  steps: [
    {
      id: "queue-pending-count",
      target: "queue-pending-count",
      title: "Pending Count",
      description:
        "This badge shows the total number of press releases waiting for editorial review. Keeping this number low ensures fast turnaround for customers.",
      position: "bottom",
    },
    {
      id: "queue-first-item",
      target: "queue-first-item",
      title: "Queue Item",
      description:
        "Each card represents a submitted press release. You can see the title, the brand and author email, when it was submitted, and the scheduled release date. Items are sorted by release date so the most urgent ones appear first.",
      position: "bottom",
    },
    {
      id: "queue-distribution",
      target: "queue-distribution",
      title: "Distribution Type",
      description:
        "The colored badge indicates the distribution tier — YAHOO (purple) for Yahoo Finance distribution, ENHANCED (blue) for premium wire distribution, or STANDARD (gray) for basic distribution. This helps prioritize your review workflow.",
      position: "bottom",
    },
    {
      id: "queue-actions",
      target: "queue-actions",
      title: "Review Actions",
      description:
        "\"Checkout\" claims the release so other editors know you're working on it. Once checked out, \"Edit / Approve\" opens the editorial editor where you can make changes and approve or reject the release. \"Disown\" releases your claim so another editor can pick it up. \"Capture\" lets you take over a release checked out by someone else.",
      position: "top",
    },
  ],
}

const enhancedQueueTour: TourDefinition = {
  id: "enhanced-queue",
  name: "Enhanced Distribution Queue",
  description: "Learn how to process enhanced and Yahoo distribution releases",
  emptyTarget: "enhanced-queue-empty",
  emptySteps: [
    {
      id: "enhanced-queue-empty",
      target: "enhanced-queue-empty",
      title: "All Caught Up!",
      description:
        "No enhanced or Yahoo distribution releases need processing right now. When a release with enhanced or Yahoo distribution is published without a report URL, it will appear here for you to add one.",
      position: "bottom",
    },
  ],
  steps: [
    {
      id: "enhanced-queue-first-item",
      target: "enhanced-queue-first-item",
      title: "Queue Item",
      description:
        "Each card represents a published release with enhanced or Yahoo distribution that's missing a report URL. You can see the title, distribution tier, and when it was released.",
      position: "bottom",
    },
    {
      id: "enhanced-queue-distribution",
      target: "enhanced-queue-distribution",
      title: "Distribution Type",
      description:
        "The badge shows the distribution tier — YAHOO (purple) for Yahoo Finance distribution or ENHANCED (blue) for premium wire distribution. This tells you which distribution partner's report system to check.",
      position: "bottom",
    },
    {
      id: "enhanced-queue-actions",
      target: "enhanced-queue-actions",
      title: "Report URL & Actions",
      description:
        "Paste the report URL from the distribution partner into the input field and click \"Save URL\" to attach it to the release. If the distribution didn't go through, use \"Reset to Standard\" to downgrade the release back to standard distribution.",
      position: "top",
    },
  ],
}

const pendingTour: TourDefinition = {
  id: "pending",
  name: "Pending Release",
  description: "Learn how to manage approved releases awaiting distribution",
  emptyTarget: "pending-empty",
  emptySteps: [
    {
      id: "pending-empty",
      target: "pending-empty",
      title: "No Pending Releases",
      description:
        "All approved releases have been distributed. When a release is approved by an editor but hasn't been distributed yet, it will appear here so you can track it or pull it back to draft if needed.",
      position: "bottom",
    },
  ],
  steps: [
    {
      id: "pending-first-item",
      target: "pending-first-item",
      title: "Pending Release",
      description:
        "Each card shows an approved release that's waiting for distribution. You can see the title, distribution tier, and the scheduled release date and time.",
      position: "bottom",
    },
    {
      id: "pending-distribution",
      target: "pending-distribution",
      title: "Distribution Type",
      description:
        "The badge shows the distribution tier — YAHOO (purple) for Yahoo Finance, ENHANCED (blue) for premium wire, or STANDARD (gray) for basic distribution. This determines where the release will be sent.",
      position: "bottom",
    },
    {
      id: "pending-actions",
      target: "pending-actions",
      title: "Release Actions",
      description:
        "\"Edit\" opens the editorial editor where you can make last-minute changes before distribution. \"Pull\" reverts the release back to draft status — use this if a release was approved by mistake or the customer needs to make changes.",
      position: "top",
    },
  ],
}

const releasedEditTour: TourDefinition = {
  id: "released-edit",
  name: "Edit Released Press Release",
  description: "Learn how to look up and edit a released press release",
  steps: [
    {
      id: "released-edit-lookup",
      target: "released-edit-lookup",
      title: "Lookup Tool",
      description:
        "Use this card to find a released press release you need to edit. Only releases with a \"sent\" (released) status can be edited from here — drafts and in-review releases are managed from the main press releases section.",
      position: "bottom",
    },
    {
      id: "released-edit-input",
      target: "released-edit-input",
      title: "PR ID or URL",
      description:
        "Enter the numeric press release ID (e.g., 2181) or paste a full Newsworthy.ai URL. The system will automatically extract the ID from the URL, so you can copy-paste directly from the live page.",
      position: "bottom",
    },
    {
      id: "released-edit-submit",
      target: "released-edit-submit",
      title: "Find Release",
      description:
        "Click to look up the release. If found and in released status, you'll be taken to the editor where you can update the headline, content, images, and other details. Changes are saved directly to the live release.",
      position: "bottom",
    },
  ],
}

const adminUsersTour: TourDefinition = {
  id: "admin-users",
  name: "User Management",
  description: "Learn how to search, filter, and manage user accounts",
  steps: [
    {
      id: "users-search",
      target: "users-search",
      title: "Search Users",
      description:
        "Search for users by email address. Type a full or partial email and click Search to filter the list. Use the X button to clear your search and show all users again.",
      position: "bottom",
    },
    {
      id: "users-filters",
      target: "users-filters",
      title: "Filter by Status",
      description:
        "Quickly filter users by verification status. \"All\" shows every account, \"Pending\" shows users who haven't verified their email yet, and \"Verified\" shows confirmed accounts. Each tab shows a count that updates with your search.",
      position: "bottom",
    },
    {
      id: "users-columns",
      target: "users-columns",
      title: "User Table",
      description:
        "The table shows all matching users sorted by creation date (newest first), limited to 100 results. Columns include the user ID, email, verification status, role badges, creation date, and available actions.",
      position: "bottom",
    },
    {
      id: "users-first-row",
      target: "users-first-row",
      title: "User Entry",
      description:
        "Each row shows a user account. The Verified column has a toggle to manually verify or unverify an email. Role badges indicate Admin (red), Editor (blue), Staff (purple), or regular User (gray).",
      position: "bottom",
    },
    {
      id: "users-actions",
      target: "users-actions",
      title: "User Actions",
      description:
        "\"Send Message\" lets you send a direct notification to this user. \"View\" opens the full user detail page where you can see their releases, brands, credits, team memberships, and impersonate their account for troubleshooting.",
      position: "left",
    },
  ],
}

const adminBrandsTour: TourDefinition = {
  id: "admin-brands",
  name: "Brand Management",
  description: "Learn how to search and manage all brands on the platform",
  steps: [
    {
      id: "admin-brands-search",
      target: "admin-brands-search",
      title: "Search Brands",
      description:
        "Search for brands by company name. Type a full or partial name and click Search to filter the list. Use the X button to clear your search and show all brands again.",
      position: "bottom",
    },
    {
      id: "admin-brands-columns",
      target: "admin-brands-columns",
      title: "Brand Table",
      description:
        "The table shows all matching brands sorted by ID (newest first), limited to 200 results. Columns include the brand ID, name with logo, website, location, owner email, status, and available actions.",
      position: "bottom",
    },
    {
      id: "admin-brands-first-row",
      target: "admin-brands-first-row",
      title: "Brand Entry",
      description:
        "Each row shows a brand with its logo, name, website link, city/state location, and the owner's email (links to their user profile). The status badge shows Active (green), Archived (amber), or Deleted (red).",
      position: "bottom",
    },
    {
      id: "admin-brands-actions",
      target: "admin-brands-actions",
      title: "Brand Actions",
      description:
        "\"View\" opens the admin brand detail page with credits, team members, and release history. \"Edit\" opens the brand profile editor where you can update the company name, logo, contacts, and other details.",
      position: "left",
    },
  ],
}

const adminPartnersTour: TourDefinition = {
  id: "admin-partners",
  name: "Partner Management",
  description: "Learn how to manage partner accounts",
  emptyTarget: "partners-empty",
  emptySteps: [
    {
      id: "partners-empty",
      target: "partners-empty",
      title: "No Partners Yet",
      description:
        "This is where your partner organizations will be listed. Partners can resell or refer users to the platform with their own dashboards, user tracking, and commission structures.",
      position: "bottom",
    },
  ],
  steps: [
    {
      id: "partners-filters",
      target: "partners-filters",
      title: "Filter Partners",
      description:
        "Filter partners by status. \"Active\" shows partners currently operating on the platform, \"Inactive\" shows disabled partners, and \"All\" shows everyone. Active partners are sorted first, then alphabetically.",
      position: "bottom",
    },
    {
      id: "partners-add",
      target: "partners-add",
      title: "Add Partner",
      description:
        "Click to create a new partner account. You'll enter the company name, handle (URL slug), partner type (affiliate, agency, publisher, or reseller), and a contact email. After creating, you'll be taken to the full settings page.",
      position: "bottom",
    },
    {
      id: "partners-first-card",
      target: "partners-first-card",
      title: "Partner Card",
      description:
        "Each card shows the partner's logo, company name, handle, status badge (Active/Inactive), partner type, contact email, and base price. Switch between grid and list views using the layout toggle.",
      position: "bottom",
    },
    {
      id: "partners-actions",
      target: "partners-actions",
      title: "Manage Partner",
      description:
        "Click \"Manage\" to open the partner's detail page where you can update their settings, logo, pricing, branded landing page, and manage their user assignments and commission structure.",
      position: "left",
    },
  ],
}

const adminProductsTour: TourDefinition = {
  id: "admin-products",
  name: "Products & Pricing",
  description: "Learn how to manage upgrade products and pricing",
  emptyTarget: "products-empty",
  emptySteps: [
    {
      id: "products-empty",
      target: "products-empty",
      title: "No Products Found",
      description:
        "No upgrade products match the current filter. Products define the credit packages and distribution upgrades that customers can purchase. Use the \"Add Product\" button to create one, or change the filter to see existing products.",
      position: "bottom",
    },
    {
      id: "products-add-empty",
      target: "products-add",
      title: "Create a Product",
      description:
        "Click here to create a new upgrade product. You'll set the display name, price, icon, product type, and optionally assign it to a specific partner.",
      position: "bottom",
    },
  ],
  steps: [
    {
      id: "products-filter",
      target: "products-filter",
      title: "Filter by Partner",
      description:
        "Filter products by availability. \"All Products\" shows everything, \"Global\" shows products available to all accounts, or select a specific partner to see their exclusive products.",
      position: "bottom",
    },
    {
      id: "products-add",
      target: "products-add",
      title: "Add Product",
      description:
        "Click to create a new upgrade product. You'll configure the display name, short name, description, icon, price, product type, and whether it's a solo or bundled upgrade. You can also assign it to a specific partner.",
      position: "bottom",
    },
    {
      id: "products-first-item",
      target: "products-first-item",
      title: "Product Card",
      description:
        "Each card shows the product icon, display name, type badge, availability (Global or partner-specific), label, and price. Products define what customers see on the upgrade/checkout page.",
      position: "bottom",
    },
    {
      id: "products-actions",
      target: "products-actions",
      title: "Product Actions",
      description:
        "\"Edit\" opens the product form to update any field — name, price, icon, description, or partner assignment. \"Delete\" permanently removes the product (with confirmation). Deleted products won't appear on checkout pages.",
      position: "left",
    },
  ],
}

const adminCategoriesTour: TourDefinition = {
  id: "admin-categories",
  name: "Categories",
  description: "Learn how to manage press release categories and circuits",
  emptyTarget: "categories-empty",
  emptySteps: [
    {
      id: "categories-empty",
      target: "categories-empty",
      title: "No Categories Found",
      description:
        "No categories match the current search or filter. Categories are used to classify press releases so journalists and news outlets can find relevant content. Try adjusting your filters or create a new category.",
      position: "bottom",
    },
    {
      id: "categories-add-empty",
      target: "categories-add",
      title: "Create a Category",
      description:
        "Click here to add a new category. You'll set the name, slug, optional description, parent category, and assign it to one or more circuits.",
      position: "bottom",
    },
  ],
  steps: [
    {
      id: "categories-search",
      target: "categories-search",
      title: "Search Categories",
      description:
        "Search for categories by name or slug. Type a keyword and click Search to filter the list. This searches across all categories regardless of the level or circuit filters.",
      position: "bottom",
    },
    {
      id: "categories-filters",
      target: "categories-filters",
      title: "Filter Categories",
      description:
        "Use the level dropdown to show \"Top Level\" categories only or \"All Categories\" including subcategories. The circuit dropdown filters by distribution circuit — categories can belong to multiple circuits.",
      position: "bottom",
    },
    {
      id: "categories-add",
      target: "categories-add",
      title: "Add Category",
      description:
        "Click to create a new category. You'll set the display name, URL slug, optional description, parent category (for subcategories), and assign it to one or more distribution circuits.",
      position: "bottom",
    },
    {
      id: "categories-circuits",
      target: "categories-circuits",
      title: "Manage Circuits",
      description:
        "Circuits are distribution channels that group categories together. Click to expand the panel where you can add, rename, or delete circuits, and see which categories are assigned to each one. You can also unlink categories from circuits.",
      position: "bottom",
    },
    {
      id: "categories-first-item",
      target: "categories-first-item",
      title: "Category Card",
      description:
        "Each card shows the category icon (tag for top-level, folder for subcategories), name, URL slug, circuit badges, parent category, and description. Categories are sorted alphabetically.",
      position: "bottom",
    },
    {
      id: "categories-actions",
      target: "categories-actions",
      title: "Category Actions",
      description:
        "\"Edit\" opens the category form to update the name, slug, description, parent, or circuit assignments. \"Delete\" permanently removes the category (with confirmation).",
      position: "left",
    },
  ],
}

const adminEmailTemplatesTour: TourDefinition = {
  id: "admin-email-templates",
  name: "Email Templates",
  description: "Learn how to manage system transactional email templates",
  steps: [
    {
      id: "email-templates-search",
      target: "email-templates-search",
      title: "Search Templates",
      description:
        "Filter templates by name, slug, or description. Start typing to instantly narrow down the list — no need to click a search button.",
      position: "bottom",
    },
    {
      id: "email-templates-list",
      target: "email-templates-list",
      title: "Template List",
      description:
        "All system transactional email templates are listed here alphabetically. These are the emails sent automatically for events like account verification, password resets, release approvals, and notifications.",
      position: "top",
    },
    {
      id: "email-templates-first-item",
      target: "email-templates-first-item",
      title: "Template Entry",
      description:
        "Each row shows the template name, its internal slug (used in code to reference this template), an optional description of when the email is sent, and the last time it was updated.",
      position: "bottom",
    },
    {
      id: "email-templates-actions",
      target: "email-templates-actions",
      title: "Edit Template",
      description:
        "Click \"Edit\" to open the full template editor. You can modify the template name, email subject line, HTML body with a live preview, and a plain text fallback. Available template variables (like {{name}}, {{link}}) are shown in the editor.",
      position: "left",
    },
  ],
}

const adminMessagesTour: TourDefinition = {
  id: "admin-messages",
  name: "Messages",
  description: "Learn how to manage global announcements and send messages to users",
  emptyTarget: "messages-global-empty",
  emptySteps: [
    {
      id: "messages-tabs-empty",
      target: "messages-tabs",
      title: "Message Tabs",
      description:
        "Switch between \"Global Messages\" (announcements shown to all users) and \"Sent Messages\" (individual messages sent to specific users). Global messages appear as notifications for everyone.",
      position: "bottom",
    },
    {
      id: "messages-global-empty",
      target: "messages-global-empty",
      title: "No Global Messages",
      description:
        "No global announcements have been created yet. Global messages are broadcast to all users and appear in their notification inbox. They can have an optional expiration date.",
      position: "bottom",
    },
    {
      id: "messages-create-global-empty",
      target: "messages-create-global",
      title: "Create Announcement",
      description:
        "Click here to create a new global message. You'll write a subject and body that will appear as a notification for all users on the platform.",
      position: "bottom",
    },
  ],
  steps: [
    {
      id: "messages-tabs",
      target: "messages-tabs",
      title: "Message Tabs",
      description:
        "Switch between \"Global Messages\" (announcements shown to all users) and \"Sent Messages\" (individual messages sent to specific users). Global messages appear as notifications for everyone.",
      position: "bottom",
    },
    {
      id: "messages-create-global",
      target: "messages-create-global",
      title: "Create Global Message",
      description:
        "Click to create a new global announcement. You'll write a subject and body, and optionally set an expiration date. Active global messages appear in every user's notification inbox.",
      position: "bottom",
    },
    {
      id: "messages-global-first",
      target: "messages-global-first",
      title: "Global Message",
      description:
        "Each card shows the message subject, status badge (Active, Inactive, or Expired), creation date, and optional expiration date. Active messages are currently visible to all users.",
      position: "bottom",
    },
    {
      id: "messages-global-actions",
      target: "messages-global-actions",
      title: "Message Actions",
      description:
        "\"Edit\" updates the message content or expiration. \"Deactivate\" hides the message from users without deleting it (can be reactivated later). \"Delete\" permanently removes the message.",
      position: "left",
    },
  ],
}

const partnerTour: TourDefinition = {
  id: "partner",
  name: "Partner Dashboard",
  description: "Learn how to manage your partner account",
  steps: [
    {
      id: "partner-header",
      target: "partner-header",
      title: "Partner Dashboard",
      description:
        "This is your partner dashboard showing an overview of your account. If you manage multiple partners, use the dropdown on the right to switch between them.",
      position: "bottom",
    },
    {
      id: "partner-stats",
      target: "partner-stats",
      title: "Account Stats",
      description:
        "See your partner account at a glance: total users under your partner account, total press releases created by those users, and how many have been sent for distribution.",
      position: "bottom",
    },
    {
      id: "partner-actions",
      target: "partner-actions",
      title: "Quick Actions",
      description:
        "Navigate to your partner sections. \"View Users\" shows all users under your partner account. \"View Press Releases\" lists all releases created by your users.",
      position: "top",
    },
  ],
}

const partnerReleasesTour: TourDefinition = {
  id: "partner-releases",
  name: "Partner Releases",
  description: "Learn how to view and track press releases from your partner users",
  emptyTarget: "partner-releases-empty",
  emptySteps: [
    {
      id: "partner-releases-header-empty",
      target: "partner-releases-header",
      title: "Partner Releases",
      description:
        "This page shows all press releases created by users under your partner account. If you manage multiple partners, use the dropdown to switch between them.",
      position: "bottom",
    },
    {
      id: "partner-releases-empty",
      target: "partner-releases-empty",
      title: "No Releases Yet",
      description:
        "No press releases have been created by your partner users yet. Releases will appear here once your users start creating them.",
      position: "bottom",
    },
  ],
  steps: [
    {
      id: "partner-releases-header",
      target: "partner-releases-header",
      title: "Partner Releases",
      description:
        "This page lists all press releases from users under your partner account. The subtitle shows the total count. Use the partner dropdown to switch between accounts if you manage more than one.",
      position: "bottom",
    },
    {
      id: "partner-releases-filters",
      target: "partner-releases-filters",
      title: "Filter Releases",
      description:
        "Filter by user to see a specific person's releases, or by status (Draft, In Review, Sent) to narrow down results.",
      position: "bottom",
    },
    {
      id: "partner-releases-table",
      target: "partner-releases-table",
      title: "Releases Table",
      description:
        "View each release's date, title, brand, submitting user, and status. Click a user's name to filter the table to just their releases.",
      position: "top",
    },
    {
      id: "partner-releases-first-row",
      target: "partner-releases-first-row",
      title: "Release Row",
      description:
        "Each row shows a press release. For sent releases, the \"Report\" button opens distribution analytics and \"Share\" opens a shareable report link in a new tab.",
      position: "bottom",
    },
  ],
}

const partnerUsersTour: TourDefinition = {
  id: "partner-users",
  name: "Partner Users",
  description: "Learn how to view and manage users under your partner account",
  emptyTarget: "partner-users-empty",
  emptySteps: [
    {
      id: "partner-users-header-empty",
      target: "partner-users-header",
      title: "Partner Users",
      description:
        "This page lists all users registered under your partner account. If you manage multiple partners, use the dropdown to switch between them.",
      position: "bottom",
    },
    {
      id: "partner-users-empty",
      target: "partner-users-empty",
      title: "No Users Yet",
      description:
        "No users have registered under this partner yet. Users will appear here once they sign up using your partner link or are added to your account.",
      position: "bottom",
    },
  ],
  steps: [
    {
      id: "partner-users-header",
      target: "partner-users-header",
      title: "Partner Users",
      description:
        "This page lists all users registered under your partner account. The subtitle shows the total user count. If you manage multiple partners, use the dropdown to switch between them.",
      position: "bottom",
    },
    {
      id: "partner-users-search",
      target: "partner-users-search",
      title: "Search Users",
      description:
        "Search by name or email to quickly find a specific user in your partner account.",
      position: "bottom",
    },
    {
      id: "partner-users-table",
      target: "partner-users-table",
      title: "Users Table",
      description:
        "View each user's name, email, join date, and total releases. Click the release count to jump directly to that user's press releases.",
      position: "top",
    },
    {
      id: "partner-users-first-row",
      target: "partner-users-first-row",
      title: "User Row",
      description:
        "Each row represents a registered user. The \"Releases\" column links to their press releases so you can review their activity.",
      position: "bottom",
    },
  ],
}

const profileTour: TourDefinition = {
  id: "profile",
  name: "Profile",
  description: "Learn how to manage your account settings and preferences",
  steps: [
    {
      id: "profile-actionbar",
      target: "profile-actionbar",
      title: "Account Settings",
      description:
        "This is your profile page where you can manage your personal information, subscription, password, and address. Changes are saved when you click \"Save Changes\".",
      position: "bottom",
    },
    {
      id: "profile-subscription",
      target: "profile-subscription",
      title: "Subscription & Credits",
      description:
        "View your available PR credits, Enhanced credits, and NewsDB credits. Click \"Buy More Credits\" to purchase additional credits for distributing press releases.",
      position: "bottom",
    },
    {
      id: "profile-info",
      target: "profile-info",
      title: "Profile Information",
      description:
        "Update your name, company, and contact details. Your email address is tied to your account and cannot be changed here.",
      position: "bottom",
    },
    {
      id: "profile-agency",
      target: "profile-agency",
      title: "Agency Features",
      description:
        "Toggle agency mode to enable advanced features like team logins, client pay, client reporting, and other multi-account capabilities.",
      position: "bottom",
    },
    {
      id: "profile-password",
      target: "profile-password",
      title: "Password",
      description:
        "Change your password or set one if you signed up with Google or LinkedIn. Passwords must be at least 8 characters long.",
      position: "bottom",
    },
    {
      id: "profile-address",
      target: "profile-address",
      title: "Address",
      description:
        "Keep your mailing address up to date. This information may be used for billing and account verification purposes.",
      position: "bottom",
    },
  ],
}

const adminTasksTour: TourDefinition = {
  id: "admin-tasks",
  name: "Task Board",
  description: "Learn how to manage tasks with the kanban board",
  steps: [
    {
      id: "tasks-topbar",
      target: "tasks-topbar",
      title: "Task Board",
      description:
        "This is your kanban-style task board. Create tasks, assign them to team members, and track progress by dragging cards between columns.",
      position: "bottom",
    },
    {
      id: "tasks-filter",
      target: "tasks-filter",
      title: "Filter Tasks",
      description:
        "Filter the board to show all tasks, only your tasks, or tasks assigned to a specific team member. Useful for focusing on your own workload.",
      position: "bottom",
    },
    {
      id: "tasks-stages",
      target: "tasks-stages",
      title: "Manage Stages",
      description:
        "Open the stage manager to add, rename, reorder, or color-code your kanban columns. Stages define the workflow for your tasks.",
      position: "bottom",
    },
    {
      id: "tasks-new",
      target: "tasks-new",
      title: "Create Task",
      description:
        "Click to create a new task. You can set a title, description, priority level, assign it to a team member, and attach files.",
      position: "bottom",
    },
    {
      id: "tasks-first-column",
      target: "tasks-first-column",
      title: "Stage Column",
      description:
        "Each column represents a stage in your workflow. Tasks are listed inside their current stage. The count badge shows how many tasks are in each column.",
      position: "right",
    },
    {
      id: "tasks-first-card",
      target: "tasks-first-card",
      title: "Task Card",
      description:
        "Each card shows the task title, priority, assignee, file count, and notes count. Click a card to edit it, or drag it to move it to a different stage.",
      position: "right",
    },
  ],
}

const adminMessagesSentTour: TourDefinition = {
  id: "admin-messages-sent",
  name: "Sent Messages",
  description: "Learn how to send and manage individual messages to users",
  emptyTarget: "messages-sent-empty",
  emptySteps: [
    {
      id: "messages-sent-tabs-empty",
      target: "messages-tabs",
      title: "Message Tabs",
      description:
        "You're viewing the \"Sent Messages\" tab. This shows individual messages sent to specific users. Switch to \"Global Messages\" to manage announcements broadcast to all users.",
      position: "bottom",
    },
    {
      id: "messages-sent-empty",
      target: "messages-sent-empty",
      title: "No Sent Messages",
      description:
        "No individual messages have been sent yet. Sent messages go directly to a specific user's inbox and can optionally trigger an email notification.",
      position: "bottom",
    },
    {
      id: "messages-send-empty",
      target: "messages-send",
      title: "Send a Message",
      description:
        "Click here to compose a new message to a specific user. You can choose the recipient, write a subject and body, and optionally send an email notification.",
      position: "bottom",
    },
  ],
  steps: [
    {
      id: "messages-sent-tabs",
      target: "messages-tabs",
      title: "Message Tabs",
      description:
        "You're viewing the \"Sent Messages\" tab. This shows individual messages sent to specific users. Switch to \"Global Messages\" to manage announcements broadcast to all users.",
      position: "bottom",
    },
    {
      id: "messages-send",
      target: "messages-send",
      title: "Send Message",
      description:
        "Click to compose a new message to a specific user. Select a recipient, write a subject and body, and optionally send an email notification along with the in-app message.",
      position: "bottom",
    },
    {
      id: "messages-sent-first",
      target: "messages-sent-first",
      title: "Sent Message",
      description:
        "Each card shows the message subject, recipient, send date, and status badges. \"Read\" or \"Unread\" indicates whether the recipient has seen the message. \"Email Sent\" shows if an email notification was also delivered.",
      position: "bottom",
    },
    {
      id: "messages-sent-actions",
      target: "messages-sent-actions",
      title: "Message Actions",
      description:
        "\"Edit\" lets you update an unread message before the recipient sees it. \"Delete\" permanently removes the message from the system.",
      position: "left",
    },
  ],
}

export const allTours: TourDefinition[] = [dashboardTour, adminTour, prTour, prCreateTour, draftsTour, reportsTour, brandsTour, brandAddTour, editorialQueueTour, enhancedQueueTour, pendingTour, releasedEditTour, adminUsersTour, adminBrandsTour, adminPartnersTour, adminProductsTour, adminCategoriesTour, adminEmailTemplatesTour, adminMessagesTour, adminMessagesSentTour, adminTasksTour, profileTour, partnerTour, partnerReleasesTour, partnerUsersTour]

export function getTourById(id: string): TourDefinition | undefined {
  return allTours.find((t) => t.id === id)
}
