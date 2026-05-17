import Link from "next/link";
import { Fragment, type ReactNode } from "react";

const MARKDOWN_LINK = /\[([^\]]+)\]\(([^)]+)\)/g;
const INTERNAL_PATH =
  /(?<![(\[])(\/(?:contact|preinscription|disciplines\/[a-z0-9-]+(?:\/essai)?))(?![\w/-])/gi;

const linkClassName = "font-semibold text-cyan-800 underline hover:text-cyan-950";

function renderHref(label: string, href: string, key: string): ReactNode {
  const trimmed = href.trim();
  if (trimmed.startsWith("/")) {
    return (
      <Link key={key} href={trimmed} className={linkClassName}>
        {label}
      </Link>
    );
  }
  if (/^https?:\/\//i.test(trimmed)) {
    return (
      <a key={key} href={trimmed} target="_blank" rel="noopener noreferrer" className={linkClassName}>
        {label}
      </a>
    );
  }
  return <Fragment key={key}>{label}</Fragment>;
}

function linkifyBarePaths(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  INTERNAL_PATH.lastIndex = 0;
  while ((match = INTERNAL_PATH.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }
    const path = match[1];
    const label = path === "/contact" ? "page contact" : path;
    nodes.push(renderHref(label, path, `${keyPrefix}-path-${match.index}`));
    lastIndex = INTERNAL_PATH.lastIndex;
  }
  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }
  return nodes.length > 0 ? nodes : [text];
}

export function renderChatMessageContent(content: string): ReactNode {
  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  MARKDOWN_LINK.lastIndex = 0;
  while ((match = MARKDOWN_LINK.exec(content)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(
        ...linkifyBarePaths(content.slice(lastIndex, match.index), `pre-${match.index}`),
      );
    }
    nodes.push(renderHref(match[1], match[2], `md-${match.index}`));
    lastIndex = MARKDOWN_LINK.lastIndex;
  }
  if (lastIndex < content.length) {
    nodes.push(...linkifyBarePaths(content.slice(lastIndex), `tail-${lastIndex}`));
  }
  if (nodes.length === 0) {
    return linkifyBarePaths(content, "full");
  }
  return <>{nodes}</>;
}
