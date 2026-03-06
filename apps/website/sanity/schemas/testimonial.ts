const testimonial = {
    name: 'testimonial',
    title: 'Testimonials',
    type: 'document',
    fields: [
        {
            name: 'person',
            title: 'Person',
            type: 'string',
        },
        {
            name: 'quote',
            title: 'Quote',
            type: 'string',
        },
        {
            name: 'image',
            title: 'Image',
            type: 'image',
            options: { hotspot: true },
            fields: [
                {
                    name: 'alt',
                    title: 'Alternative Text',
                    type: 'string',
                }
        ]
        }

    ]
};

export default testimonial;
