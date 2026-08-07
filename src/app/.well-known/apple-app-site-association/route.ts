import { NextResponse } from "next/server";

// Apple fetches this (via their CDN) to verify badmintonrallyup.com vouches
// for the RallyUp app — that's what lets /join/* and /p/* links open the app
// directly (Universal Links) instead of the browser. Must be JSON, no
// redirect, at exactly /.well-known/apple-app-site-association.
const AASA = {
  applinks: {
    apps: [],
    details: [
      {
        appIDs: ["73PPF55358.com.badmintonrallyup.app"],
        components: [
          { "/": "/join/*", comment: "group invite links" },
          { "/": "/p/*", comment: "poll share links" },
        ],
      },
    ],
  },
};

export function GET() {
  return NextResponse.json(AASA, {
    headers: { "cache-control": "public, max-age=3600" },
  });
}
