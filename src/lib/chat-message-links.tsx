import Link from "next/link";
import { Fragment, type ReactNode } from "react";

const MARKDOWN_LINK = /\[([^\]]+)\]\(([^)]+)\)/g;
const INLINE_LINK =
  /(?<![(\[])((?:https?:\/\/|mailto:)[^\s<>[\]()]+|\/(?:contact|preinscription|disciplines\/[a-z0-9-]+(?:\/essai)?))(?![\w/-])/gi;

const linkClassName = "font-semibold text-cyan-800 underline hover:text-cyan-950 break-all";

function renderHref(label: string, href: string, key: string): ReactNode {
  const trimmed = href.trim();
  if (trimmed.startsWith("/")) {
    return (
      <Link key={key} href={trimmed} className={linkClassName}>
        {label}
      </Link>
    );
  }
  if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith("mailto:")) {
    return (
      <a key={key} href={trimmed} target="_blank" rel="noopener noreferrer" className={linkClassName}>
        {label}
      </a>
    );
  }
  return <Fragment key={key}>{label}</Fragment>;
}

function linkLabelForMatch(match: string): string {
  if (match.startsWith("/")) {
    return match === "/contact" ? "page contact" : match;
  }
  return match;
}

function linkifyInlineText(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  INLINE_LINK.lastIndex = 0;
  while ((match = INLINE_LINK.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }
    const href = match[1];
    nodes.push(renderHref(linkLabelForMatch(href), href, `${keyPrefix}-inline-${match.index}`));
    lastIndex = INLINE_LINK.lastIndex;
  }
  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }
  return nodes.length > 0 ? nodes : [text];
}

export function renderRichTextContent(content: string): ReactNode {
  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  MARKDOWN_LINK.lastIndex = 0;
  while ((match = MARKDOWN_LINK.exec(content)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(...linkifyInlineText(content.slice(lastIndex, match.index), `pre-${match.index}`));
    }
    nodes.push(renderHref(match[1], match[2], `md-${match.index}`));
    lastIndex = MARKDOWN_LINK.lastIndex;
  }
  if (lastIndex < content.length) {
    nodes.push(...linkifyInlineText(content.slice(lastIndex), `tail-${lastIndex}`));
  }
  if (nodes.length === 0) {
    return linkifyInlineText(content, "full");
  }
  return <>{nodes}</>;
}

export function RichTextContent({
  content,
  className = "",
}: {
  content: string;
  className?: string;
}) {
  return (
    <div className={`text-break whitespace-pre-wrap ${className}`.trim()}>{renderRichTextContent(content)}</div>
  );
}

/** @deprecated Use renderRichTextContent */
export const renderChatMessageContent = renderRichTextContent;
