import HomeButton from "@/components/HomeButton";
import "./vids.css";

type VideoItem = {
  id: string;
  title: string;
  description: string;
  date: string;
  type: "Presser" | "Highlight" | "Analysis" | "Update" | "Draft";
  youtubeId: string;
  season: number;
};

const videos: VideoItem[] = [
  {
    id: "presser-2026-preseason",
    title: "2026 Preseason Presser",
    description: "The kickff presser to launch the 2026 season. Strap in pipsqueaks.",
    date: "2026-09-06",
    type: "Presser",
    youtubeId: "8hEb1NbE9JM",
    season: 2026,
  },
];

export default function VidsPage() {
  return (
    <div className="site-content">
      <main className="vids-page">
        <div className="vids-header">
          <HomeButton />
          <div className="vids-title">
            <p className="eyebrow">League Content</p>
            <h1>Vids</h1>
            <p className="vids-subtitle">Season highlights, pressers, and exclusive league content</p>
          </div>
        </div>

        <section className="vids-section">
          <div className="vids-container">
            {videos.map((video) => (
              <article key={video.id} className="video-card">
                <div className="video-card__embed">
                  <div className="video-embed">
                    <iframe
                      className="video-embed__frame"
                      src={`https://www.youtube-nocookie.com/embed/${video.youtubeId}`}
                      title={video.title}
                      frameBorder="0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  </div>
                </div>
                <div className="video-card__content">
                  <div className="video-card__meta">
                    <span className={`video-badge video-badge--${video.type.toLowerCase()}`}>
                      {video.type}
                    </span>
                    <time dateTime={video.date} className="video-card__date">
                      {new Date(video.date).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </time>
                  </div>
                  <h2 className="video-card__title">{video.title}</h2>
                  <p className="video-card__description">{video.description}</p>
                </div>
              </article>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
