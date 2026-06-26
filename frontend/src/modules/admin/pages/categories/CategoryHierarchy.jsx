import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutGrid,
  ChevronRight,
  Search,
  FolderOpen,
  Tag,
  Layers,
  ArrowRight,
} from "lucide-react";
import { adminApi } from "../../services/adminApi";
import Card from "@shared/components/ui/Card";
import Badge from "@shared/components/ui/Badge";
import { toast } from "sonner";
import { useDebouncedValue, DEBOUNCE_MS } from "@shared/hooks/useDebounce";

const CategoryHierarchy = () => {
  const [categories, setCategories] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearchTerm = useDebouncedValue(searchTerm, DEBOUNCE_MS.filter);
  const [selectedParent, setSelectedParent] = useState(null);

  const stats = useMemo(() => {
    let parents = 0;
    let subs = 0;
    const traverse = (items) => {
      items.forEach((item) => {
        if (item.type === "category") parents++;
        if (item.type === "subcategory") subs++;
        if (item.children) traverse(item.children);
      });
    };
    traverse(categories);
    return { parents, subs, total: parents + subs };
  }, [categories]);

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    setIsLoading(true);
    try {
      const res = await adminApi.getCategoryTree();
      if (res.data.success) {
        setCategories(res.data.results || res.data.result || []);
      }
    } catch (error) {
      toast.error("Failed to fetch category hierarchy");
    } finally {
      setIsLoading(false);
    }
  };

  const filteredParents = useMemo(() => {
    const roots = categories.filter(
      (c) => c && c.type === "category" && (!c.parentId || c.parentId === null),
    );
    if (!debouncedSearchTerm) return roots;
    return roots.filter((c) =>
      c.name.toLowerCase().includes(debouncedSearchTerm.toLowerCase()),
    );
  }, [categories, debouncedSearchTerm]);

  const activeSubs = useMemo(() => {
    if (!selectedParent) return [];
    return selectedParent.children || [];
  }, [selectedParent]);

  const handleParentSelect = (parent) => {
    setSelectedParent(parent);
  };

  const ColumnHeader = ({ title, icon: Icon, count, color }) => (
    <div
      className={`p-4 border-b border-gray-100 bg-white sticky top-0 z-10 flex items-center justify-between ${color}`}>
      <div className="flex items-center gap-2 font-bold text-gray-700">
        <Icon className="w-4 h-4" />
        <span>{title}</span>
      </div>
      <Badge variant="neutral" className="bg-gray-100 text-gray-600 font-mono">
        {count}
      </Badge>
    </div>
  );

  const ListItem = ({ item, isSelected, onClick, hasChildren, type }) => {
    const activeClass = isSelected
      ? "bg-indigo-50 border-indigo-200 text-indigo-700 shadow-sm z-10"
      : "hover:bg-gray-50 border-transparent text-gray-600";

    const iconColor = isSelected ? "text-indigo-500" : "text-gray-400";

    return (
      <motion.div
        layout
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        onClick={onClick}
        className={`
                    group flex items-center justify-between p-3 mx-2 my-1 rounded-lg border cursor-pointer transition-all duration-200
                    ${activeClass}
                `}>
        <div className="flex items-center gap-3 overflow-hidden">
          <div
            className={`
                        w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors
                        ${isSelected ? "bg-white shadow-sm" : "bg-gray-100 group-hover:bg-white group-hover:shadow-sm"}
                    `}>
            {item.image?.url || item.image ? (
              <img
                src={item.image?.url || item.image}
                alt=""
                className="w-full h-full object-cover rounded-lg"
              />
            ) : type === "category" ? (
              <FolderOpen className={`w-4 h-4 ${iconColor}`} />
            ) : (
              <Tag className={`w-4 h-4 ${iconColor}`} />
            )}
          </div>
          <div className="flex flex-col overflow-hidden">
            <span className="font-semibold text-sm truncate">{item.name}</span>
            <span className="text-[10px] uppercase tracking-wider opacity-60 truncate">
              {item.slug}
            </span>
          </div>
        </div>

        {hasChildren && (
          <ChevronRight
            className={`w-4 h-4 ${isSelected ? "text-indigo-400" : "text-gray-300"}`}
          />
        )}
      </motion.div>
    );
  };

  return (
    <div className="h-[calc(100vh-100px)] flex flex-col gap-4 animate-in fade-in duration-500">
      <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-gray-100 shadow-sm shrink-0">
        <div>
          <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <Layers className="w-6 h-6 text-indigo-600" />
            Category hierarchy
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Parent categories and their subcategories ({stats.total} items)
          </p>
        </div>

        <div className="flex items-center gap-6">
          <div className="flex items-center gap-4 text-sm text-gray-500 bg-gray-50 px-4 py-2 rounded-xl">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
              <span>
                Parents: <b>{stats.parents}</b>
              </span>
            </div>
            <div className="w-px h-4 bg-gray-300"></div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span>
                Subcategories: <b>{stats.subs}</b>
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-2 md:grid-rows-[minmax(0,1fr)] gap-4 overflow-hidden">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm flex flex-col overflow-hidden min-h-0 h-full">
          <ColumnHeader
            title="Parent categories"
            icon={LayoutGrid}
            count={filteredParents.length}
            color="border-l-4 border-l-indigo-500"
          />

          <div className="p-2 border-b border-gray-100">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Filter parents..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-gray-50 border-none rounded-lg text-sm focus:ring-2 focus:ring-indigo-100 transition-all"
              />
            </div>
          </div>

          <div
            className="flex-1 min-h-0 overflow-y-auto py-2 custom-scrollbar overscroll-contain touch-pan-y"
            tabIndex={0}
            onWheel={(e) => e.stopPropagation()}
            onTouchMove={(e) => e.stopPropagation()}
          >
            {isLoading ? (
              <div className="p-8 text-center text-gray-400 text-sm">
                Loading structure...
              </div>
            ) : filteredParents.length === 0 ? (
              <div className="p-8 text-center text-gray-400 text-sm">
                No parent categories found
              </div>
            ) : (
              filteredParents.map((parent) => (
                <ListItem
                  key={parent._id || parent.id}
                  item={parent}
                  type="category"
                  isSelected={
                    selectedParent &&
                    (selectedParent._id || selectedParent.id) ===
                      (parent._id || parent.id)
                  }
                  onClick={() => handleParentSelect(parent)}
                  hasChildren={parent.children && parent.children.length > 0}
                />
              ))
            )}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm flex flex-col overflow-hidden min-h-0 h-full">
          <ColumnHeader
            title="Subcategories"
            icon={Tag}
            count={activeSubs.length}
            color="border-l-4 border-l-emerald-500"
          />

          {!selectedParent ? (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-400 p-8 text-center bg-gray-50/50">
              <ArrowRight className="w-12 h-12 mb-3 opacity-20" />
              <p className="text-sm">
                Select a parent category
                <br />
                to view subcategories
              </p>
            </div>
          ) : (
            <div
              className="flex-1 min-h-0 overflow-y-auto py-2 custom-scrollbar overscroll-contain touch-pan-y"
              tabIndex={0}
              onWheel={(e) => e.stopPropagation()}
              onTouchMove={(e) => e.stopPropagation()}
            >
              {activeSubs.length === 0 ? (
                <div className="p-8 text-center text-gray-400 text-sm">
                  No subcategories under <br />
                  <span className="font-bold text-gray-600">
                    &quot;{selectedParent.name}&quot;
                  </span>
                </div>
              ) : (
                activeSubs.map((sub) => (
                  <ListItem
                    key={sub._id || sub.id}
                    item={sub}
                    type="subcategory"
                    isSelected={false}
                    onClick={() => {}}
                    hasChildren={false}
                  />
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CategoryHierarchy;
