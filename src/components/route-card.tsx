import Link from "next/link";

type RouteCardProps = {
  eyebrow: string;
  title: string;
  description: string;
  href: string;
  actionLabel: string;
};

export function RouteCard({ eyebrow, title, description, href, actionLabel }: RouteCardProps) {
  return (
    <article className="rounded-[1.4rem] border border-white/10 bg-white/[0.04] p-7 shadow-2xl shadow-black/20 transition hover:border-apple-300/40 hover:bg-white/[0.07]">
      <p className="text-xs font-bold uppercase tracking-[0.38em] text-apple-300">{eyebrow}</p>
      <h2 className="mt-4 text-2xl font-black tracking-[-0.035em] text-white">{title}</h2>
      <p className="mt-3 text-sm leading-6 text-zinc-400">{description}</p>
      <Link
        className="mt-6 inline-flex text-sm font-black text-apple-300 transition hover:text-apple-400 focus:outline-none focus:ring-2 focus:ring-apple-300 focus:ring-offset-2 focus:ring-offset-zinc-950"
        href={href}
      >
        {actionLabel}
      </Link>
    </article>
  );
}
