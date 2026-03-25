/**
 * Custom MDX component overrides for blog posts.
 *
 * Code blocks (``` ... ```) are re-styled as TCG card-text boxes so that
 * card effect text in articles renders as a proper UI element rather than
 * a monospace code block.
 */

type PreProps = React.ComponentPropsWithoutRef<"pre"> & {
  children?: React.ReactNode;
};

function CardTextBlock({ children }: PreProps) {
  // Extract the raw text from the <code> child if present
  let text = "";
  if (
    children &&
    typeof children === "object" &&
    "props" in (children as React.ReactElement)
  ) {
    const codeEl = children as React.ReactElement<{ children?: React.ReactNode }>;
    text = typeof codeEl.props.children === "string" ? codeEl.props.children : "";
  }

  const lines = text.trim().split("\n").filter(Boolean);

  return (
    <div className="not-prose my-5 border border-[var(--border)] bg-[var(--muted)] px-5 py-4 rounded-none font-mono text-sm leading-relaxed text-[var(--foreground)]">
      {lines.map((line, i) => (
        <p key={i} className="m-0 last:mb-0 mb-1">
          {line}
        </p>
      ))}
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const mdxComponents: Record<string, React.ComponentType<any>> = {
  pre: CardTextBlock,
};
