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
    contentUrl: url,
    name: name,
    description: description,
    author: author ? { "@type": "Person", name: author } : undefined,
    datePublished: datePublished,
    license: "https://rosegriffon.fr/mentions-legales",
    acquireLicensePage: "https://rosegriffon.fr/mentions-legales",
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
    name: "Rose Griffon",
    url: "https://rosegriffon.fr",
    logo: "https://rosegriffon.fr/RG_Logo_V2.5.webp",
    description:
      "Association française Inazuma Eleven. Rassemble la communauté, organise des événements et produit du contenu.",
    foundingDate: "2019",
    sameAs: [
      "https://x.com/rose_griffon",
      "https://discord.gg/TYzQvbByv4",
      "https://twitch.tv/rose_griffontv",
      "https://www.youtube.com/@RoseGriffon",
      "https://www.instagram.com/rose_griffonfr",
    ],
    address: {
      "@type": "PostalAddress",
      addressCountry: "FR",
    },
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
    url: "https://rosegriffon.fr",
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: "https://rosegriffon.fr/search?q={search_term_string}",
      },
      "query-input": "required name=search_term_string",
    } as any,
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
    headline: title,
    description: description,
    image: image,
    datePublished: datePublished,
    dateModified: dateModified || datePublished,
    author: {
      "@type": "Person",
      name: authorName,
      url: authorUrl,
    },
    publisher: {
      "@type": "Organization",
      name: "Rose Griffon",
      logo: {
        "@type": "ImageObject",
        url: "https://rosegriffon.fr/RG_Logo_V2.5.webp",
      },
    },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": url,
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
      position: index + 1,
      name: item.name,
      item: item.item.startsWith("http") ? item.item : `https://rosegriffon.fr${item.item}`,
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
      name: name,
      alternateName: username,
      image: image,
      description: description,
      url: url,
      sameAs: sameAs,
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
    name: name,
    description: description,
    startDate: startDate,
    endDate: endDate,
    image: image,
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OnlineEventAttendanceMode",
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
    url: url,
    organizer: {
      "@type": "Organization",
      name: "Rose Griffon",
      url: "https://rosegriffon.fr",
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}
