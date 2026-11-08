type PlaceholderPageProps = { title: string };

export function PlaceholderPage({ title }: PlaceholderPageProps) {
  return (
    <section className="page-card">
      <p className="eyebrow">Phase 1 foundation</p>
      <h1>{title}</h1>
      <p>This workflow will be added in a later implementation phase.</p>
    </section>
  );
}
