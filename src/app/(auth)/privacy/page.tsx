export const metadata = { title: "Privacy — Mercury" };

export default function PrivacyPage() {
  return (
    <article className="prose-mercury flex flex-col gap-4 text-sm leading-relaxed text-text-2">
      <h1 className="text-lg font-semibold text-text">Privacy Policy</h1>
      <p className="text-xs text-dim">Last updated: {new Date().getFullYear()}</p>

      <p>
        Mercury is a hiring workspace for employers. When an employer forwards applicant emails to
        their private Mercury address, Mercury processes that applicant data <strong>on behalf of
        the employer</strong>. In data-protection terms, the employer is the <em>controller</em> and
        Mercury is the <em>processor</em>.
      </p>

      <h2 className="text-sm font-semibold text-text">What we store</h2>
      <p>
        The original forwarded email and any CV attachment (in private storage), and the facts
        parsed from the CV (years of experience, skills mentioned, current/recent role, location).
        We store only what is needed to run the hiring board.
      </p>

      <h2 className="text-sm font-semibold text-text">Retention &amp; deletion</h2>
      <p>
        An employer can delete a role at any time; doing so deletes that role&apos;s applicants, their
        stored emails and CV files, and the response history. Applicants may request access to, or
        deletion of, their data — contact the employer who is hiring, or email us and we will route
        the request to the relevant controller.
      </p>

      <h2 className="text-sm font-semibold text-text">No automated rejection</h2>
      <p>
        Mercury never automatically scores, ranks-as-judgement, or rejects an applicant. A human
        makes every decision; every applicant remains visible on the board.
      </p>

      <h2 className="text-sm font-semibold text-text">HK PDPO &amp; GDPR</h2>
      <p>
        We apply data minimization, purpose limitation, and retention limits. For applicants with an
        EU link, employers remain responsible for their GDPR obligations as controller; Mercury
        supports them as processor.
      </p>
    </article>
  );
}
