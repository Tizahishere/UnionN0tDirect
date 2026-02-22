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
}

interface Props {
  game: Game;
  stats?: { downloads?: number; views?: number };
  isPopular?: boolean;
  isEditorPick?: boolean;
  onOpen?: (appid: string) => void;
  onFavoriteToggle?: (appid: string) => void;
  isFavorite?: boolean;
}

export const GameCard: React.FC<Props> = ({
  game,
  stats = {},
  isPopular = false,
  isEditorPick = false,
  onOpen,
  onFavoriteToggle,
  isFavorite = false,
}) => {
  const badge = isEditorPick
    ? "Editor’s Pick"
    : isPopular
    ? "Popular"
    : undefined;

  const isNew =
    game.release_date &&
    (Date.now() - new Date(game.release_date).getTime()) /
      (1000 * 60 * 60 * 24) <=
      14;

  return (
    <div
      onClick={() => onOpen?.(game.appid)}
      className="
        group relative cursor-pointer
        rounded-2xl overflow-hidden
        bg-gradient-to-br from-[#0f0a1f] via-[#140c2a] to-black
        border border-purple-900/40
        transition-all duration-300
        hover:scale-[1.04]
        hover:shadow-[0_0_25px_rgba(168,85,247,0.4)]
      "
    >
      {/* IMAGE SECTION */}
      <div className="relative h-48 overflow-hidden">
        <img
          src={game.image || "/banner.png"}
          alt={game.name}
          className="
            w-full h-full object-cover
            transition-transform duration-500
            group-hover:scale-110
          "
        />

        {/* Dark Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />

        {/* Floating Badges */}
        <div className="absolute top-3 left-3 flex gap-2">
          {badge && (
            <span className="text-[10px] px-3 py-1 rounded-full bg-purple-600 text-white font-semibold shadow-md">
              {badge}
            </span>
          )}
          {isNew && (
            <span className="text-[10px] px-3 py-1 rounded-full bg-pink-500 text-white shadow-md">
              NEW
            </span>
          )}
        </div>
      </div>

      {/* CONTENT */}
      <div className="p-4">
        {/* Title */}
        <h3 className="text-white font-semibold text-lg truncate group-hover:text-purple-400 transition-colors">
          {game.name}
        </h3>

        {/* Description */}
        <p className="text-gray-400 text-sm mt-1 line-clamp-2">
          {game.description}
        </p>

        {/* Genres */}
        {game.genres && (
          <div className="flex flex-wrap gap-2 mt-3">
            {game.genres.slice(0, 3).map((genre) => (
              <span
                key={genre}
                className="text-[11px] px-2 py-1 rounded-md bg-purple-900/40 text-purple-300"
              >
                {genre}
              </span>
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="mt-4 flex items-center justify-between">
          {/* Developer */}
          <span className="text-xs text-gray-500 truncate max-w-[8rem]">
            {game.developer || game.source || "Unknown"}
          </span>

          {/* Right Side Stats */}
          <div className="flex items-center gap-3">
            <div className="text-xs flex items-center gap-1 text-gray-400">
              <Download className="h-3 w-3 text-purple-400" />
              <span>
                {stats.downloads
                  ? stats.downloads.toLocaleString()
                  : "—"}
              </span>
            </div>

            <button
              onClick={(e) => {
                e.stopPropagation();
                onFavoriteToggle?.(game.appid);
              }}
              className="
                p-1 rounded
                text-gray-400
                hover:text-yellow-400
                transition-colors
              "
            >
              <Star
                className={`h-4 w-4 ${
                  isFavorite ? "text-yellow-400 fill-yellow-400" : ""
                }`}
              />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GameCard;