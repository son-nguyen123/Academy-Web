import Link from "next/link";
import { submitRegistrationAction } from "./actions";

const programOptions = [
  { value: "kids", label: "Kids English" },
  { value: "teens", label: "Teens English" },
  { value: "ielts", label: "IELTS Preparation" },
  { value: "testprep", label: "TOEIC / Test Preparation" },
  { value: "communication", label: "English Communication" },
  { value: "corporate", label: "Corporate English" },
  { value: "public-speaking", label: "Public Speaking" },
  { value: "study-abroad", label: "Study Abroad Consultation" },
  { value: "addc", label: "Academy Debate & Debate Club" },
];

const intentCopy: Record<string, { title: string; description: string }> = {
  "placement-test": {
    title: "Placement Test Registration",
    description: "Leave your details and our team will contact you to arrange a suitable placement test.",
  },
  "study-abroad": {
    title: "Study Abroad Consultation",
    description: "Tell us which program interests you and our study abroad team will contact you.",
  },
  registration: {
    title: "Program Registration",
    description: "Your selected program is carried into this form so our team can advise you faster.",
  },
  consultation: {
    title: "Program Consultation",
    description: "Leave your details and our academic team will help you choose the right program.",
  },
};

export default async function ContactPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const intent = typeof params.intent === "string" ? params.intent : "consultation";
  const selectedProgram = typeof params.program === "string" ? params.program : "";
  const submitted = params.submitted === "1";
  const hasError = params.error === "missing-fields";
  const copy = intentCopy[intent] || intentCopy.consultation;

  return (
    <div className="container" style={{ padding: "80px 24px" }}>
      <h1 style={{ fontSize: "var(--text-4xl)", marginBottom: "24px" }}>Contact & Registration</h1>
      <p style={{ fontSize: "var(--text-lg)", color: "var(--text-muted)", marginBottom: "48px" }}>
        Get in touch with us, request program advice, or register for a placement test.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "64px" }}>
        <div>
          <h2 style={{ fontSize: "var(--text-2xl)", marginBottom: "24px" }}>Contact Information</h2>
          <div style={{ marginBottom: "16px" }}><strong>Address:</strong><br />98 Le Dinh Ly St, Da Nang</div>
          <div style={{ marginBottom: "16px" }}><strong>Phone:</strong><br />(0236) 123 4567</div>
          <div style={{ marginBottom: "16px" }}><strong>Email:</strong><br />info@academy.edu.vn</div>
          <Link href="/schedule" className="btn-secondary">View opening schedule</Link>
        </div>

        <div id="register" className="card">
          <h2 style={{ fontSize: "var(--text-2xl)", marginBottom: "8px" }}>{copy.title}</h2>
          <p style={{ color: "var(--text-muted)", marginBottom: "24px" }}>{copy.description}</p>

          {submitted ? (
            <div role="status" style={{ padding: "16px", borderRadius: "10px", background: "#ecfdf5", color: "#166534", marginBottom: "20px" }}>
              <strong>Registration received.</strong>
              <p style={{ margin: "4px 0 0" }}>AEC will contact you shortly with the next step.</p>
            </div>
          ) : null}

          {hasError ? (
            <p role="alert" style={{ padding: "12px", borderRadius: "8px", background: "#fef2f2", color: "#b91c1c" }}>
              Please enter your full name and phone number.
            </p>
          ) : null}

          <form action={submitRegistrationAction} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <input type="hidden" name="intent" value={intent} />
            <div>
              <label htmlFor="contact-name" style={{ display: "block", marginBottom: "8px", fontWeight: 600 }}>Full Name</label>
              <input id="contact-name" name="name" type="text" required style={{ width: "100%", padding: "12px", borderRadius: "8px", border: "1px solid #ccc" }} placeholder="Your full name" />
            </div>
            <div>
              <label htmlFor="contact-phone" style={{ display: "block", marginBottom: "8px", fontWeight: 600 }}>Phone Number</label>
              <input id="contact-phone" name="phone" type="tel" required style={{ width: "100%", padding: "12px", borderRadius: "8px", border: "1px solid #ccc" }} placeholder="0901234567" />
            </div>
            <div>
              <label htmlFor="contact-email" style={{ display: "block", marginBottom: "8px", fontWeight: 600 }}>Email <span style={{ fontWeight: 400, color: "var(--text-muted)" }}>(optional)</span></label>
              <input id="contact-email" name="email" type="email" style={{ width: "100%", padding: "12px", borderRadius: "8px", border: "1px solid #ccc" }} placeholder="you@example.com" />
            </div>
            <div>
              <label htmlFor="contact-program" style={{ display: "block", marginBottom: "8px", fontWeight: 600 }}>Program of Interest</label>
              <select id="contact-program" name="program" defaultValue={selectedProgram} style={{ width: "100%", padding: "12px", borderRadius: "8px", border: "1px solid #ccc" }}>
                <option value="">Help me choose a program</option>
                {programOptions.map((program) => <option value={program.value} key={program.value}>{program.label}</option>)}
              </select>
            </div>
            <button type="submit" className="btn-primary" style={{ marginTop: "16px" }}>Submit Registration</button>
          </form>
        </div>
      </div>
    </div>
  );
}
