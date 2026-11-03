import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api, errMsg } from "@/lib/api";

export default function VerifyEmail() {
  const { token } = useParams();
  const [state, setState] = useState({ status: "loading" });
  useEffect(() => {
    api.post("/auth/verify-email", { token })
      .then((r) => setState({ status: "ok", email: r.data.email }))
      .catch((e) => setState({ status: "error", msg: errMsg(e) }));
  }, [token]);
  return (
    <div className="min-h-screen grid place-items-center bg-slate-50 p-6">
      <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200 p-8 text-center" data-testid="verify-email-card">
        {state.status === "loading" && <Loader2 className="h-10 w-10 mx-auto animate-spin text-slate-400" />}
        {state.status === "ok" && <><CheckCircle2 className="h-12 w-12 mx-auto text-emerald-600" /><h1 className="mt-4 text-xl font-bold">Email terverifikasi</h1><p className="mt-2 text-sm text-slate-600">{state.email} berhasil diverifikasi. Akun Anda kini 100% terverifikasi.</p></>}
        {state.status === "error" && <><XCircle className="h-12 w-12 mx-auto text-rose-600" /><h1 className="mt-4 text-xl font-bold">Verifikasi gagal</h1><p className="mt-2 text-sm text-slate-600" data-testid="verify-email-error">{state.msg}</p></>}
        <Button asChild className="mt-6 bg-[#0F2942] hover:bg-[#0A1D30]" data-testid="verify-email-home"><Link to="/">Ke Beranda</Link></Button>
      </div>
    </div>
  );
}
