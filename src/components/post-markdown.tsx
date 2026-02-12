"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export default function PostMarkdown({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        h1: ({ children }) => (
          <h1 className="text-2xl font-bold text-foreground mt-8 mb-3 first:mt-0">
            {children}
          </h1>
        ),
        h2: ({ children }) => (
          <h2 className="text-lg font-semibold text-foreground mt-6 mb-2 first:mt-0">
            {children}
          </h2>
        ),
        h3: ({ children }) => (
          <h3 className="text-base font-semibold text-foreground mt-5 mb-1.5 first:mt-0">
            {children}
          </h3>
        ),
        p: ({ children }) => (
          <p className="text-base text-muted-foreground leading-relaxed mb-4 last:mb-0">
            {children}
          </p>
        ),
        strong: ({ children }) => (
          <strong className="font-semibold text-foreground">{children}</strong>
        ),
        em: ({ children }) => (
          <em className="text-muted-foreground">{children}</em>
        ),
        ul: ({ children }) => (
          <ul className="space-y-1.5 mb-4 last:mb-0">{children}</ul>
        ),
        ol: ({ children }) => (
          <ol className="space-y-1.5 mb-4 list-decimal list-inside last:mb-0">
            {children}
          </ol>
        ),
        li: ({ children }) => (
          <li className="text-sm text-muted-foreground leading-relaxed pl-4 border-l-2 border-primary/30">
            {children}
          </li>
        ),
        hr: () => <hr className="border-border my-5" />,
        blockquote: ({ children }) => (
          <blockquote className="border-l-3 border-primary/40 pl-4 italic text-muted-foreground my-4">
            {children}
          </blockquote>
        ),
        a: ({ href, children }) => (
          <a
            href={href}
            className="text-primary underline underline-offset-2 hover:text-primary/80 transition"
            target="_blank"
            rel="noopener noreferrer"
          >
            {children}
          </a>
        ),
        code: ({ children, className }) => {
          const isBlock = className?.includes("language-");
          if (isBlock) {
            return <code className="text-sm font-mono">{children}</code>;
          }
          return (
            <code className="bg-muted text-foreground px-1.5 py-0.5 rounded text-sm font-mono">
              {children}
            </code>
          );
        },
        pre: ({ children }) => (
          <pre className="bg-muted border border-border rounded-lg p-4 overflow-x-auto mb-4 last:mb-0">
            {children}
          </pre>
        ),
        table: ({ children }) => (
          <div className="overflow-x-auto mb-4 last:mb-0">
            <table className="w-full border-collapse border border-border text-sm">
              {children}
            </table>
          </div>
        ),
        th: ({ children }) => (
          <th className="border border-border bg-muted p-2 text-left font-semibold text-foreground">
            {children}
          </th>
        ),
        td: ({ children }) => (
          <td className="border border-border p-2 text-muted-foreground">
            {children}
          </td>
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
