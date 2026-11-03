import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Download, GraduationCap, PlayCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader, EmptyState } from "@/components/common";
import { CourseCard } from "@/components/CourseCard";
import { api, certUrl, downloadCert, fmtDate } from "@/lib/api";

export default function MyCourses({ status }) {
  const [items, setItems] = useState(null);
  const done = status === "completed";

  useEffect(() => {
    setItems(null);
    api.get("/my/enrollments", { params: { status } }).then((r) => setItems(r.data));
  }, [status]);

  return (
    <div>
      <PageHeader
        title={done ? "Pelatihan yang Sudah Diikuti" : "Pelatihan yang Sedang Diikuti"}
        subtitle={done ? "Unduh sertifikat pelatihan yang telah Anda selesaikan." : "Lanjutkan materi dan selesaikan kuis untuk mendapatkan sertifikat."}
      />
      {items === null ? (
        <div className="text-slate-500">Memuat...</div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={done ? GraduationCap : PlayCircle}
          title={done ? "Belum ada pelatihan selesai" : "Belum ada pelatihan yang diikuti"}
          text={done ? "Selesaikan pelatihan untuk mendapatkan sertifikat otomatis." : "Pilih pelatihan dari katalog untuk mulai belajar."}
          action={<Button asChild data-testid="mycourses-browse-button"><Link to="/pelatihan">Lihat Daftar Pelatihan</Link></Button>}
          testid={`mycourses-empty-${status}`}
        />
      ) : (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-6" data-testid={`mycourses-grid-${status}`}>
          {items.map((e) => (
            <CourseCard
              key={e.id}
              course={e.course}
              to={e.course.kind === "zoom" ? "/zoom" : undefined}
              status={e.status}
              progress={e.progress}
              footer={
                done ? (
                  <div className="space-y-3">
                    <div className="text-xs text-slate-500">No. {e.certificate_no} · {fmtDate(e.completed_at)}{e.course.kind === "zoom" ? " · Webinar Zoom" : <> · Nilai <b className="text-slate-800">{e.quiz_score}</b></>}</div>
                    <Button asChild className="w-full bg-emerald-600 hover:bg-emerald-700" data-testid="download-certificate-button">
                      <a href={certUrl(e.id)} onClick={downloadCert}><Download className="h-4 w-4 mr-2" />Unduh Sertifikat</a>
                    </Button>
                  </div>
                ) : (
                  <Button asChild className="w-full bg-[#0F2942] hover:bg-[#0A1D30]" data-testid={`continue-course-${e.course_id}`}>
                    <Link to={e.course.kind === "zoom" ? "/zoom" : `/pelatihan/${e.course_id}`}><PlayCircle className="h-4 w-4 mr-2" />Lanjutkan</Link>
                  </Button>
                )
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
