const content_section = {
	name: "content_section",
	title: "Content Sections",
	type: "document",
	fields: [
		{
			name: "sectionName",
			title: "Section Name",
			type: "string",
			description:
				"Not a content element. For CMS display only. Be descriptive so that someone understands the page content.",
		},
		{
			name: "headline",
			title: "Headline",
			type: "string",
			options: { source: "title", maxLength: 96 },
		},
		{
			name: "slug",
			title: "Slug",
			type: "slug",
			options: { source: "sectionName", maxLength: 96 },
		},
		{
			name: "section_type",
			title: "Section Display Type",
			type: "array",
			description:
				"Required. You must choose one content type. Multiple content types are not allowed.",
			of: [{ type: "string" }],
			options: {
				list: [
					{ title: "Content Box (Left/Right Ladder)", value: "box" },
					{ title: "Callout Band", value: "band" },
					{ title: "Card Layout", value: "card" },
				],
				default: ["box"],
				maxLength: 1,
			},
			validation: (Rule: {
				min: (n: number) => any;
				max: (n: number) => any;
				required: () => any;
				error: (s: string) => any;
				warning: (s: string) => any;
			}) => [
				Rule.required().min(1).error("At least one item is required"),
				Rule.max(1).warning("Only one item is allowed"),
			],
		},
		{
			name: "centered_content",
			title: "Centered Content",
			type: "boolean",
			defaultValue: false,
			description:
				"Optional: Select this if content is required to be centered in its section?",
			hidden: ({ document }: { document?: { section_type?: string[] } }) =>
				document?.section_type?.[0] !== "band",
		},
		{
			name: "content",
			title: "Content",
			type: "array",
			of: [{ type: "block" }],
		},
		{
			name: "sectionImage",
			title: "Section Image",
			type: "image",
			options: { hotspot: true },
			fields: [
				{
					name: "alt",
					title: "Alternative Text",
					type: "string",
				},
				{ name: "credit", title: "Image Credits", type: "string" },
				{
					name: "image_type",
					title: "Image Display Type",
					type: "array",
					description:
						"Required. You must choose one image type. Multiple image types are not allowed.",
					of: [{ type: "string" }],
					options: {
						list: [
							{ title: "Rectangle", value: "rectangle" },
							{ title: "Circle", value: "circle" },
						],
						default: ["rectangle"],
						maxLength: 1,
					},
					validation: (Rule: {
						min: (n: number) => any;
						max: (n: number) => any;
						required: () => any;
						error: (s: string) => any;
						warning: (s: string) => any;
					}) => [
						Rule.required().min(1).error("At least one item is required"),
						Rule.max(1).warning("Only one item is allowed"),
					],
				},
			],
		},
		{
			name: "sectionCta",
			title: "Section CTA",
			type: "object",
			fields: [
				{
					name: "ctaLabel",
					title: "CTA Label",
					type: "string",
				},
				{
					name: "ctaUrl",
					title: "CTA Url",
					type: "string",
				},
			],
		},
		{
			name: "background_color",
			title: "Background Color",
			type: "string",
		},
	],
	preview: {
		select: {
			title: "sectionName",
			media: "sectionImage",
			sectionType: "section_type",
		},
		prepare(selection: Record<string, any>) {
			const { title, sectionType, media } = selection;
			return {
				title: title,
				media: media,
				subtitle:
					sectionType && sectionType.length > 0
						? sectionType[0].toLocaleUpperCase()
						: "No section type",
			};
		},
	},
};

export default content_section;
