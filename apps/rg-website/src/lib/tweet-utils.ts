export const formatDate = (date: Date) => {
  return new Intl.DateTimeFormat("fr-FR", {
    hour: "numeric",
    minute: "numeric",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
};

export const formatNumber = (n: number) => {
  return new Intl.NumberFormat("fr-FR", { notation: "compact" }).format(n);
};
