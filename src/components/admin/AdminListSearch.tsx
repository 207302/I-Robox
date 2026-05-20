import Link from "next/link";

type AdminListSearchProps = {
  pathname: string;
  defaultValue?: string;
  placeholder?: string;
};

export function AdminListSearch({
  pathname,
  defaultValue = "",
  placeholder = "Search by name or SKU…",
}: AdminListSearchProps) {
  const q = defaultValue.trim();

  return (
    <div className="mx-auto flex w-full max-w-md items-center gap-2">
      <form method="get" action={pathname} className="min-w-0 flex-1">
        <input
          type="search"
          name="q"
          defaultValue={defaultValue}
          placeholder={placeholder}
          aria-label="Search"
          className="w-full rounded-lg border border-gray-3 bg-white px-3 py-2 text-sm text-dark outline-none focus:border-blue"
        />
      </form>
      {q ? (
        <Link href={pathname} className="shrink-0 text-sm font-medium text-meta-3 hover:text-blue">
          Clear
        </Link>
      ) : null}
    </div>
  );
}
