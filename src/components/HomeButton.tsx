import Link from "next/link";

export default function HomeButton() {
  return (
    <Link 
      href="/"
      className="home-link"
    >
      <span aria-hidden="true">←</span>
      League Office
    </Link>
  );
}
