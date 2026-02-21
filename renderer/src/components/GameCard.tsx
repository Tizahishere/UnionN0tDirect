// renderer/src/components/GameCard.tsx
import React from "react";
import { Star, Download } from "lucide-react";

export interface Game {
  appid: string;
  name: string;
  description?: string;
  image?: string;
  genres?: string[];
  release_date?: string;
  size?: string;
  source?: string;
  version?: string;
  update_time?: string;
  developer?: string;
  searchText?: string;
}

interface Props {
  game: Game;
  stats?: { downloads?: number; views?: number };
  isPopular?: boolean;
  isEditorPick?: boolean;
  onOpen?: (appid: string) => void;
  onFavoriteToggle?: (appid: string) => void;
  isFavorite?: boolean;
  compact?: boolean;
}

export const GameCard: React.FC<Props> = ({
  game,
  stats = {},
  isPopular = false,
  isEditorPick = false,
  onOpen,
  onFavoriteToggle,
  isFavorite = false,
  compact = false,
}) => {
  const badge = isEditorPick ? "Editor’s Pick" : isPopular ? "Popular" : undefined;
  const isNew =
    game.release_date && (Date.now() - new Date(game.release_date).getTime()) / (1000 * 60 * 60 * 24) <= 14;

  return (
    <div
      className={`rounded-xl overflow-hidden border border-border/30 bg-card transition-shadow hover:shadow-lg ${
        compact ? "flex gap-3 p-3 items-center" : ""
      }`}
      role="article"
      aria-label={game.name}
      onClick={() => onOpen?.(game.appid)}
    >
      {/* Thumbnail */}
      <div className={compact ? "w-20 flex-shrink-0" : "w-full h-44 md:h-36 lg:h-44"}>
        <img
          src={game.image || "/banner.png"}
          alt={game.name}
          className={`${compact ? "h-14 w-20 rounded-md object-cover" : "w-full h-full object-cover"}`}
          loading="lazy"
        />
      </div>

      {/* Body */}
      <div className={compact ? "flex-1" : "p-4"}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold truncate">{game.name}</h3>
            {!compact && <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{game.description}</p>}
            {compact && <div className="text-xs text-muted-foreground mt-1">{game.genres?.slice(0, 2).join(", ")}</div>}
          </div>

          <div className="flex-shrink-0 ml-2 flex items-start gap-2">
            {/* Badges */}
            <div className="flex flex-col gap-1 items-end">
              {badge && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500 text-black font-semibold">
                  {badge}
                </span>
              )}
              {isNew && <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-500 text-black">New</span>}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-3 flex items-center justify-between">
          <div className="text-xs text-muted-foreground">
            {game.developer ? (
              <span className="inline-block truncate max-w-[10rem]">{game.developer}</span>
            ) : (
              <span className="inline-block truncate max-w-[10rem]">{game.source || "Unknown source"}</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <div className="text-xs flex items-center gap-1 text-muted-foreground">
              <Download className="h-3 w-3" />
              <span>{stats.downloads ? stats.downloads.toLocaleString() : "—"}</span>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onFavoriteToggle?.(game.appid);
              }}
              aria-label={isFavorite ? "Unfavorite" : "Favorite"}
              className="text-muted-foreground hover:text-red-400 p-1 rounded"
            >
              <Star className={`h-4 w-4 ${isFavorite ? "text-yellow-400" : ""}`} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GameCard;