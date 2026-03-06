const faq_section = {
	name: "faq_section",
	title: "FAQ Sections",
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
			title: "Sort Order",
			name: "sort_order",
			by: [{ field: "sort", direction: "asc" }],
			type: "number",
		},
		{
			name: "slug",
			title: "Slug",
			type: "slug",
			options: { source: "sectionName", maxLength: 96 },
		},
		{
			name: "question",
			title: "Question",
			type: "string",
			options: { source: "title", maxLength: 96 },
		},
		{
			name: "answer",
			title: "Answer",
			type: "array",
			of: [
				{
					type: "block",
				},
			],
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

export default faq_section;
