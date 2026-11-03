import { fileUrl } from "@/lib/api";
import { VideoEmbed } from "@/components/VideoEmbed";

export const ModuleViewer = ({ module }) => {
  const url = module.url || "";
  if (module.type === "video" && url) return <VideoEmbed url={url} title={module.title} testid="module-video" />;
  if (module.type === "pdf" && url) {
    return (
      <div className="space-y-3" data-testid="module-pdf">
        <iframe src={fileUrl(url)} title={module.title} className="w-full h-[70vh] rounded-xl border border-slate-200 bg-white" />
        <a href={fileUrl(url)} target="_blank" rel="noreferrer" className="text-sm text-blue-700 hover:underline">Buka dokumen di tab baru</a>
      </div>
    );
  }
  return null;
};
