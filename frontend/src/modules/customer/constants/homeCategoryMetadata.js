import { Sparkles } from 'lucide-react';
import HomeIcon from '@mui/icons-material/Home';
import DevicesIcon from '@mui/icons-material/Devices';
import LocalGroceryStoreIcon from '@mui/icons-material/LocalGroceryStore';
import KitchenIcon from '@mui/icons-material/Kitchen';
import ChildCareIcon from '@mui/icons-material/ChildCare';
import PetsIcon from '@mui/icons-material/Pets';
import SportsSoccerIcon from '@mui/icons-material/SportsSoccer';
import CardGiftcardIcon from '@mui/icons-material/CardGiftcard';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import SpaIcon from '@mui/icons-material/Spa';
import ToysIcon from '@mui/icons-material/Toys';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import LocalHospitalIcon from '@mui/icons-material/LocalHospital';
import YardIcon from '@mui/icons-material/Yard';
import BusinessCenterIcon from '@mui/icons-material/BusinessCenter';
import MusicNoteIcon from '@mui/icons-material/MusicNote';
import CheckroomIcon from '@mui/icons-material/Checkroom';
import LocalCafeIcon from '@mui/icons-material/LocalCafe';
import DiamondIcon from '@mui/icons-material/Diamond';
import ColorLensIcon from '@mui/icons-material/ColorLens';
import BuildIcon from '@mui/icons-material/Build';
import LuggageIcon from '@mui/icons-material/Luggage';

const DEFAULT_CATEGORY_THEME = {
  gradient: "linear-gradient(to bottom, #25D366, #4ADE80)",
  shadow: "shadow-rose-500/20",
  accent: "text-[#1A1A1A]",
};

const CATEGORY_METADATA = {
  All: {
    icon: HomeIcon,
    theme: DEFAULT_CATEGORY_THEME,
    banner: {
      title: "HOUSEFULL",
      subtitle: "SALE",
      floatingElements: "sparkles",
    },
  },
  Grocery: {
    icon: LocalGroceryStoreIcon,
    theme: {
      gradient: "linear-gradient(to bottom, #FF9F1C, #FFBF69)",
      shadow: "shadow-orange-500/20",
      accent: "text-orange-900",
    },
    banner: {
      title: "SUPERSAVER",
      subtitle: "FRESH & FAST",
      floatingElements: "leaves",
    },
  },
  Wedding: {
    icon: CardGiftcardIcon,
    theme: {
      gradient: "linear-gradient(to bottom, #FF4D6D, #FF8FA3)",
      shadow: "shadow-rose-500/20",
      accent: "text-rose-900",
    },
    banner: { title: "WEDDING", subtitle: "BLISS", floatingElements: "hearts" },
  },
  "Home & Kitchen": {
    icon: KitchenIcon,
    theme: {
      gradient: "linear-gradient(to bottom, #BC6C25, #DDA15E)",
      shadow: "shadow-amber-500/20",
      accent: "text-amber-900",
    },
    banner: { title: "HOME", subtitle: "KITCHEN", floatingElements: "smoke" },
  },
  Electronics: {
    icon: DevicesIcon,
    theme: {
      gradient: "linear-gradient(to bottom, #7209B7, #B5179E)",
      shadow: "shadow-purple-500/20",
      accent: "text-purple-900",
    },
    banner: {
      title: "TECH FEST",
      subtitle: "GADGETS",
      floatingElements: "tech",
    },
  },
  Kids: {
    icon: ChildCareIcon,
    theme: {
      gradient: "linear-gradient(to bottom, #4CC9F0, #A0E7E5)",
      shadow: "shadow-blue-500/20",
      accent: "text-blue-900",
    },
    banner: {
      title: "LITTLE ONE",
      subtitle: "CARE",
      floatingElements: "bubbles",
    },
  },
  "Pet Supplies": {
    icon: PetsIcon,
    theme: {
      gradient: "linear-gradient(to bottom, #FB8500, #FFB703)",
      shadow: "shadow-yellow-500/20",
      accent: "text-yellow-900",
    },
    banner: { title: "PAWSOME", subtitle: "DEALS", floatingElements: "bones" },
  },
  Sports: {
    icon: SportsSoccerIcon,
    theme: {
      gradient: "linear-gradient(to bottom, #4361EE, #4895EF)",
      shadow: "shadow-indigo-500/20",
      accent: "text-indigo-900",
    },
    banner: { title: "SPORTS", subtitle: "GEAR", floatingElements: "confetti" },
  },
};

const ALL_CATEGORY = {
  id: "all",
  _id: "all",
  name: "All",
  icon: HomeIcon,
  theme: DEFAULT_CATEGORY_THEME,
  headerColor: "#065f46",
  banner: {
    title: "HOUSEFULL",
    subtitle: "SALE",
    floatingElements: "sparkles",
    textColor: "text-white",
  },
};

const categories = [
  {
    id: 1,
    name: "All",
    icon: HomeIcon,
    theme: DEFAULT_CATEGORY_THEME,
    banner: {
      title: "HOUSEFULL",
      subtitle: "SALE",
      floatingElements: "sparkles",
      textColor: "text-white",
    },
  },
  {
    id: 5,
    name: "Electronics",
    icon: DevicesIcon,
    theme: {
      gradient: "linear-gradient(to bottom, #7209B7, #B5179E)",
      shadow: "shadow-purple-500/20",
      accent: "text-purple-900",
    },
    banner: {
      title: "TECH FEST",
      subtitle: "GADGETS",
      floatingElements: "tech",
      textColor: "text-white",
    },
  },
  {
    id: 2,
    name: "Grocery",
    icon: LocalGroceryStoreIcon,
    theme: {
      gradient: "linear-gradient(to bottom, #FF9F1C, #FFBF69)",
      shadow: "shadow-orange-500/20",
      accent: "text-orange-900",
    },
    banner: {
      title: "SUPERSAVER",
      subtitle: "FRESH & FAST",
      floatingElements: "leaves",
      textColor: "text-white",
    },
  },
  {
    id: 10,
    name: "Home & Kitchen",
    icon: KitchenIcon,
    theme: {
      gradient: "linear-gradient(to bottom, #BC6C25, #DDA15E)",
      shadow: "shadow-amber-500/20",
      accent: "text-amber-900",
    },
    banner: {
      title: "HOME",
      subtitle: "KITCHEN",
      floatingElements: "smoke",
      textColor: "text-white",
    },
  },
  {
    id: 7,
    name: "Kids",
    icon: ChildCareIcon,
    theme: {
      gradient: "linear-gradient(to bottom, #4CC9F0, #A0E7E5)",
      shadow: "shadow-blue-500/20",
      accent: "text-blue-900",
    },
    banner: {
      title: "LITTLE ONE",
      subtitle: "CARE",
      floatingElements: "bubbles",
      textColor: "text-white",
    },
  },
  {
    id: 8,
    name: "Pet Supplies",
    icon: PetsIcon,
    theme: {
      gradient: "linear-gradient(to bottom, #FB8500, #FFB703)",
      shadow: "shadow-yellow-500/20",
      accent: "text-yellow-900",
    },
    banner: {
      title: "PAWSOME",
      subtitle: "DEALS",
      floatingElements: "bones",
      textColor: "text-white",
    },
  },
  {
    id: 11,
    name: "Sports",
    icon: SportsSoccerIcon,
    theme: {
      gradient: "linear-gradient(to bottom, #4361EE, #4895EF)",
      shadow: "shadow-indigo-500/20",
      accent: "text-indigo-900",
    },
    banner: {
      title: "SPORTS",
      subtitle: "GEAR",
      floatingElements: "confetti",
      textColor: "text-white",
    },
  },
  {
    id: 3,
    name: "Wedding",
    icon: CardGiftcardIcon,
    theme: {
      gradient: "linear-gradient(to bottom, #FF4D6D, #FF8FA3)",
      shadow: "shadow-rose-500/20",
      accent: "text-rose-900",
    },
    banner: {
      title: "WEDDING",
      subtitle: "BLISS",
      floatingElements: "hearts",
      textColor: "text-white",
    },
  },
];

// Map icon ids saved from admin/category icon selector to MUI icons
const ICON_COMPONENTS = {
  electronics: DevicesIcon,
  fashion: CheckroomIcon,
  home: HomeIcon,
  food: LocalCafeIcon,
  sports: SportsSoccerIcon,
  books: MenuBookIcon,
  beauty: SpaIcon,
  toys: ToysIcon,
  automotive: DirectionsCarIcon,
  pets: PetsIcon,
  health: LocalHospitalIcon,
  garden: YardIcon,
  office: BusinessCenterIcon,
  music: MusicNoteIcon,
  jewelry: DiamondIcon,
  baby: ChildCareIcon,
  tools: BuildIcon,
  luggage: LuggageIcon,
  art: ColorLensIcon,
  grocery: LocalGroceryStoreIcon,
};

const bestsellerCategories = [
  {
    id: 1,
    name: "Chips & Namkeen",
    images: [
      "https://images.unsplash.com/photo-1566478989037-eec170784d0b?auto=format&fit=crop&q=80&w=200&h=200",
      "https://images.unsplash.com/photo-1613919113640-25732ec5e61f?auto=format&fit=crop&q=80&w=200&h=200",
      "https://images.unsplash.com/photo-1599490659223-e1539e76926a?auto=format&fit=crop&q=80&w=200&h=200",
      "https://images.unsplash.com/photo-1621444541669-451006c1103d?auto=format&fit=crop&q=80&w=200&h=200",
    ],
  },
  {
    id: 2,
    name: "Bakery & Biscuits",
    images: [
      "https://images.unsplash.com/photo-1558961363-fa8fdf82db35?auto=format&fit=crop&q=80&w=200&h=200",
      "https://images.unsplash.com/photo-1550617931-e17a7b70dce2?auto=format&fit=crop&q=80&w=200&h=200",
      "https://images.unsplash.com/photo-1597481499750-3e6b22637e12?auto=format&fit=crop&q=80&w=200&h=200",
      "https://images.unsplash.com/photo-1581339399838-2a120c18bba3?auto=format&fit=crop&q=80&w=200&h=200",
    ],
  },
  {
    id: 3,
    name: "Vegetable & Fruits",
    images: [
      "https://images.unsplash.com/photo-1610832958506-aa56368176cf?auto=format&fit=crop&q=80&w=200&h=200",
      "https://images.unsplash.com/photo-1518843025960-d70213740685?auto=format&fit=crop&q=80&w=200&h=200",
      "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&q=80&w=200&h=200",
      "https://images.unsplash.com/photo-1490818387583-1baba5e638af?auto=format&fit=crop&q=80&w=200&h=200",
    ],
  },
  {
    id: 4,
    name: "Oil, Ghee & Masala",
    images: [
      "https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?auto=format&fit=crop&q=80&w=200&h=200",
      "https://images.unsplash.com/photo-1596797038558-9c50f16ee64b?auto=format&fit=crop&q=80&w=200&h=200",
      "https://images.unsplash.com/photo-1506368249639-73a05d6f6488?auto=format&fit=crop&q=80&w=200&h=200",
      "https://images.unsplash.com/photo-1472141521881-95d0e87e2e39?auto=format&fit=crop&q=80&w=200&h=200",
    ],
  },
  {
    id: 5,
    name: "Sweet & Chocolates",
    images: [
      "https://images.unsplash.com/photo-1581798459219-318e76aecc7b?auto=format&fit=crop&q=80&w=200&h=200",
      "https://images.unsplash.com/photo-1481391243133-f96216dcb5d2?auto=format&fit=crop&q=80&w=200&h=200",
      "https://images.unsplash.com/photo-1526081347589-7fa3cb419ee7?auto=format&fit=crop&q=80&w=200&h=200",
      "https://images.unsplash.com/photo-1542841791-192d99906b27?auto=format&fit=crop&q=80&w=200&h=200",
    ],
  },
  {
    id: 6,
    name: "Drinks & Juices",
    images: [
      "https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&q=80&w=200&h=200",
      "https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&q=80&w=200&h=200",
      "https://images.unsplash.com/photo-1625772290748-39126cdd9fe9?auto=format&fit=crop&q=80&w=200&h=200",
      "https://images.unsplash.com/photo-1544145945-f904253db0ad?auto=format&fit=crop&q=80&w=200&h=200",
    ],
  },
];

const MARQUEE_MESSAGES = [
  "24/7 Delivery",
  "Minimum Order ₹99",
  "Save Big on Essentials!",
];

export {
  DEFAULT_CATEGORY_THEME,
  CATEGORY_METADATA,
  ALL_CATEGORY,
  ICON_COMPONENTS,
  MARQUEE_MESSAGES,
  bestsellerCategories as STATIC_BESTSELLER_CATEGORIES,
};
