import { Link } from "react-router-dom";
import { Clock, Layers, Users } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { fileUrl } from "@/lib/api";

const STATUS = {
  ongoing: { text: "Sedang diikuti", cls: "bg-sky-100 text-sky-800" },
  completed: { text: "Selesai", cls: "bg-emerald-100 text-emerald-800" },
};

export const CourseCard = ({ course, progress, status, footer, to }) => {
  const st = STATUS[status];
  return (
    <div className="group bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden hover:shadow-lg hover:-translate-y-1 transition-[box-shadow,transform] duration-300 flex flex-col" data-testid={`course-card-${course.id}`}>
      <Link to={to || `/pelatihan/${course.id}`} className="block relative aspect-[16/9] bg-slate-100 overflow-hidden">
        {course.thumbnail ? (
          <img src={fileUrl(course.thumbnail)} alt={course.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-[#0F2942] to-blue-800" />
        )}
        {course.category_name && (
          <span className="absolute top-3 left-3 text-[11px] font-semibold bg-white/95 text-slate-800 px-2.5 py-1 rounded-full">{course.category_name}</span>
        )}
        {st && <span className={`absolute top-3 right-3 text-[11px] font-semibold px-2.5 py-1 rounded-full ${st.cls}`}>{st.text}</span>}
      </Link>
      <div className="p-5 flex-1 flex flex-col">
        <div className="text-xs font-semibold uppercase tracking-wider text-amber-700">{course.level}</div>
        <Link to={to || `/pelatihan/${course.id}`} className="mt-1 font-bold text-slate-900 leading-snug line-clamp-2 hover:text-blue-700 transition-colors">{course.title}</Link>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
          <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{course.duration_hours} JP</span>
          <span className="flex items-center gap-1"><Layers className="h-3.5 w-3.5" />{course.module_count} materi</span>
          {course.participants != null && <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" />{course.participants} peserta</span>}
        </div>
        {status === "ongoing" && (
          <div className="mt-4">
            <div className="flex justify-between text-xs mb-1.5"><span className="text-slate-500">Progres</span><span className="font-semibold text-slate-800">{progress}%</span></div>
            <Progress value={progress} className="h-2" />
          </div>
        )}
        {footer && <div className="mt-auto pt-4">{footer}</div>}
      </div>
    </div>
  );
};
