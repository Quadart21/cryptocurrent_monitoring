import type { Metadata } from "next";
import { AdvertiseExamples } from "@/components/advertise/AdvertiseExamples";
import {
  AdvertiseHero,
  advertiseContactHref,
} from "@/components/advertise/AdvertiseHero";
import { AdvertiseSteps } from "@/components/advertise/AdvertiseSteps";
import {
  AdvertiseCta,
  AdvertiseTariffs,
} from "@/components/advertise/AdvertiseTariffs";
import { Breadcrumbs } from "@/components/seo/Breadcrumbs";
import { resolvePublicContact } from "@/lib/site-contacts";
import { getAdPricing, getSeoSettings, listAdTariffs } from "@/lib/store";

export const metadata: Metadata = {
  title: "Рекламодателям",
  description:
    "Форматы и тарифы рекламы в мониторинге GapSnap: баннеры с примерами, бегущая строка, закреп в курсах.",
};

export const revalidate = 60;

export default async function AdvertisePage() {
  const [tariffs, pricing, seo] = await Promise.all([
    listAdTariffs({ activeOnly: true }),
    getAdPricing(),
    getSeoSettings(),
  ]);
  const contact = resolvePublicContact({
    override: pricing.contact,
    contactEmail: seo.contactEmail,
    contactTelegram: seo.contactTelegram,
  });
  const href = advertiseContactHref(contact);

  return (
    <div className="space-y-12 sm:space-y-16">
      <Breadcrumbs
        items={[
          { href: "/", label: "Главная" },
          { label: "Реклама" },
        ]}
      />

      <AdvertiseHero intro={pricing.intro} contact={contact} href={href} />
      <AdvertiseExamples />
      <AdvertiseSteps />
      <AdvertiseTariffs tariffs={tariffs} />
      <AdvertiseCta note={pricing.note} href={href} />
    </div>
  );
}
