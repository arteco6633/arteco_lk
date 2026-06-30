type AssemblyDocument = {
  id: string;
  filename: string;
  fileUrl: string;
  type?: string;
};

export function AssemblyPdfViewer({ document }: { document: AssemblyDocument }) {
  return (
    <section className="w-full -mx-4 sm:mx-0">
      <div className="flex flex-col w-full overflow-hidden border-y sm:border border-slate-200 sm:rounded-2xl bg-slate-50 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 sm:px-5 py-3 bg-white border-b border-slate-200">
          <p className="font-bold text-black text-sm sm:text-base">Сборочный чертёж</p>
          <a
            href={document.fileUrl}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg bg-blue-600 text-white px-4 py-2 text-xs sm:text-sm font-bold shrink-0 min-h-[40px] inline-flex items-center"
          >
            Открыть PDF
          </a>
        </div>
        <div className="relative w-full bg-white">
          <iframe
            src={document.fileUrl}
            title={document.filename}
            className="w-full block border-0 bg-white
              min-h-[52dvh] h-[58dvh]
              sm:min-h-[58dvh] sm:h-[64dvh]
              md:min-h-[62dvh] md:h-[68dvh]
              lg:min-h-[680px] lg:h-[74dvh]
              xl:min-h-[720px] xl:h-[78dvh]
              2xl:h-[82dvh]"
          />
        </div>
      </div>
    </section>
  );
}
