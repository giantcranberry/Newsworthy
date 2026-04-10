/**
 * TinyMCE Schema.org Plugin
 *
 * Adds a toolbar button that opens a dialog to set Schema.org microdata
 * and RDFa attributes (itemprop, itemtype, itemscope, rel) on the
 * currently selected link or any element.
 *
 * Usage: Add 'schemaAttrs' to the toolbar string and call
 * `setupSchemaPlugin(editor)` inside the `setup` callback.
 */

// Only values users would set manually on inline elements/links.
// Excludes properties handled automatically by JSON-LD (headline, articleBody,
// datePublished, publisher, author, image, logo, aggregateRating, ratingValue, review).
const ITEMPROP_OPTIONS = [
  { text: '(none)', value: '' },
  { text: 'name', value: 'name' },
  { text: 'url', value: 'url' },
  { text: 'description', value: 'description' },
  { text: 'sameAs', value: 'sameAs' },
  { text: 'telephone', value: 'telephone' },
  { text: 'email', value: 'email' },
  { text: 'address', value: 'address' },
  { text: 'jobTitle', value: 'jobTitle' },
  { text: 'brand', value: 'brand' },
];

// Excludes types handled automatically by JSON-LD (Article, NewsArticle,
// AggregateRating, Review).
const ITEMTYPE_OPTIONS = [
  { text: '(none)', value: '' },
  { text: 'Organization', value: 'https://schema.org/Organization' },
  { text: 'Person', value: 'https://schema.org/Person' },
  { text: 'Product', value: 'https://schema.org/Product' },
  { text: 'WebPage', value: 'https://schema.org/WebPage' },
  { text: 'Event', value: 'https://schema.org/Event' },
  { text: 'CreativeWork', value: 'https://schema.org/CreativeWork' },
  { text: 'Brand', value: 'https://schema.org/Brand' },
  { text: 'Place', value: 'https://schema.org/Place' },
];

const REL_OPTIONS = [
  { text: '(none)', value: '' },
  { text: 'nofollow', value: 'nofollow' },
  { text: 'sponsored', value: 'sponsored' },
  { text: 'ugc', value: 'ugc' },
  { text: 'nofollow sponsored', value: 'nofollow sponsored' },
  { text: 'noopener', value: 'noopener' },
  { text: 'noreferrer', value: 'noreferrer' },
];

function getClosestElement(editor: any): HTMLElement | null {
  const node = editor.selection.getNode();
  if (!node) return null;
  // If it's a link, use it; otherwise find the closest parent element
  if (node.nodeName === 'A') return node;
  const anchor = node.closest?.('a');
  if (anchor) return anchor;
  // Fall back to the selected element itself (div, span, etc.)
  return node.nodeType === 1 ? node : null;
}

export function setupSchemaPlugin(editor: any) {
  editor.ui.registry.addButton('schemaAttrs', {
    text: 'Schema',
    tooltip: 'Set Schema.org attributes on selected element',
    onAction: () => {
      const el = getClosestElement(editor);

      const currentItemprop = el?.getAttribute('itemprop') || '';
      const currentItemtype = el?.getAttribute('itemtype') || '';
      const currentItemscope = el?.hasAttribute('itemscope') || false;
      const currentRel = el?.getAttribute('rel') || '';
      const currentCustomItemprop = ITEMPROP_OPTIONS.some(o => o.value === currentItemprop) ? '' : currentItemprop;
      const currentCustomItemtype = ITEMTYPE_OPTIONS.some(o => o.value === currentItemtype) ? '' : currentItemtype;

      editor.windowManager.open({
        title: 'Schema.org Attributes',
        body: {
          type: 'panel',
          items: [
            {
              type: 'htmlpanel',
              html: `<p style="margin:0 0 8px;color:#666;font-size:12px;">Set Schema.org microdata attributes on the selected ${el?.nodeName === 'A' ? 'link' : 'element'}${el ? ` (<code>${el.nodeName.toLowerCase()}</code>)` : ''}. Select from common values or type a custom one.</p>`,
            },
            {
              type: 'selectbox',
              name: 'itemprop',
              label: 'itemprop',
              items: ITEMPROP_OPTIONS,
            },
            {
              type: 'input',
              name: 'itemprop_custom',
              label: 'itemprop (custom — overrides above if set)',
            },
            {
              type: 'selectbox',
              name: 'itemtype',
              label: 'itemtype',
              items: ITEMTYPE_OPTIONS,
            },
            {
              type: 'input',
              name: 'itemtype_custom',
              label: 'itemtype (custom URL — overrides above if set)',
            },
            {
              type: 'checkbox',
              name: 'itemscope',
              label: 'itemscope',
            },
            {
              type: 'selectbox',
              name: 'rel',
              label: 'rel',
              items: REL_OPTIONS,
            },
          ],
        },
        initialData: {
          itemprop: ITEMPROP_OPTIONS.some(o => o.value === currentItemprop) ? currentItemprop : '',
          itemprop_custom: currentCustomItemprop,
          itemtype: ITEMTYPE_OPTIONS.some(o => o.value === currentItemtype) ? currentItemtype : '',
          itemtype_custom: currentCustomItemtype,
          itemscope: currentItemscope,
          rel: REL_OPTIONS.some(o => o.value === currentRel) ? currentRel : '',
        },
        buttons: [
          { type: 'cancel', text: 'Cancel' },
          { type: 'submit', text: 'Apply', buttonType: 'primary' },
        ],
        onSubmit: (api: any) => {
          const data = api.getData();
          if (!el) {
            api.close();
            return;
          }

          const itemprop = data.itemprop_custom || data.itemprop;
          const itemtype = data.itemtype_custom || data.itemtype;

          if (itemprop) {
            el.setAttribute('itemprop', itemprop);
          } else {
            el.removeAttribute('itemprop');
          }

          if (itemtype) {
            el.setAttribute('itemtype', itemtype);
          } else {
            el.removeAttribute('itemtype');
          }

          if (data.itemscope) {
            el.setAttribute('itemscope', '');
          } else {
            el.removeAttribute('itemscope');
          }

          if (data.rel) {
            el.setAttribute('rel', data.rel);
          } else {
            el.removeAttribute('rel');
          }

          editor.undoManager.add();
          api.close();
        },
      });
    },
  });
}
