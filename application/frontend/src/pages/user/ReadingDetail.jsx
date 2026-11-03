import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Download, ExternalLink, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/pages/user/Readings";
import { api, fileUrl, fmtDate } from "@/lib/api";
import { VideoEmbed } from "@/components/VideoEmbed";

export default function ReadingDetail() {
  const { id } = useParams();
  const [r, setR] = useState(null);

  useEffect(() => {
    api.get(`/readings/${id}`).then((x) => setR(x.data)).catch(() => setR(false));
  }, [id]);

  if (r === false) return <div className="text-slate-500">Bacaan tidak ditemukan.</div>;
  if (!r) return <div className="text-slate-500">Memuat...</div>;

  return (
    <div className="max-w-5xl">
      <Link to="/kms" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 mb-6" data-testid="back-to-kms"><ArrowLeft className="h-4 w-4" />Daftar Bacaan</Link>
      <div className="grid md:grid-cols-[240px_1fr] gap-8 items-start" data-testid="reading-detail">
        <div className="aspect-[3/4] rounded-xl overflow-hidden bg-slate-100 shadow-md">
          {r.cover && <img src={fileUrl(r.cover)} alt={r.title} className="w-full h-full object-cover" />}
        </div>
        <div>
          <div className="flex items-center gap-3 text-xs font-semibold uppercase tracking-wider text-blue-700">{r.category_name}{r.status !== "approved" && <StatusBadge status={r.status} />}</div>
          <h1 className="mt-2 text-2xl sm:text-4xl font-extrabold tracking-tight text-slate-900">{r.title}</h1>
          <div className="mt-3 text-sm text-slate-500 flex flex-wrap gap-4">
            <span>{r.author || "-"}</span><span>{fmtDate(r.created_at)}</span><span className="flex items-center gap-1"><Eye className="h-4 w-4" />{r.views} kali dibaca</span>
          </div>
          {r.summary && <p className="mt-6 text-lg text-slate-700 leading-relaxed">{r.summary}</p>}
          <div className="mt-6 flex flex-wrap gap-3">
            {r.file_path && <Button asChild className="bg-[#0F2942] hover:bg-[#0A1D30]" data-testid="reading-download-button"><a href={fileUrl(r.file_path)} target="_blank" rel="noreferrer"><Download className="h-4 w-4 mr-2" />Unduh Dokumen</a></Button>}
            {r.link_url && <Button asChild variant="outline" data-testid="reading-link-button"><a href={r.link_url} target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4 mr-2" />Buka Tautan</a></Button>}
          </div>
          {r.video_url && <div className="mt-8"><VideoEmbed url={r.video_url} title={r.title} testid="reading-video" /></div>}
          {r.file_path && /\.pdf$/i.test(r.file_name || r.file_path) && <iframe src={fileUrl(r.file_path)} title={r.title} className="mt-8 w-full h-[70vh] rounded-xl border border-slate-200 bg-white" data-testid="reading-pdf-viewer" />}
          {r.content && <article className="mt-8 pt-8 border-t border-slate-200 text-slate-700 leading-loose whitespace-pre-line">{r.content}</article>}
        </div>
      </div>
    </div>
  );
}
