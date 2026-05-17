/**
 * Configuration centralisée des icônes Rose Griffon
 * Garantit la cohérence visuelle dans toute l'application
 * Utilise lucide-react avec des tailles standardisées
 */

import type { LucideIcon } from "lucide-react";
import {
  Activity,
  // NOTE: Instagram, Twitter, Twitch, Youtube removed in lucide-react v1 — use shared/icons
  AlertCircle,
  AlertTriangle,
  Archive,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowUpDown,
  ArrowRight as ArrowUpRight,
  BarChart3,
  // Actions & Status
  Bell,
  BellOff,
  Bot,
  // Association & Community
  Building,
  Calendar,
  CalendarDays,
  Camera,
  Check,
  CheckCircle,
  Check as CheckIcon,
  ChevronDown,
  ChevronDown as ChevronDownIcon,
  ChevronLeft,
  ChevronRight,
  ChevronRight as ChevronRightIcon,
  ChevronsUpDown,
  ChevronUp,
  ChevronUp as ChevronUpIcon,
  Circle as CircleIcon,
  Clapperboard,
  Clock,
  Construction,
  Copy,
  CreditCard,
  Database,
  Download,
  // Edit & Manage
  Edit,
  Edit2,
  ExternalLink,
  Eye,
  EyeOff,
  FileText,
  Filter,
  Folder,
  Gift,
  Globe,
  Handshake,
  Heart,
  // Navigation & Actions
  Home,
  ImageIcon,
  Image as ImageLucide,
  Info,
  LayoutGrid,
  List,
  Loader2,
  LogIn,
  LogOut,
  Mail,
  MapPin,
  Menu,
  MessageCircle,
  MessageSquare,
  Monitor,
  Moon,
  MoreHorizontal,
  Newspaper,
  Package,
  PackageOpen,
  Palette,
  PencilLine,
  PenSquare,
  Play,
  Plus,
  Radio,
  RefreshCw,
  RotateCw,
  Save,
  Scale,
  ScrollText,
  // Misc
  Search,
  // Admin & Settings
  Settings,
  Share2,
  Shield,
  ShieldCheck,
  // Store & Commerce
  ShoppingBag,
  ShoppingCart,
  Smile,
  Sparkles,
  Sun,
  Tag,
  Trash,
  Trash2,
  Trophy,
  Tv,
  Upload,
  // User & Auth
  User,
  UserCheck,
  UserCircle,
  UserPlus,
  Users,
  Users2,
  UserX,
  Video,
  X,
  XCircle,
  X as XIcon,
  Zap,
} from "lucide-react";

import { InstagramIcon as Instagram } from "@/shared/icons/instagram";
import { TwitchIcon as Twitch } from "@/shared/icons/twitch";
import TwitterIcon from "@/shared/icons/twitter";
import { YoutubeIcon as Youtube } from "@/shared/icons/youtube";

const Twitter = TwitterIcon;

/**
 * Tailles standardisées pour les icônes
 */
export const iconSizes = {
  xs: "w-3 h-3",
  sm: "w-4 h-4",
  md: "w-5 h-5",
  lg: "w-6 h-6",
  xl: "w-8 h-8",
  responsive: "w-4 h-4 sm:w-[18px] sm:h-[18px]", // Standard pour sidebar
  responsiveLg: "w-5 h-5 sm:w-6 sm:h-6", // Pour headers
} as const;

/**
 * Configuration des icônes par catégorie
 */
export const icons = {
  // Navigation
  navigation: {
    home: Home,
    back: ArrowLeft,
    forward: ArrowRight,
    scrollTop: ArrowUp,
    chevronDown: ChevronDown,
    chevronRight: ChevronRight,
    menu: Menu,
    close: X,
    search: Search,
    externalLink: ExternalLink,
  },

  // User & Authentication
  user: {
    user: User,
    userCircle: UserCircle,
    userPlus: UserPlus,
    users: Users,
    usersGroup: Users2,
    login: LogIn,
    logout: LogOut,
    admin: ShieldCheck,
  },

  // Association
  association: {
    building: Building,
    partners: Handshake,
    support: Heart,
    camera: Camera,
    location: MapPin,
    charter: ScrollText,
    contact: PencilLine,
    mail: Mail,
    calendar: CalendarDays,
  },

  // Store
  store: {
    bag: ShoppingBag,
    cart: ShoppingCart,
    package: Package,
    packageOpen: PackageOpen,
    creditCard: CreditCard,
    tag: Tag,
  },

  // Admin
  admin: {
    settings: Settings,
    database: Database,
    analytics: BarChart3,
    documents: FileText,
    images: ImageIcon,
    shield: ShieldCheck,
  },

  // Status & Notifications
  status: {
    bell: Bell,
    check: Check,
    checkCircle: CheckCircle,
    alert: AlertCircle,
    warning: AlertTriangle,
    info: Info,
    loading: Loader2,
    refresh: RefreshCw,
    rotate: RotateCw,
  },

  // Actions
  actions: {
    edit: Edit,
    delete: Trash2,
    archive: Archive,
    download: Download,
    upload: Upload,
    copy: Copy,
    add: Plus,
    close: X,
  },

  // Theme
  theme: {
    moon: Moon,
    sun: Sun,
    system: Monitor,
  },

  // Social Media
  social: {
    twitch: Twitch,
    youtube: Youtube,
    twitter: Twitter,
    instagram: Instagram,
    globe: Globe,
    messageCircle: MessageCircle,
    tv: Tv,
    image: ImageLucide,
    newspaper: Newspaper,
    trophy: Trophy,
  },
} as const;

/**
 * Helper pour obtenir une icône avec la taille appropriée
 */
export function getIcon(
  category: keyof typeof icons,
  name: string,
  size: keyof typeof iconSizes = "responsive"
): { icon: LucideIcon; className: string } {
  const iconCategory = icons[category];
  if (!iconCategory) {
    console.warn(`Icon category "${category}" not found`);
    return { icon: AlertCircle, className: iconSizes[size] };
  }

  const icon = (iconCategory as Record<string, LucideIcon>)[name];
  if (!icon) {
    console.warn(`Icon "${name}" not found in category "${category}"`);
    return { icon: AlertCircle, className: iconSizes[size] };
  }

  return { icon, className: iconSizes[size] };
}

/**
 * Props communes pour les icônes
 */
export const iconProps = {
  default: {
    strokeWidth: 2,
    className: iconSizes.responsive,
  },
  thin: {
    strokeWidth: 1.5,
    className: iconSizes.responsive,
  },
  bold: {
    strokeWidth: 2.5,
    className: iconSizes.responsive,
  },
} as const;

/**
 * Export des icônes les plus utilisées pour faciliter l'import
 */
// Export spécial pour Image (conflit avec Next.js Image)
export {
  // Admin
  Activity,
  // Status
  AlertCircle,
  AlertTriangle,
  Archive,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowUpDown,
  ArrowUpRight,
  BarChart3,
  Bell,
  BellOff,
  Bot,
  // Association
  Building,
  Calendar,
  CalendarDays,
  Camera,
  Check,
  CheckCircle,
  // Aliases pour compatibilité
  CheckIcon,
  ChevronDown,
  ChevronDownIcon,
  ChevronLeft,
  ChevronRight,
  ChevronRightIcon,
  ChevronsUpDown,
  ChevronUp,
  ChevronUpIcon,
  CircleIcon,
  Clapperboard,
  Clock,
  Construction,
  Copy,
  CreditCard,
  Database,
  Download,
  // Actions
  Edit,
  Edit2,
  ExternalLink,
  Eye,
  EyeOff,
  FileText,
  Filter,
  Folder,
  Gift,
  Globe,
  Handshake,
  Heart,
  // Navigation
  Home,
  ImageIcon,
  ImageLucide as Image,
  Info,
  // Social & Media
  Instagram,
  LayoutGrid,
  List,
  Loader2,
  LogIn,
  LogOut,
  Mail,
  MapPin,
  Menu,
  MessageCircle,
  MessageSquare,
  Monitor,
  // Theme
  Moon,
  MoreHorizontal,
  Newspaper,
  Package,
  PackageOpen,
  Palette,
  PencilLine,
  PenSquare,
  Play,
  Plus,
  Radio,
  RefreshCw,
  RotateCw,
  Save,
  Scale,
  ScrollText,
  Search,
  Settings,
  Share2,
  // Admin
  Shield,
  ShieldCheck,
  // Store
  ShoppingBag,
  ShoppingCart,
  Smile,
  Sparkles,
  Sun,
  Tag,
  Trash,
  Trash2,
  Trophy,
  Tv,
  Twitch,
  Twitter,
  Upload,
  // User
  User,
  UserCheck,
  UserCircle,
  UserPlus,
  Users,
  Users2,
  UserX,
  Video,
  X,
  XCircle,
  XIcon,
  Youtube,
  Zap,
};
