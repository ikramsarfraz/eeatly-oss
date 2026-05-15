/**
 * YouTube embed via the privacy-enhanced `youtube-nocookie.com` host —
 * doesn't set tracking cookies until the user actually clicks play.
 *
 * 16:9 aspect ratio container so the iframe scales with the parent
 * width. `loading="lazy"` defers offscreen embeds until the user
 * scrolls near them — recipe pages have one embed at most, but the
 * attribute costs nothing and protects against future list pages.
 */
type Props = {
  videoId: string;
  title?: string;
};

export function YouTubeEmbed({ videoId, title }: Props) {
  return (
    <div className="relative w-full overflow-hidden rounded-lg border border-[var(--border)] bg-black aspect-video">
      <iframe
        src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}`}
        title={title ?? "YouTube video player"}
        loading="lazy"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
        className="absolute inset-0 h-full w-full border-0"
      />
    </div>
  );
}
