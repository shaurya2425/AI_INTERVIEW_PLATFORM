
"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { Copy, Check } from "lucide-react";
import "katex/dist/katex.min.css";

function CodeView({ code, language = "text" }) {
  const [copied, setCopied] = useState(false);

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);

      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard permission may be unavailable.
    }
  }

  return (
    <div className="my-3 w-full min-w-0 overflow-hidden rounded-xl border border-border">
      <div className="flex items-center justify-between bg-zinc-800 px-3 py-2 text-zinc-200">
        <span className="text-xs font-medium">
          {language.toUpperCase()}
        </span>

        <button
          type="button"
          onClick={copyCode}
          className="flex items-center gap-1.5 text-xs hover:text-white"
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>

      <div className="w-full overflow-x-auto">
        <SyntaxHighlighter
          language={language}
          style={oneDark}
          PreTag="div"
          wrapLongLines={false}
          customStyle={{
            margin: 0,
            padding: 14,
            background: "#18181b",
            borderRadius: 0,
            fontSize: 13,
            lineHeight: 1.65,
          }}
        >
          {code}
        </SyntaxHighlighter>
      </div>
    </div>
  );
}

export default function AIResponse({ content = "" }) {
  return (
    <div className="min-w-0 max-w-full break-words text-sm leading-6 text-foreground">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          h1: ({ children }) => (
            <h1 className="mb-3 mt-4 text-lg font-semibold">
              {children}
            </h1>
          ),

          h2: ({ children }) => (
            <h2 className="mb-2 mt-4 text-base font-semibold">
              {children}
            </h2>
          ),

          h3: ({ children }) => (
            <h3 className="mb-2 mt-3 text-sm font-semibold">
              {children}
            </h3>
          ),

          p: ({ children }) => (
            <p className="mb-2 last:mb-0">
              {children}
            </p>
          ),

          strong: ({ children }) => (
            <strong className="font-semibold">
              {children}
            </strong>
          ),

          ul: ({ children }) => (
            <ul className="mb-3 list-disc space-y-1 pl-5">
              {children}
            </ul>
          ),

          ol: ({ children }) => (
            <ol className="mb-3 list-decimal space-y-1 pl-5">
              {children}
            </ol>
          ),

          blockquote: ({ children }) => (
            <blockquote className="my-3 border-l-2 border-amber-400 pl-3 text-muted-foreground">
              {children}
            </blockquote>
          ),

          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand underline underline-offset-2"
            >
              {children}
            </a>
          ),

          table: ({ children }) => (
            <div className="my-3 max-w-full overflow-x-auto rounded-lg border border-border">
              <table className="w-full min-w-max border-collapse text-left text-sm">
                {children}
              </table>
            </div>
          ),

          th: ({ children }) => (
            <th className="border-b border-border bg-muted px-3 py-2 font-semibold">
              {children}
            </th>
          ),

          td: ({ children }) => (
            <td className="border-b border-border px-3 py-2 align-top">
              {children}
            </td>
          ),

          pre: ({ children }) => {
            const node = Array.isArray(children)
              ? children[0]
              : children;

            const className = node?.props?.className || "";
            const language =
              /language-([\w+#-]+)/.exec(className)?.[1] ||
              "text";

            const code = String(
              node?.props?.children || ""
            ).replace(/\n$/, "");

            return (
              <CodeView
                code={code}
                language={language}
              />
            );
          },

          code: ({ className, children }) => (
            <code
              className={`${className || ""} rounded bg-muted px-1 py-0.5 font-mono text-[13px]`}
            >
              {children}
            </code>
          ),
        }}
      >
        {String(content)}
      </ReactMarkdown>
    </div>
  );
}
