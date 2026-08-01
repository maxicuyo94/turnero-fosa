import { SiteHeader } from "turnero-fosa";

/* SiteHeader paints its own charcoal bar, so it needs no extra surface. */

export const Public = () => <SiteHeader active="booking" />;

export const Landing = () => <SiteHeader active="home" />;

export const SignedIn = () => (
  <SiteHeader active="internal" onSignOut={() => undefined} userName="Fosa Admin" />
);
