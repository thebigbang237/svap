import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

const navigation = createNavigation(routing);

export const { Link, usePathname, useRouter, getPathname } = navigation;

/**
 * Re-exported with an explicit type annotation rather than destructured.
 *
 * `redirect` is declared `=> never`, but TypeScript only treats a call as
 * terminating control flow when the callee is a const with an *explicit* type
 * annotation. Destructured off an inferred object it loses that, and every
 * caller then has to convince the compiler that code after a redirect is
 * unreachable. Annotating here fixes it once for all of them.
 */
export const redirect: typeof navigation.redirect = navigation.redirect;
