import type {
  Article,
  BreadcrumbList,
  Event,
  ImageObject,
  Organization,
  ProfilePage,
  WebSite,
  WithContext,
} from "schema-dts";

// ... existing imports ...

interface ImageObjectSchemaProps {
  url: string;
  name?: string;
  description?: string;
  author?: string;
  datePublished?: string;
}

export function ImageObjectSchema({
  url,
  name,
  description,
  author,
  datePublished,
}: ImageObjectSchemaProps) {
  const schema: WithContext<ImageObject> = {
    "@context": "https://schema.org",
    "@type": "ImageObject",
    acquireLicensePage: "https://rosegriffon.fr/mentions-legales",
    author: author ? { "@type": "Person", name: author } : undefined,
    contentUrl: url,
    datePublished: datePublished,
    description: description,
    license: "https://rosegriffon.fr/mentions-legales",
    name: name,
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

export function OrganizationSchema() {
  const schema: WithContext<Organization> = {
    "@context": "https://schema.org",
    "@type": "Organization",
    address: {
      "@type": "PostalAddress",
      addressCountry: "FR",
    },
    description:
      "Association française Inazuma Eleven. Rassemble la communauté, organise des événements et produit du contenu.",
    foundingDate: "2019",
    logo: "https://rosegriffon.fr/RG_Logo_V2.5.webp",
    name: "Rose Griffon",
    sameAs: [
      "https://x.com/rose_griffon",
      "https://discord.gg/TYzQvbByv4",
      "https://twitch.tv/rose_griffontv",
      "https://www.youtube.com/@RoseGriffon",
      "https://www.instagram.com/rose_griffonfr",
    ],
    url: "https://rosegriffon.fr",
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

export function WebsiteSchema() {
  const schema: WithContext<WebSite> = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Rose Griffon",
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: "https://rosegriffon.fr/search?q={search_term_string}",
      },
      "query-input": "required name=search_term_string",
    } as any,
    url: "https://rosegriffon.fr",
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

interface ArticleSchemaProps {
  title: string;
  description: string;
  image: string[];
  datePublished: string;
  dateModified?: string;
  authorName: string;
  authorUrl?: string;
  url: string;
}

export function ArticleSchema({
  title,
  description,
  image,
  datePublished,
  dateModified,
  authorName,
  authorUrl,
  url,
}: ArticleSchemaProps) {
  const schema: WithContext<Article> = {
    "@context": "https://schema.org",
    "@type": "Article",
    author: {
      "@type": "Person",
      name: authorName,
      url: authorUrl,
    },
    dateModified: dateModified || datePublished,
    datePublished: datePublished,
    description: description,
    headline: title,
    image: image,
    mainEntityOfPage: {
      "@id": url,
      "@type": "WebPage",
    },
    publisher: {
      "@type": "Organization",
      logo: {
        "@type": "ImageObject",
        url: "https://rosegriffon.fr/RG_Logo_V2.5.webp",
      },
      name: "Rose Griffon",
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

interface BreadcrumbSchemaProps {
  items: { name: string; item: string }[];
}

export function BreadcrumbSchema({ items }: BreadcrumbSchemaProps) {
  const schema: WithContext<BreadcrumbList> = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      item: item.item.startsWith("http") ? item.item : `https://rosegriffon.fr${item.item}`,
      name: item.name,
      position: index + 1,
    })),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

interface ProfileSchemaProps {
  name: string;
  username: string;
  image?: string;
  description?: string;
  url: string;
  sameAs?: string[];
}

export function ProfileSchema({
  name,
  username,
  image,
  description,
  url,
  sameAs,
}: ProfileSchemaProps) {
  const schema: WithContext<ProfilePage> = {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    mainEntity: {
      "@type": "Person",
      alternateName: username,
      description: description,
      image: image,
      name: name,
      sameAs: sameAs,
      url: url,
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

interface EventSchemaProps {
  name: string;
  description: string;
  startDate: string;
  endDate?: string;
  image?: string;
  location?: string | { name: string; address?: string };
  url: string;
}

export function EventSchema({
  name,
  description,
  startDate,
  endDate,
  image,
  location,
  url,
}: EventSchemaProps) {
  const schema: WithContext<Event> = {
    "@context": "https://schema.org",
    "@type": "Event",
    description: description,
    endDate: endDate,
    eventAttendanceMode: "https://schema.org/OnlineEventAttendanceMode",
    eventStatus: "https://schema.org/EventScheduled",
    image: image,
    location:
      typeof location === "string"
        ? {
            "@type": "Place",
            name: location,
          }
        : {
            "@type": "Place",
            name: location?.name || "Online",
            address: location?.address,
          },
    name: name,
    organizer: {
      "@type": "Organization",
      name: "Rose Griffon",
      url: "https://rosegriffon.fr",
    },
    startDate: startDate,
    url: url,
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}
