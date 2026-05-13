import type { ReactNode } from "react";
import { prepareQuickLinkContentForHtml } from "@/lib/marketing/prepareQuickLinkContentHtml";

type Props = {
  title: string;
  subtitle?: string;
  content: string;
  /** Rendered inside the bordered card (e.g. contact form below optional CMS body). */
  children?: ReactNode;
};

export default function QuickLinkContentPage({ title, subtitle, content, children }: Props) {
  const htmlBody = prepareQuickLinkContentForHtml(content);
  const hasBody = Boolean(htmlBody);

  return (
    <section className="overflow-hidden py-10 pb-20 pt-32">
      <div className="w-full px-4 mx-auto max-w-4xl sm:px-8 xl:px-0">
        <h1 className="text-3xl sm:text-4xl font-bold text-dark mb-4">{title}</h1>
        {subtitle ? <p className="text-base leading-7 text-meta-3 mb-8">{subtitle}</p> : null}
        <div className="rounded-2xl border border-gray-3 bg-white p-6 sm:p-8">
          {hasBody ? (
            <div
              className="prose prose-neutral max-w-none text-base leading-7 text-meta-3 mb-6 last:mb-0 prose-headings:font-semibold prose-headings:text-dark prose-p:text-meta-3 prose-li:text-meta-3 prose-a:text-blue"
              dangerouslySetInnerHTML={{ __html: htmlBody }}
            />
          ) : null}
          {children}
        </div>
      </div>
    </section>
  );
}

