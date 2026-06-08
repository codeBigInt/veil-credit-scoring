import Link from "next/link";

export interface PageLink {
  title: string;
  href: string;
  description?: string;
}

interface PrevNextProps {
  prev?: PageLink;
  next?: PageLink;
}

export default function PrevNext({ prev, next }: PrevNextProps) {
  return (
    <div className="prev-next">
      {prev ? (
        <Link href={prev.href} className="prev-next-card">
          <span className="prev-next-dir">← Previous</span>
          <span className="prev-next-title">{prev.title}</span>
          {prev.description && (
            <span className="prev-next-desc">{prev.description}</span>
          )}
        </Link>
      ) : (
        <div />
      )}
      {next ? (
        <Link href={next.href} className="prev-next-card next">
          <span className="prev-next-dir">Next →</span>
          <span className="prev-next-title">{next.title}</span>
          {next.description && (
            <span className="prev-next-desc">{next.description}</span>
          )}
        </Link>
      ) : (
        <div />
      )}
    </div>
  );
}
