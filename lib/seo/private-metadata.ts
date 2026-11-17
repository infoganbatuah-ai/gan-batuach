import type { Metadata } from "next";

// Authentication and product-workspace pages are intentionally excluded from
// search. robots.txt is not an access-control mechanism, so these directives
// remain on the rendered pages even when a crawler discovers a deep link.
export const privateRouteMetadata: Metadata = {
  robots: {
    index: false,
    follow: false,
    noarchive: true,
    nosnippet: true,
    noimageindex: true,
  },
};
