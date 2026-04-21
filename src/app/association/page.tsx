import { readSiteData } from "@/lib/site-data";

export const dynamic = "force-dynamic";

export default async function AssociationPage() {
  const data = await readSiteData();
  const boardMembers = data.association.organisation.boardMembers;

  const teachers = data.disciplines
    .filter((discipline) => discipline.active)
    .map((discipline) => ({
      id: discipline.id,
      fullName: discipline.teacher || "Coach a definir",
      disciplineName: discipline.name,
      email: discipline.contactEmail,
    }));

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-8">
      <header className="panel mt-4 p-6 sm:p-8">
        <h1 className="text-3xl font-bold text-slate-900">Organigramme de l&apos;association</h1>
        <p className="mt-2 text-slate-700">{data.association.organisation.notes}</p>
      </header>

      <section className="panel mt-6 p-6 sm:p-8">
        <h2 className="panel-title">Bureau</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {boardMembers.map((member) => (
            <article key={member.id} className="rounded-2xl border border-slate-200 bg-white/90 p-4">
              <p className="text-xs font-semibold uppercase text-cyan-700">{member.role}</p>
              <h3 className="mt-1 text-xl font-semibold text-slate-900">{member.fullName}</h3>
              <a href={`mailto:${member.email}`} className="mt-2 inline-block text-sm text-slate-700 hover:underline">
                {member.email}
              </a>
            </article>
          ))}
        </div>
      </section>

      <section className="panel mt-6 p-6 sm:p-8">
        <h2 className="panel-title">Equipe enseignante (auto depuis disciplines)</h2>
        <p className="mt-2 text-slate-600">
          Cette liste est dynamique: chaque discipline active ajoute automatiquement son enseignant ici.
        </p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {teachers.map((teacher) => (
            <article key={teacher.id} className="rounded-2xl border border-cyan-100 bg-cyan-50/60 p-4">
              <p className="text-xs font-semibold uppercase text-cyan-700">{teacher.disciplineName}</p>
              <h3 className="mt-1 text-xl font-semibold text-slate-900">{teacher.fullName}</h3>
              <a href={`mailto:${teacher.email}`} className="mt-2 inline-block text-sm text-slate-700 hover:underline">
                {teacher.email}
              </a>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
