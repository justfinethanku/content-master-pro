"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface PostMarkdownProps {
  content: string;
  className?: string;
}

export function PostMarkdown({ content, className = "" }: PostMarkdownProps) {
  return (
    <div
      className={`prose prose-sm dark:prose-invert max-w-none
        prose-headings:text-foreground
        prose-p:text-foreground prose-p:leading-relaxed
        prose-strong:text-foreground
        prose-em:text-foreground
        prose-a:text-primary prose-a:underline prose-a:underline-offset-2 hover:prose-a:text-primary/80
        prose-blockquote:border-l-primary/50 prose-blockquote:text-muted-foreground prose-blockquote:not-italic
        prose-code:bg-muted prose-code:text-foreground prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-xs prose-code:font-mono prose-code:before:content-none prose-code:after:content-none
        prose-pre:bg-muted prose-pre:border prose-pre:border-border prose-pre:rounded-lg
        prose-table:border-collapse prose-th:border prose-th:border-border prose-th:bg-muted prose-th:p-2 prose-th:text-left prose-th:text-foreground prose-td:border prose-td:border-border prose-td:p-2
        prose-li:text-foreground prose-li:marker:text-muted-foreground
        prose-hr:border-border
        prose-img:rounded-lg
        ${className}`}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  );
}
