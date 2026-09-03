import Link from "next/link";

const leagues = [
  {
    title: "Left, Down, Wide to the Right, Up",
    format: "PlayStation Redraft",
    description: "Enter the combination. Set the lineup. Play for this season's title.",
    href: "/the-redraft",
    record: "EST. 2015",
    accent: "redraft",
    monogram: "R",
  },
  {
    title: "Dynastry Of Darkness",
    format: "Wrestling Dynasty League",
    description: "Build the stable. Cut the promo. Take the belt and defend the dynasty.",
    href: "/dynastry-of-darkness",
    record: "KEEPERS LIVE",
    accent: "dynasty",
    monogram: "D",
  },
  {
    title: "Bullrush",
    format: "Survivor League",
    description: "Fast decisions, hard hits, and no room to hide on Sunday.",
    href: "/bullrush",
    record: "WIN OR GO HOME",
    accent: "bullrush",
    monogram: "B",
  },
];

export default function Home() {
  return (
    <main className="home-field">
      <section className="home-hero">
        <div className="home-hero__content">
          <p className="eyebrow">The 2026 season is live</p>
          <h1>Every matchup<br /><span>means something.</span></h1>
          <p className="home-hero__lede">
            Three leagues. Years of receipts. One place for standings, records,
            draft grades, payouts, and the performances nobody will let you forget.
          </p>
          <div className="season-strip" aria-label="League quick stats">
            <span><strong>3</strong> Leagues</span>
            <span><strong>11+</strong> Seasons</span>
            <span><strong>1</strong> Trophy</span>
          </div>
        </div>
        <div className="football-display" aria-hidden="true">
          <div className="football-display__shadow" />
          <div className="football">
            <span className="football__lace football__lace--1" />
            <span className="football__lace football__lace--2" />
            <span className="football__lace football__lace--3" />
            <span className="football__lace football__lace--4" />
            <span className="football__seam" />
          </div>
          <span className="play-call">RED 18 · SET · HIKE</span>
        </div>
      </section>

      <section className="league-select" aria-labelledby="league-select-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Choose your locker room</p>
            <h2 id="league-select-title">League Central</h2>
          </div>
          <p>Pick a league to see its complete season hub.</p>
        </div>
        <div className="league-grid">
          {leagues.map((league) => (
            <Link
              key={league.href}
              href={league.href}
              className={`league-card league-card--${league.accent}`}
            >
              <div className="league-card__topline">
                <span>{league.format}</span>
                <span>{league.record}</span>
              </div>
              <div className="league-card__crest" aria-hidden="true">{league.monogram}</div>
              <p>{league.format}</p>
              <h3>{league.title}</h3>
              <span className="league-card__description">{league.description}</span>
              <span className="league-card__action">Enter league <b aria-hidden="true">→</b></span>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
