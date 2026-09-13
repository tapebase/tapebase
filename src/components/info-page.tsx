export function InfoPage({ eyebrow = "TAPEBASE", title, intro, children }: {
  eyebrow?: string;
  title: string;
  intro: string;
  children: React.ReactNode;
}) {
  return <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-12">
    <article className="rounded-3xl bg-white p-6 shadow-sm sm:p-10">
      <p className="text-sm font-bold uppercase tracking-widest text-zinc-500">{eyebrow}</p>
      <h1 className="mt-2 text-4xl font-black sm:text-5xl">{title}</h1>
      <p className="mt-5 max-w-3xl text-lg leading-8 text-zinc-600">{intro}</p>
      <div className="mt-10 space-y-8 leading-7 text-zinc-700">{children}</div>
    </article>
  </main>;
}
