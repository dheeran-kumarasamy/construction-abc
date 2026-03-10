interface Props {
  isBookmarked: boolean;
  onToggle: () => void;
}

export default function BookmarkButton({ isBookmarked, onToggle }: Props) {
  return (
    <button type="button" className="pt-bookmark-btn" onClick={onToggle}>
      {isBookmarked ? "⭐ Bookmarked" : "☆ Bookmark"}
    </button>
  );
}
