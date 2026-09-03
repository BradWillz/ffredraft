import Link from "next/link";

export type LeagueFeature = {
  title: string;
  description: string;
  href: string;
  label: string;
};

type LeagueHubProps = {
  name: string;
  format: string;
  monogram: string;
  tone: "redraft" | "dynasty" | "bullrush";
  statement: string;
  features: LeagueFeature[];
};

export default function LeagueHub({
  name,
  format,
  monogram,
  tone,
  statement,
  features,
}: LeagueHubProps) {
  return (
    <main className={`league-hub league-hub--${tone}`}>
      <section className="league-hub__hero">
        <div className="league-hub__hero-inner">
          <div className="league-hub__copy">
            <Link href="/" className="league-hub__back">← All leagues</Link>
            <p className="eyebrow">{format} · League headquarters</p>
            <h1>{name}</h1>
            <p className="league-hub__statement">{statement}</p>
            <div className="league-hub__status">
              <span><b>2026</b> Active season</span>
              <span><b>{features.length}</b> League reports</span>
              <span><i /> Live data</span>
            </div>
          </div>
          <div className="league-hub__identity" aria-hidden="true">
            <span className="league-hub__crest">{monogram}</span>
            <strong>Protect the house</strong>
            <small>{format}</small>
          </div>
        </div>
      </section>

      <section className="playbook" aria-labelledby="playbook-title">
        <div className="playbook__heading">
          <div>
            <p className="eyebrow">League operations</p>
            <h2 id="playbook-title">The Playbook</h2>
          </div>
          <p>Records, rivalries, and every receipt from the season.</p>
        </div>
        <div className="playbook__grid">
          {features.map((feature, index) => (
            <Link key={feature.href} href={feature.href} className="playbook-card">
              <div className="playbook-card__meta">
                <span>{String(index + 1).padStart(2, "0")}</span>
                <span>{feature.label}</span>
              </div>
              <h3>{feature.title}</h3>
              <p>{feature.description}</p>
              <span className="playbook-card__action">Open report <b aria-hidden="true">→</b></span>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}