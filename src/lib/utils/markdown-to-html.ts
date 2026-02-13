import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * Convert markdown to clean semantic HTML for clipboard operations.
 * Uses ReactMarkdown + remarkGfm (already installed) with renderToStaticMarkup.
 * Produces HTML with no Tailwind classes — just plain semantic elements
 * that paste cleanly into Substack, Google Docs, etc.
 */
export function markdownToHtml(markdown: string): string {
  const element = createElement(
    ReactMarkdown,
    { remarkPlugins: [remarkGfm] },
    markdown,
  );

  return renderToStaticMarkup(element);
}

/**
 * Copy content to clipboard as both rich text (HTML) and plain text (markdown).
 * Falls back to plain text only if ClipboardItem API is unavailable.
 */
export async function copyRichText(markdown: string): Promise<void> {
  // Try ClipboardItem API (supported in modern browsers)
  if (typeof ClipboardItem !== "undefined") {
    const html = markdownToHtml(markdown);
    const htmlBlob = new Blob([html], { type: "text/html" });
    const textBlob = new Blob([markdown], { type: "text/plain" });

    await navigator.clipboard.write([
      new ClipboardItem({
        "text/html": htmlBlob,
        "text/plain": textBlob,
      }),
    ]);
    return;
  }

  // Fallback: plain text only
  await navigator.clipboard.writeText(markdown);
}
