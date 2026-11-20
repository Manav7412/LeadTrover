export default function ComingSoon({ title, module }: { title: string; module: number }) {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">{title}</h1>
      <div className="card mt-6 flex flex-col items-center px-6 py-16 text-center">
        <p className="text-base font-medium text-slate-800">Coming in module {module}</p>
        <p className="mt-1 text-sm text-slate-500">We build LeadTrove one module at a time. This page is next in line.</p>
      </div>
    </div>
  );
}
