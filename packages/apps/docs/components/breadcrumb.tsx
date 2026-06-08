import Link from "next/link";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
}

export default function Breadcrumb({ items }: BreadcrumbProps) {
  return (
    <nav aria-label="Breadcrumb" className="breadcrumb">
      <Link href="/" className="breadcrumb-item">
        Docs
      </Link>
      {items.map((item, i) => (
        <span key={i} style={{ display: "contents" }}>
          <span className="breadcrumb-sep" aria-hidden="true">
            /
          </span>
          {item.href ? (
            <Link href={item.href} className="breadcrumb-item">
              {item.label}
            </Link>
          ) : (
            <span className="breadcrumb-item current" aria-current="page">
              {item.label}
            </span>
          )}
        </span>
      ))}
    </nav>
  );
}
