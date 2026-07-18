import Link from "next/link";
import { readSiteData } from "@/lib/site-data";

export const dynamic = "force-dynamic";

export default async function AssociationPage() {
  const data = await readSiteData();
  const boardMembers = data.association.organisation.boardMembers;
  const teachers = data.disciplines
    .filter((discipline) => discipline.active)
    .flatMap((discipline) => {
      const list =
        discipline.teachers.length > 0 ? discipline.teachers : [discipline.teacher || "Coach a definir"];
      return list.map((teacherName, idx) => ({
        id: `${discipline.id}-${idx}`,
        fullName: teacherName || "Coach a definir",
        disciplineName: discipline.name,
        slug: discipline.slug,
        email: discipline.contactEmail,
      }));
    });

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-8">
      <header className="panel mt-4 p-6 sm:p-8">
        <p className="text-sm font-semibold uppercase tracking-wide text-cyan-700">Association</p>
        <h1 className="mt-1 text-3xl font-bold text-slate-900">Organigramme</h1>
        <p className="mt-3 text-slate-700">{data.association.organisation.notes}</p>
      </header>

      <section className="panel mt-6 p-6 sm:p-8">
        <h2 className="panel-title">Bureau de l&apos;association</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {boardMembers.map((member) => (
            <article
              key={member.id}
              className="rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-cyan-50/40 p-5 shadow-sm"
            >
              <p className="text-xs font-semibold uppercase text-cyan-700">{member.role}</p>
              <h3 className="mt-2 text-xl font-semibold text-slate-900">{member.fullName}</h3>
              {/* Emails masqués tant que les adresses ne sont pas validées */}
              <a
                href={`mailto:${member.email}`}
                className="mt-3 hidden text-sm text-slate-700 hover:underline"
                aria-hidden
                tabIndex={-1}
              >
                {member.email}
              </a>
            </article>
          ))}
        </div>
      </section>

      <section className="panel mt-6 p-6 sm:p-8">
        <h2 className="panel-title">Equipe enseignante</h2>
        <p className="mt-2 max-w-2xl text-slate-600">
          Les enseignants sont renseignes dans chaque discipline. Contactez la discipline pour toute question
          pedagogique.
        </p>
        <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {teachers.map((teacher) => (
            <article
              key={teacher.id}
              className="rounded-2xl border border-cyan-100 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <p className="text-xs font-semibold uppercase text-cyan-700">{teacher.disciplineName}</p>
              <h3 className="mt-2 text-xl font-semibold text-slate-900">{teacher.fullName}</h3>
              <Link
                href={`/disciplines/${teacher.slug}`}
                className="mt-2 inline-block text-sm font-medium text-cyan-700 hover:underline"
              >
                Voir la discipline
              </Link>
              {/* Emails masqués tant que les adresses ne sont pas validées */}
              <a
                href={`mailto:${teacher.email}`}
                className="mt-3 hidden text-sm text-slate-700 hover:underline"
                aria-hidden
                tabIndex={-1}
              >
                {teacher.email}
              </a>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
