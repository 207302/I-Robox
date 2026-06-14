type JsonLdScriptProps = {
  id?: string;
  data: Record<string, unknown> | Record<string, unknown>[];
};

/** Server-safe JSON-LD injector — no third-party schema library. */
export function JsonLdScript({ id, data }: JsonLdScriptProps) {
  return (
    <script
      id={id}
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, "\\u003c"),
      }}
    />
  );
}
