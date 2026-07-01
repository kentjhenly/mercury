export const metadata = { title: "Terms — Mercury" };

export default function TermsPage() {
  return (
    <article className="flex flex-col gap-4 text-sm leading-relaxed text-text-2">
      <h1 className="text-lg font-semibold text-text">Terms &amp; Data Processing</h1>
      <p className="text-xs text-dim">Last updated: {new Date().getFullYear()}</p>

      <p>
        By creating a Mercury workspace you agree to these terms. Mercury provides a tool to organize
        applicant emails into a hiring board. You, the employer, are responsible for the lawful basis
        on which you collect and process applicant data.
      </p>

      <h2 className="text-sm font-semibold text-text">Processor relationship</h2>
      <p>
        You are the data controller for applicant data forwarded into Mercury. Mercury acts as your
        processor: we process applicant data only to provide the service, on your instructions, and
        we do not sell it or use it to train models that judge or rank candidates.
      </p>

      <h2 className="text-sm font-semibold text-text">Acceptable use</h2>
      <p>
        Forward only applications you are entitled to process. Do not use Mercury to make solely
        automated decisions about people — Mercury is built to keep a human in every decision.
      </p>

      <h2 className="text-sm font-semibold text-text">Deletion</h2>
      <p>
        You can delete a role and all of its applicant data at any time. Deleting your account
        removes your workspace and associated data.
      </p>

      <h2 className="text-sm font-semibold text-text">No warranty</h2>
      <p>
        Mercury is provided &quot;as is&quot; during this early phase. CV parsing is best-effort; always
        check the original CV, which Mercury always keeps attached to the card.
      </p>
    </article>
  );
}
