import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { BadgeCheck, XCircle } from "lucide-react";
import { api, fmtDate } from "@/lib/api";
import { Brand } from "@/components/common";

export default function Verify() {
  const { id } = useParams();
  const [data, setData] = useState(undefined);

  useEffect(() => {
    api.get(`/verify/${id}`).then((r) => setData(r.data)).catch(() => setData(null));
  }, [id]);

  return (
    <div className="min-h-screen bg-slate-50 grid place-items-center p-6">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 w-full max-w-lg" data-testid="verify-card">
        <Brand />
        {data === undefined && <p className="mt-8 text-slate-500">Memeriksa sertifikat...</p>}
        {data === null && (
          <div className="mt-8 text-center" data-testid="verify-invalid">
            <XCircle className="h-12 w-12 text-rose-500 mx-auto" />
            <h1 className="mt-3 text-xl font-bold">Sertifikat tidak valid</h1>
          </div>
        )}
        {data && (
          <div className="mt-8" data-testid="verify-valid">
            <div className="flex items-center gap-2 text-emerald-700 font-semibold"><BadgeCheck className="h-6 w-6" /> Sertifikat valid</div>
            <dl className="mt-6 space-y-3 text-sm">
              {[["Nomor", data.certificate_no], ["Nama", data.name], [data.kind === "zoom" ? "Webinar" : "Pelatihan", data.course_title], ["Tanggal Selesai", fmtDate(data.completed_at)], ...(data.kind === "zoom" ? [] : [["Nilai", data.score]])].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4 border-b border-slate-100 pb-2"><dt className="text-slate-500">{k}</dt><dd className="font-semibold text-right">{v}</dd></div>
              ))}
            </dl>
          </div>
        )}
        <Link to="/login" className="mt-8 inline-block text-sm text-blue-700 hover:underline">Ke halaman login</Link>
      </div>
    </div>
  );
}
