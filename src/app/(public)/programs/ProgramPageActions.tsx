import Link from "next/link";

export function ProgramPageActions({ program }: { program: string }) {
  return (
    <div className="flex flex-wrap gap-3 mt-6">
      <Link href={`/contact?intent=placement-test&program=${program}#register`} className="btn-primary">Book a placement test</Link>
      <Link href="/schedule" className="btn-secondary">View opening schedule</Link>
      <Link href="/teachers" className="btn-secondary">Meet our teachers</Link>
    </div>
  );
}
