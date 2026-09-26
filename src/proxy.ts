import createMiddleware from "next-intl/middleware";
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { routing } from "./i18n/routing";

const intlMiddleware = createMiddleware(routing);

export default async function proxy(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/admin")) {
    return handleAdminAuth(request);
  }

  return intlMiddleware(request);
}

/**
 * Gate every /admin/* route (except /admin/login) behind a valid Supabase
 * session AND a matching svap.admin_profiles row. /admin itself isn't
 * enough — a regular authenticated candidature-form user must not get in.
 */
async function handleAdminAuth(request: NextRequest) {
  const isLoginPage = request.nextUrl.pathname === "/admin/login";

  let response = NextResponse.next({ request });
  let isAdmin = false;

  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        db: { schema: "svap" },
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) =>
              request.cookies.set(name, value),
            );
            response = NextResponse.next({ request });
            cookiesToSet.forEach(({ name, value, options }) =>
              response.cookies.set(name, value, options),
            );
          },
        },
      },
    );

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const { data } = await supabase
        .from("admin_profiles")
        .select("id")
        .eq("id", user.id)
        .maybeSingle();
      isAdmin = !!data;
    }
  } catch (error) {
    // Fail closed: a Supabase client/network error (e.g. misconfigured or
    // unreachable during local dev) must never leave an /admin/* route
    // accessible — treat it the same as "not authenticated".
    console.error("Admin auth check failed:", error);
    isAdmin = false;
  }

  if (isLoginPage) {
    // Already signed in as a valid admin — no reason to show the form.
    if (isAdmin) {
      return NextResponse.redirect(new URL("/admin", request.url));
    }
    return response;
  }

  if (!isAdmin) {
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }

  return response;
}

/**
 * What still needs the proxy, and nothing else.
 *
 * The public pages are prerendered, and a request for `/fr/faq` already
 * carries its locale in the path — running locale negotiation over it buys
 * nothing and costs a function invocation on every page view, which on a
 * marketing site is nearly all of them.
 *
 * So locale-prefixed paths are excluded, and what is left is exactly the two
 * jobs that cannot be done anywhere else:
 *
 *   • an unprefixed path (`/`, `/faq`, a pasted old link) → redirected to a
 *     locale by next-intl;
 *   • `/admin/*` → gated on a session and an admin_profiles row.
 *
 * Also excluded: `api` (the routes authenticate themselves), `_next`, and
 * anything with a file extension.
 */
export const config = {
  matcher: ["/((?!fr/|en/|ar/|api|_next|.*\\..*).*)"],
};
