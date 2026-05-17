import { BrandLogo } from "@/components/BrandLogo";
import { Button } from "@/components/ui/button";
import { ShieldCheck } from "lucide-react";

type BrandedLoginProps = {
  onLogin: () => void;
  loginConfigMessage?: string | null;
};

export function BrandedLogin({ onLogin, loginConfigMessage }: BrandedLoginProps) {
  return (
    <div className="min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,rgba(214,177,79,0.16),transparent_34%),linear-gradient(135deg,#06172f_0%,#0a2446_48%,#f8fafc_48.2%,#ffffff_100%)] px-4 py-8 text-slate-950">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-6xl items-center justify-center">
        <div className="grid w-full overflow-hidden rounded-[28px] border border-white/70 bg-white shadow-2xl shadow-slate-950/20 md:grid-cols-[1.05fr_0.95fr]">
          <section className="hidden bg-[#06172f] p-10 text-white md:flex md:flex-col md:justify-between">
            <div>
              <BrandLogo
                className="h-32 w-64 justify-start rounded-3xl bg-white p-4 shadow-2xl shadow-black/25 ring-1 ring-white/70"
                imageClassName="drop-shadow-[0_10px_20px_rgba(15,23,42,0.18)]"
              />
              <div className="mt-10 max-w-md">
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#d6b14f]">Best of All</p>
                <h1 className="mt-4 text-4xl font-bold leading-tight tracking-tight">
                  지점 운영과 고객 관리를 하나의 기준으로.
                </h1>
                <p className="mt-5 text-sm leading-6 text-slate-300">
                  고객 DB, 상담, 계약, 실적, 운영 리스크까지 BOA CRM에서 안전하게 관리합니다.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3 text-xs text-slate-300">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-3">고객 DB</div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-3">실적 관리</div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-3">운영 리스크</div>
            </div>
          </section>

          <section className="flex min-h-[620px] flex-col justify-center px-6 py-10 sm:px-10">
            <div className="mx-auto w-full max-w-md">
              <BrandLogo className="mx-auto h-28 w-72 md:hidden" />
              <div className="mt-8 text-center md:mt-0">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#b99b5f]">BOA Best of All</p>
                <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-950">BOA 지점관리 CRM</h2>
                <p className="mt-3 text-sm leading-6 text-slate-500">
                  고객 DB, 상담, 계약, 실적, 운영 리스크까지 한곳에서 관리합니다.
                </p>
              </div>

              <div className="mt-8 rounded-2xl border border-slate-200 bg-slate-50/70 p-5">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#0b2a50] text-white">
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">안전한 권한 기반 접근</p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      Google 계정으로 로그인하면 역할에 맞는 업무 화면만 접근할 수 있습니다.
                    </p>
                  </div>
                </div>
              </div>

              {loginConfigMessage ? (
                <p className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-center text-sm text-red-700">
                  {loginConfigMessage}
                </p>
              ) : null}

              <Button
                onClick={onLogin}
                size="lg"
                className="mt-6 h-12 w-full rounded-xl bg-[#08244a] text-base font-semibold text-white shadow-lg shadow-slate-900/15 hover:bg-[#0b2f61]"
              >
                Google 계정으로 로그인
              </Button>

              <p className="mt-5 text-center text-xs text-slate-400">
                권한에 따라 안전하게 접근합니다.
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
