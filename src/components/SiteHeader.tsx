import Link from "next/link";

const leagues = [
  { label: "Left, Down, Wide to the Right, Up", shortLabel: "LDWRU", href: "/the-redraft" },
  { label: "Dynastry Of Darkness", shortLabel: "DOD", href: "/dynastry-of-darkness" },
  { label: "Bullrush", shortLabel: "Bullrush", href: "/bullrush" },
];

export default function SiteHeader() {
  return (
    <header className="site-header">
      <div className="site-header__inner">
        <Link href="/" className="site-brand" aria-label="The Main Leagues home">
          <span className="site-brand__mark" aria-hidden="true">4</span>
          <span>
            <strong>The Main Leagues</strong>
            <small>Fantasy Football League Office</small>
          </span>
        </Link>
        <nav className="league-nav" aria-label="League navigation">
          {leagues.map((league) => (
            <Link key={league.href} href={league.href} aria-label={league.label}>
              <span className="league-nav__full">{league.label}</span>
              <span className="league-nav__short">{league.shortLabel}</span>
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}