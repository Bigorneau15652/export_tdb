// Draws the nodes of the Markdown reader (markdown.js) with createElement and textContent. No HTML
// text is ever made, and a link is drawn only when its address is a safe https address.
(function () {
  const { safeUrl } = window.exportTdbMarkdown;

  // Appends the inline nodes to a parent element.
  function drawInline(parent, nodes) {
    for (const node of nodes) {
      if (node.type === `text`) {
        parent.appendChild(document.createTextNode(node.value));
      } else if (node.type === `break`) {
        parent.appendChild(document.createElement(`br`));
      } else if (node.type === `strong` || node.type === `em`) {
        const element = document.createElement(node.type);
        drawInline(element, node.children);
        parent.appendChild(element);
      } else if (node.type === `link`) {
        const href = safeUrl(node.href);
        const element = document.createElement(href ? `a` : `span`);
        if (href) {
          element.href = href;
          element.target = `_blank`;
          element.rel = `noopener noreferrer`;
        }
        drawInline(element, node.children);
        parent.appendChild(element);
      }
    }
  }

  // The elements for a list of blocks (headings, paragraphs, lists), as a document fragment.
  function build(blocks) {
    const fragment = document.createDocumentFragment();
    for (const block of blocks) {
      if (block.type === `heading`) {
        const element = document.createElement(`h${block.level}`);
        drawInline(element, block.children);
        fragment.appendChild(element);
      } else if (block.type === `paragraph`) {
        const element = document.createElement(`p`);
        drawInline(element, block.children);
        fragment.appendChild(element);
      } else if (block.type === `list`) {
        const element = document.createElement(block.ordered ? `ol` : `ul`);
        for (const item of block.items) {
          const row = document.createElement(`li`);
          drawInline(row, item);
          element.appendChild(row);
        }
        fragment.appendChild(element);
      }
    }
    return fragment;
  }

  window.exportTdbMarkdownView = { build };
})();
