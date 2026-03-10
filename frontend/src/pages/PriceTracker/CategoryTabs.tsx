import type { MaterialCategory } from "./types";

interface Props {
  categories: MaterialCategory[];
  activeCategoryId: string | null;
  onSelect: (categoryId: string) => void;
}

export default function CategoryTabs({ categories, activeCategoryId, onSelect }: Props) {
  return (
    <div className="pt-tabs" role="tablist" aria-label="Material Categories">
      {categories.map((category) => {
        const active = category.id === activeCategoryId;
        return (
          <button
            key={category.id}
            className={`pt-tab ${active ? "active" : ""}`}
            onClick={() => onSelect(category.id)}
            type="button"
            role="tab"
            aria-selected={active}
          >
            <span>{category.icon}</span> {category.name}
          </button>
        );
      })}
    </div>
  );
}
