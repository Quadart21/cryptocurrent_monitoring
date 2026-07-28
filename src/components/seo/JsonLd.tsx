export function JsonLd({ data }: { data: object | object[] | null }) {
  if (!data) return null;
  const payload = Array.isArray(data) ? data : [data];
  const clean = payload.filter(Boolean);
  if (!clean.length) return null;
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(clean.length === 1 ? clean[0] : clean) }}
    />
  );
}
