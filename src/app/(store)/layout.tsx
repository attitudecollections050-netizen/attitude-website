import { getCategoryTree } from "@/lib/catalog/queries";
import { getSettings } from "@/lib/settings";
import { getCartView } from "@/lib/cart/server";
import { getCurrentUser } from "@/lib/auth";
import { MotionProvider } from "@/components/ui/MotionProvider";
import { CartProvider } from "@/components/cart/CartProvider";
import { CartDrawer } from "@/components/cart/CartDrawer";
import { CartToast } from "@/components/cart/CartToast";
import { AnnouncementBar } from "@/components/layout/AnnouncementBar";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";

// Cart, session and stock are per-request: never prerender these routes.
export const dynamic = "force-dynamic";

export default async function StoreLayout({ children }: LayoutProps<"/">) {
  const [categories, settings, cart, user] = await Promise.all([getCategoryTree(), getSettings(), getCartView(), getCurrentUser()]);
  return (
    <MotionProvider>
      <CartProvider initialCart={cart}>
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:bg-white focus:px-4 focus:py-2">
          Skip to content
        </a>
        {settings.announcement.enabled && <AnnouncementBar text={settings.announcement.text} href={settings.announcement.href} />}
        <Header categories={categories} signedIn={Boolean(user)} />
        <main id="main" className="flex-1">
          {children}
        </main>
        <Footer categories={categories} settings={settings} />
        <CartDrawer />
        <CartToast />
      </CartProvider>
    </MotionProvider>
  );
}
