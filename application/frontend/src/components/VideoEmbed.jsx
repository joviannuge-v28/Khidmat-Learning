import { fileUrl } from "@/lib/api";

export const embedSrc = (url) => {
  const yt = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([\w-]{6,})/);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`;
  const vimeo = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}`;
  const drive = url.match(/drive\.google\.com\/file\/d\/([\w-]+)/);
  if (drive) return `https://drive.google.com/file/d/${drive[1]}/preview`;
  return null;
};

const isFile = (url) => !url.startsWith("http") || /\.(mp4|webm|ogg|mov)(\?|$)/i.test(url);

export const VideoEmbed = ({ url, title, testid = "video-embed" }) => {
  if (!url) return null;
  const src = embedSrc(url);
  return (
    <div className="aspect-video bg-black rounded-xl overflow-hidden" data-testid={testid}>
      {src || !isFile(url) ? (
        <iframe src={src || url} title={title} className="w-full h-full" allow="accelerometer; autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen />
      ) : (
        <video src={fileUrl(url)} controls className="w-full h-full" />
      )}
    </div>
  );
};
