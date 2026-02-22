import React, {
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  startTransition,
} from "react";
import { useNavigate } from "react-router-dom";

import { GameCard } from "@/components/GameCard";
import { GameCardCompact } from "@/components/GameCardCompact";
import { GameCardSkeleton } from "@/components/GameCardSkeleton";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorMessage } from "@/components/ErrorMessage";
import { RateLimitError } from "@/components/RateLimitError";
import { AnimatedCounter } from "@/components/AnimatedCounter";
import { OfflineBanner } from "@/components/OfflineBanner";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

import { apiUrl } from "@/lib/api";
import { formatNumber, generateErrorCode, ErrorTypes } from "@/lib/utils";
import { useOnlineStatus } from "@/hooks/use-online-status";

import {
  Hammer,
  Sun,
  Moon,
  Heart,
  ChevronUp,
  Grid,
  List,
  Star,
  Download,
  Clock,
} from "lucide-react";

interface Game {
  appid: string;
  name: string;
  description: string;
  genres: string[];
  image: string;
  release_date?: string;
  size?: string;
  source?: string;
  version?: string;
  update_time?: string;
  searchText?: string;
  developer?: string;
  hasCoOp?: boolean;
  addedAt?: number;
}

class GamesFetchError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = "GamesFetchError";
    this.status = status;
  }
}

const normalizeSearchText = (text = ""): string =>
  text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

function useDebounced<T>(value: T, delay = 260) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export function LauncherPage(): JSX.Element {
  const navigate = useNavigate();
  const isOnline = useOnlineStatus();

  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState("");
  const debouncedSearch = useDebounced(searchInput, 260);
  const [refreshing, setRefreshing] = useState(false);
  const [gameStats, setGameStats] = useState<Record<string, { downloads: number; views: number }>>({});
  const [refreshKey, setRefreshKey] = useState(0);
  const [gamesError, setGamesError] = useState<{ type: string; message: string; code: string } | null>(null);
  const [hasLoadedGames, setHasLoadedGames] = useState(false);
  const [emptyStateReady, setEmptyStateReady] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [useHybridLoadMore, setUseHybridLoadMore] = useState(true);

  const [recentlyInstalledGames, setRecentlyInstalledGames] = useState<Game[]>([]);
  const [shortcutLabel, setShortcutLabel] = useState("Ctrl+K");
  const [statsCacheTime, setStatsCacheTime] = useState<number>(0);
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    try {
      return (localStorage.getItem("uc_theme") as "dark" | "light") || "dark";
    } catch {
      return "dark";
    }
  });
  const [viewMode, setViewMode] = useState<"grid" | "compact">(() => {
    try {
      return (localStorage.getItem("uc_view_mode") as "grid" | "compact") || "grid";
    } catch {
      return "grid";
    }
  });

  const [favorites, setFavorites] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("uc_favorites") || "[]");
    } catch {
      return [];
    }
  });
  const [recentlyViewed, setRecentlyViewed] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("uc_recently_viewed") || "[]");
    } catch {
      return [];
    }
  });

  const [modalOpen, setModalOpen] = useState(false);
  const [modalGame, setModalGame] = useState<Game | null>(null);
  const [spotlightIndex, setSpotlightIndex] = useState(0);
  const spotlightTimerRef = useRef<number | null>(null);

  const [showBackToTop, setShowBackToTop] = useState(false);

  const activeLoadIdRef = useRef(0);

  useEffect(() => {
    if (typeof navigator !== "undefined") {
      const isMac = /Mac|iPhone|iPad|iPod/.test(navigator.platform);
      setShortcutLabel(isMac ? "Cmd+K" : "Ctrl+K");
    }
  }, []);

  useEffect(() => {
    try {
      document.documentElement.classList.toggle("dark", theme === "dark");
      localStorage.setItem("uc_theme", theme);
    } catch {}
  }, [theme]);

  useEffect(() => {
    try {
      localStorage.setItem("uc_view_mode", viewMode);
    } catch {}
  }, [viewMode]);

  useEffect(() => {
    try {
      localStorage.setItem("uc_favorites", JSON.stringify(favorites));
    } catch {}
  }, [favorites]);

  useEffect(() => {
    try {
      localStorage.setItem("uc_recently_viewed", JSON.stringify(recentlyViewed));
    } catch {}
  }, [recentlyViewed]);

  useEffect(() => {
    const onScroll = () => setShowBackToTop(window.scrollY > 600);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const sleep = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

  const isTransientGamesFetchError = (error: unknown): boolean => {
    if (error instanceof TypeError) return true;
    const status = error instanceof GamesFetchError ? error.status : undefined;
    return status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
  };

  const fetchGameStats = useCallback(
    async (forceRefresh = false) => {
      try {
        if (!forceRefresh && Object.keys(gameStats).length > 0) {
          const now = Date.now();
          const recentCache = now - statsCacheTime < 30000;
          if (recentCache) return;
        }

        const response = await fetch(apiUrl("/api/downloads/all"));

        if (response.status === 429) {
          setGamesError({
            type: "rate-limit",
            message: "Please wait.",
            code: generateErrorCode(ErrorTypes.DOWNLOADS_FETCH, "launcher-stats"),
          });
          return;
        }

        if (!response.ok) {
          throw new Error(`Stats API route failed: ${response.status}`);
        }

        const data = await response.json();
        if (data && typeof data === "object") {
          startTransition(() => {
            setGameStats(data);
            setStatsCacheTime(Date.now());
          });
        }
      } catch (error) {
        console.error("[UC] Error fetching game stats:", error);
      }
    },
    [gameStats, statsCacheTime]
  );

  const fetchGames = useCallback(async (): Promise<Game[]> => {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      return [];
    }

    const response = await fetch(apiUrl("/api/games"));

    if (!response.ok) {
      throw new GamesFetchError(`API route failed: ${response.status}`, response.status);
    }

    const data = await response.json();
    return (Array.isArray(data) ? data : []).map((game: any) => ({
      appid: String(game.appid ?? game.id ?? ""),
      name: String(game.name ?? game.title ?? "Unknown"),
      description: String(game.description ?? ""),
      genres: Array.isArray(game.genres) ? game.genres : (typeof game.genres === "string" ? game.genres.split(",").map((s: string) => s.trim()) : []),
      image: String(game.image ?? "/banner.png"),
      release_date: game.release_date ?? game.releaseDate ?? undefined,
      size: game.size ?? undefined,
      source: game.source ?? undefined,
      version: game.version ?? undefined,
      update_time: game.update_time ?? game.updatedAt ?? undefined,
      developer: game.developer ?? undefined,
      hasCoOp: !!game.hasCoOp,
      addedAt: typeof game.addedAt === "number" ? game.addedAt : undefined,
      searchText: normalizeSearchText(`${game.name ?? game.title ?? ""} ${game.description ?? ""} ${(Array.isArray(game.genres) ? game.genres.join(" ") : "")}`),
    }));
  }, []);

  const loadGames = useCallback(
    async (forceRefresh = false) => {
      const loadId = ++activeLoadIdRef.current;
      const isInitialLoad = !hasLoadedGames && games.length === 0;
      const maxAttempts = isInitialLoad ? 8 : 2;

      let refreshStart: number | null = null;
      if (isInitialLoad) setLoading(true);
      if (forceRefresh) {
        setRefreshing(true);
        refreshStart = Date.now();
      }
      setGamesError(null);

      for (let attempt = 0; attempt <= maxAttempts; attempt++) {
        try {
          const gamesData = await fetchGames();
          if (loadId !== activeLoadIdRef.current) return;

          const sanitized = gamesData
            .filter(Boolean)
            .map((g) => ({
              ...g,
              genres: Array.isArray(g.genres) ? g.genres : [],
              searchText: g.searchText ?? normalizeSearchText(`${g.name} ${g.description} ${(g.genres || []).join(" ")}`),
              developer: g.developer && g.developer !== "Unknown" ? g.developer : (() => {
                const match = (g.description || "").match(/(?:by|from|developer|dev|studio)\s+([^.,\n]+)/i);
                return match ? match[1].trim() : "Unknown";
              })(),
            }));

          startTransition(() => {
            setGames(sanitized);
            setHasLoadedGames(true);
          });

          if (sanitized.length > 0) {
            await fetchGameStats(forceRefresh);
          }

          setLoading(false);
          if (refreshStart !== null) {
            const elapsed = Date.now() - refreshStart;
            const minDuration = 500;
            if (elapsed < minDuration) {
              setTimeout(() => setRefreshing(false), minDuration - elapsed);
            } else {
              setRefreshing(false);
            }
          } else {
            setRefreshing(false);
          }
          return;
        } catch (error) {
          if (loadId !== activeLoadIdRef.current) return;

          if (typeof navigator !== "undefined" && !navigator.onLine) {
            setLoading(false);
            setRefreshing(false);
            return;
          }

          const transient = isOnline && isTransientGamesFetchError(error);
          const hasMoreAttempts = attempt < maxAttempts;

          if (transient && hasMoreAttempts) {
            const delayMs = Math.min(8000, 500 * Math.pow(2, attempt));
            await sleep(delayMs);
            continue;
          }

          console.error("Error loading games:", error);

          if (error instanceof GamesFetchError && error.status === 429) {
            setGamesError({
              type: "rate-limit",
              message: "Rate limit encountered.",
              code: generateErrorCode(ErrorTypes.GAME_FETCH, "launcher"),
            });
          } else {
            setGamesError({
              type: "games",
              message:
                error instanceof GamesFetchError && error.status
                  ? `Unable to load games (Status: ${error.status}).`
                  : "Unable to load games. Please try again later.",
              code: generateErrorCode(ErrorTypes.GAME_FETCH, "launcher"),
            });
          }
          setLoading(false);
          setRefreshing(false);
          return;
        }
      }
    },
    [fetchGames, fetchGameStats, games.length, hasLoadedGames, isOnline]
  );

  useEffect(() => {
    void loadGames();
  }, [loadGames]);

  useEffect(() => {
    let ignore = false;
    const loadInstalled = async () => {
      const installedMap = new Map<string, Game>();
      try {
        if (typeof window !== "undefined") {
          const installedList =
            ((await (window as any).ucDownloads?.listInstalledGlobal?.()) as any[]) ||
            ((await (window as any).ucDownloads?.listInstalled?.()) as any[]) ||
            [];

          for (const entry of installedList) {
            const meta = (entry && (entry.metadata || entry.game)) || entry;
            if (meta && meta.appid) {
              installedMap.set(meta.appid, {
                ...meta,
                appid: meta.appid,
                name: meta.name || meta.appid,
                image: meta.image || "/banner.png",
                genres: Array.isArray(meta.genres) ? meta.genres : [],
                addedAt: meta.addedAt ?? meta.added_at ?? undefined,
              });
            }
          }
        }
      } catch {}
      const installedGames = Array.from(installedMap.values());
      installedGames.sort((a: any, b: any) => (b.addedAt || 0) - (a.addedAt || 0));
      if (!ignore) setRecentlyInstalledGames(installedGames.slice(0, 10));
    };

    void loadInstalled();
    return () => {
      ignore = true;
    };
  }, [refreshKey]);

  const [searchSuggestions, setSearchSuggestions] = useState<{ appid: string; name: string }[]>([]);

  useEffect(() => {
    if (!debouncedSearch || debouncedSearch.trim().length === 0) {
      setSearchSuggestions([]);
      return;
    }
    const q = normalizeSearchText(debouncedSearch);
    const matches = games.filter((g) => g.searchText?.includes(q)).slice(0, 8).map((g) => ({ appid: g.appid, name: g.name }));
    setSearchSuggestions(matches);
  }, [debouncedSearch, games]);

  const newReleases = useMemo(() => games.slice(0, 8), [games]);

  const popularReleases = useMemo(() => {
    if (Object.keys(gameStats).length === 0) return [];
    const getDaysDiff = (dateStr?: string) => {
      if (!dateStr) return 999;
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return 999;
      const now = new Date();
      const diffTime = Math.abs(now.getTime() - date.getTime());
      return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    };
    const isRecent = (dateStr?: string, days = 30) => getDaysDiff(dateStr) <= days;
    const calculateScore = (game: Game) => {
      const stats = gameStats[game.appid] || { downloads: 0, views: 0 };
      let score = stats.downloads * 2 + stats.views * 0.5;
      if (isRecent(game.release_date, 30)) score += 500;
      if (isRecent(game.update_time, 14)) score += 300;
      return score;
    };
    const candidates = games.filter((g) => !(Array.isArray(g.genres) && g.genres.some((genre) => genre?.toLowerCase() === "nsfw")));
    const sorted = [...candidates].sort((a, b) => calculateScore(b) - calculateScore(a));
    return sorted.slice(0, 8);
  }, [games, gameStats]);

  const popularAppIds = useMemo(() => new Set(popularReleases.map((g) => g.appid)), [popularReleases]);

  const featuredForDisplay = useMemo(() => {
    if (games.length === 0) return [];
    return refreshKey > 0 ? [...games].sort(() => Math.random() - 0.5) : games;
  }, [games, refreshKey]);

  useEffect(() => {
    setCurrentPage(1);
  }, [featuredForDisplay]);

  const paginatedFeaturedGames = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return featuredForDisplay.slice(startIndex, endIndex);
  }, [featuredForDisplay, currentPage, itemsPerPage]);

  const totalPages = Math.max(1, Math.ceil(featuredForDisplay.length / itemsPerPage));
  const startItem = (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, featuredForDisplay.length);

  const stats = useMemo(() => {
    const totalSizeGB = games.reduce((acc, game) => {
      const sizeMatch = (game.size || "").match(/(\d+(?:\.\d+)?)\s*(GB|MB)/i);
      if (sizeMatch) {
        const size = Number.parseFloat(sizeMatch[1]);
        const unit = sizeMatch[2].toUpperCase();
        if (!isNaN(size) && size > 0) {
          return acc + (unit === "GB" ? size : size / 1024);
        }
      }
      return acc;
    }, 0);
    const totalSizeTB = totalSizeGB > 0 ? Math.round((totalSizeGB / 1024) * 10) / 10 : 0;
    const totalDownloads = Object.values(gameStats).reduce((acc, stat) => acc + (stat.downloads || 0), 0);
    return {
      totalGames: games.length,
      totalSizeGB: Math.round(totalSizeGB * 10) / 10,
      totalSizeTB,
      totalDownloads,
    };
  }, [games, gameStats]);

  const toggleFavorite = useCallback((appid: string) => {
    setFavorites((prev) => {
      const next = prev.includes(appid) ? prev.filter((p) => p !== appid) : [appid, ...prev];
      return next;
    });
  }, []);

  const addRecentlyViewed = useCallback((appid: string) => {
    setRecentlyViewed((prev) => {
      const next = [appid, ...prev.filter((p) => p !== appid)].slice(0, 12);
      return next;
    });
  }, []);

  const openGameModal = useCallback((game: Game) => {
    setModalGame(game);
    setModalOpen(true);
    addRecentlyViewed(game.appid);
    try {
      if ((window as any).ipcRenderer?.invoke) {
        (window as any).ipcRenderer.invoke("set-discord-activity", {
          details: `Browsing ${game.name}`,
          state: "Union Crax NotDirect",
          largeImageKey: "logo",
          startTimestamp: Date.now(),
        });
      }
    } catch {}
  }, [addRecentlyViewed]);

  const goToGame = useCallback((appid: string) => {
    addRecentlyViewed(appid);
    navigate(`/game/${encodeURIComponent(appid)}`);
  }, [navigate, addRecentlyViewed]);

  const copyGameLink = async (appid: string) => {
    const url = `${window.location.origin}/game/${encodeURIComponent(appid)}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {}
  };

  const handleSearchSubmit = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      if (searchInput.trim()) navigate(`/search?q=${encodeURIComponent(searchInput.trim())}`);
    },
    [searchInput, navigate]
  );

  const handleRefresh = useCallback(() => {
    setRefreshKey((p) => p + 1);
    void loadGames(true);
  }, [loadGames]);

  useEffect(() => {
    if (spotlightTimerRef.current) {
      window.clearInterval(spotlightTimerRef.current);
      spotlightTimerRef.current = null;
    }
    if (featuredForDisplay.length > 1) {
      spotlightTimerRef.current = window.setInterval(() => {
        setSpotlightIndex((s) => (s + 1) % featuredForDisplay.length);
      }, 7000);
    }
    return () => {
      if (spotlightTimerRef.current) window.clearInterval(spotlightTimerRef.current);
      spotlightTimerRef.current = null;
    };
  }, [featuredForDisplay.length]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      const isMac = /Mac|iPhone|iPad|iPod/.test(navigator.platform);
      const mod = isMac ? e.metaKey : e.ctrlKey;
      if (mod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        const el = document.querySelector<HTMLInputElement>("#uc-search-input");
        el?.focus();
      } else if (e.key === "/") {
        const el = document.querySelector<HTMLInputElement>("#uc-search-input");
        if (document.activeElement !== el) {
          e.preventDefault();
          el?.focus();
        }
      } else if (e.key === "Escape") {
        setModalOpen(false);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  if (gamesError?.type === "rate-limit" && isOnline && !loading) {
    return (
      <RateLimitError
        message={gamesError.message}
        errorCode={gamesError.code}
        retry={() => {
          setGamesError(null);
          setLoading(true);
          void loadGames(true);
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <section id="hero" className="relative py-6 sm:py-8 px-4 border-b border-border/40 bg-card/10 sticky top-0 z-30">
        <div className="container mx-auto max-w-7xl flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-2 rounded-lg bg-gradient-to-br from-primary to-purple-500 text-white shadow">
              <Hammer className="h-7 w-7" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black">Union Crax Direct Refined</h1>
              <p className="text-xs text-muted-foreground">Fork Made By Underscore111_</p>
            </div>
          </div>

          <div className="flex-1 max-w-3xl">
            <form onSubmit={handleSearchSubmit} className="relative">
              <input
                id="uc-search-input"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder={`Search games (${shortcutLabel})`}
                className="w-full rounded-full border border-input px-4 py-2 pr-28 bg-card/40 placeholder:text-muted-foreground"
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={() => { setSearchInput(""); document.getElementById("uc-search-input")?.focus(); }}>
                  Clear
                </Button>
                <Button size="sm" onClick={() => { if (searchInput.trim()) navigate(`/search?q=${encodeURIComponent(searchInput.trim())}`); }}>
                  Search
                </Button>
              </div>

              {searchSuggestions.length > 0 && searchInput.trim() && (
                <div className="absolute left-0 right-0 mt-2 bg-card border rounded-md overflow-auto max-h-52 z-40">
                  {searchSuggestions.map((s) => (
                    <button
                      key={s.appid}
                      onClick={() => navigate(`/game/${encodeURIComponent(s.appid)}`)}
                      className="w-full text-left px-3 py-2 hover:bg-muted/20"
                    >
                      {s.name}
                    </button>
                  ))}
                </div>
              )}
            </form>
          </div>

          <div className="flex items-center gap-2">
            <button
              aria-label="Toggle theme"
              onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
              className="p-2 rounded border hover:bg-muted/10"
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>

            <button
              aria-label="Toggle view"
              onClick={() => setViewMode((v) => (v === "grid" ? "compact" : "grid"))}
              className="p-2 rounded border hover:bg-muted/10"
            >
              {viewMode === "grid" ? <Grid className="h-4 w-4" /> : <List className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </section>

      <section className="py-8 px-4">
        <div className="container mx-auto max-w-7xl">
          <div className="rounded-2xl overflow-hidden border border-border/30 bg-gradient-to-br from-card to-card/60 p-4">
            {featuredForDisplay.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
                <div className="md:col-span-2">
                  <div className="relative rounded-lg overflow-hidden h-56 md:h-72">
                    <img
                      src={featuredForDisplay[spotlightIndex]?.image || "/banner.png"}
                      alt={featuredForDisplay[spotlightIndex]?.name || "Spotlight"}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent flex items-end p-6">
                      <div>
                        <h2 className="text-2xl font-black text-white">{featuredForDisplay[spotlightIndex]?.name}</h2>
                        <p className="text-sm text-white/90 mt-1 line-clamp-2">{featuredForDisplay[spotlightIndex]?.description}</p>
                        <div className="mt-3 flex gap-2">
                          <Button onClick={() => featuredForDisplay[spotlightIndex] && openGameModal(featuredForDisplay[spotlightIndex])}>Open</Button>
                          <Button variant="outline" onClick={() => featuredForDisplay[spotlightIndex] && window.open(featuredForDisplay[spotlightIndex].source || "#", "_blank")}>Source</Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="md:col-span-1 space-y-3">
                  <div className="p-4 rounded-lg bg-card border border-border/20">
                    <div className="text-xs text-muted-foreground">Total Storage*</div>
                    <div className="text-lg font-bold">
                      {stats.totalSizeGB >= 1024 ? <AnimatedCounter value={stats.totalSizeTB} suffix="TB" /> : stats.totalSizeGB && stats.totalSizeGB > 0 ? <AnimatedCounter value={stats.totalSizeGB} suffix="GB" /> : "?"}
                    </div>
                    <div className="text-xs text-muted-foreground mt-2">* Estimation across hosts</div>
                  </div>

                  <div className="p-4 rounded-lg bg-card border border-border/20">
                    <div className="text-xs text-muted-foreground">Games</div>
                    <div className="text-lg font-bold">{stats.totalGames === 0 ? "?" : <AnimatedCounter value={stats.totalGames} format={formatNumber} />}</div>
                    <div className="text-xs text-muted-foreground mt-2">Downloads: {stats.totalDownloads === 0 ? "?" : formatNumber(stats.totalDownloads)}</div>
                  </div>

                  <div className="p-3 rounded-lg bg-card/50 border border-border/20">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-semibold">Favorites</div>
                      <button onClick={() => setFavorites([])} className="text-xs text-muted-foreground">Clear</button>
                    </div>

                    <div className="mt-2 flex gap-2 overflow-x-auto py-2">
                      {favorites.length === 0 ? (
                        <div className="text-xs text-muted-foreground">No favorites yet</div>
                      ) : (
                        favorites.map((appid) => {
                          const g = games.find((gg) => gg.appid === appid);
                          if (!g) return null;
                          return (
                            <button key={appid} onClick={() => openGameModal(g)} className="flex-shrink-0">
                              <img src={g.image} alt={g.name} className="h-16 w-28 object-cover rounded-md" loading="lazy" />
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-12">
                <p className="text-muted-foreground">No spotlight games available</p>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="py-6 px-4 border-y border-border/40">
        <div className="container mx-auto max-w-7xl flex flex-col lg:flex-row gap-4 items-start">
          <div className="flex-1">
            <div className="flex gap-3 items-center mb-3">
              <div className="relative w-full md:w-2/3">
                <input
                  id="uc-search-input-2"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder={`Search games (${shortcutLabel})`}
                  className="w-full px-4 py-3 rounded-xl border bg-card/20"
                />
                {searchSuggestions.length > 0 && searchInput.trim() && (
                  <div className="absolute left-0 right-0 mt-2 bg-card border rounded-md z-40 max-h-52 overflow-auto">
                    {searchSuggestions.map((s) => (
                      <button key={s.appid} onClick={() => navigate(`/game/${encodeURIComponent(s.appid)}`)} className="w-full text-left px-3 py-2 hover:bg-muted/10">
                        {s.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <Button size="sm" variant="outline" onClick={() => { setSearchInput(""); document.getElementById("uc-search-input-2")?.focus(); }}>
                Clear
              </Button>

              <Button size="sm" onClick={() => { setRefreshKey((p) => p + 1); void loadGames(true); }} disabled={refreshing}>
                {refreshing ? "Refreshing..." : "Refresh"}
              </Button>
            </div>

            <div className="flex items-center gap-3 flex-wrap text-sm">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">View:</span>
                <button onClick={() => setViewMode("grid")} className={`px-3 py-1 rounded ${viewMode === "grid" ? "bg-primary text-white" : "bg-card/20"}`}>Grid</button>
                <button onClick={() => setViewMode("compact")} className={`px-3 py-1 rounded ${viewMode === "compact" ? "bg-primary text-white" : "bg-card/20"}`}>Compact</button>
              </div>

              <div className="ml-auto flex items-center gap-2">
                <label className="text-sm text-muted-foreground mr-2">Items per page</label>
                <select value={itemsPerPage} onChange={(e) => { const v = Number(e.target.value); setItemsPerPage(v); setCurrentPage(1); }} className="px-3 py-1 rounded border bg-card/20">
                  <option value={12}>12</option>
                  <option value={20}>20</option>
                  <option value={40}>40</option>
                </select>
                <label className="ml-3 text-sm">
                  <input type="checkbox" checked={useHybridLoadMore} onChange={(e) => setUseHybridLoadMore(e.target.checked)} /> Use hybrid (pages + load more)
                </label>
              </div>
            </div>
          </div>

          <aside className="w-full lg:w-72 space-y-3">
            {recentlyInstalledGames.length > 0 && (
              <div className="rounded-2xl p-3 bg-card border border-border/20">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold">Recently Installed</h4>
                  <button onClick={() => setRecentlyInstalledGames([])} className="text-xs text-muted-foreground">Clear</button>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {recentlyInstalledGames.map((g) => (
                    <button key={g.appid} onClick={() => openGameModal(g)} className="text-left">
                      <img src={g.image} className="h-16 w-full object-cover rounded" alt={g.name} />
                      <div className="text-xs mt-1">{g.name}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="rounded-2xl p-3 bg-card border border-border/20">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold">Recently Viewed</h4>
                <button onClick={() => setRecentlyViewed([])} className="text-xs text-muted-foreground">Clear</button>
              </div>

              <div className="mt-3 space-y-2">
                {recentlyViewed.length === 0 ? <div className="text-xs text-muted-foreground">Open games to populate this list</div> : recentlyViewed.map((appid) => {
                  const g = games.find((x) => x.appid === appid);
                  if (!g) return null;
                  return (
                    <div key={appid} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <img src={g.image} alt={g.name} className="h-10 w-16 object-cover rounded" />
                        <div>
                          <div className="text-sm">{g.name}</div>
                          <div className="text-xs text-muted-foreground">{g.developer || g.genres?.[0]}</div>
                        </div>
                      </div>
                      <div>
                        <button onClick={() => goToGame(appid)} className="text-xs">Open</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </aside>
        </div>
      </section>

      <main className="py-8 px-4">
        <div className="container mx-auto max-w-7xl">
          <section className="mb-10">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h2 className="text-3xl font-black">Most Popular</h2>
                <p className="text-sm text-muted-foreground">Top trending downloads</p>
              </div>
            </div>

            {loading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {Array.from({ length: 4 }).map((_, i) => <GameCardSkeleton key={i} />)}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                {popularReleases.map((g) => (
                  <div key={g.appid} onClick={() => openGameModal(g)}><GameCard game={g} stats={gameStats[g.appid]} isPopular /></div>
                ))}
              </div>
            )}
          </section>

          <section id="featured" className="py-6">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h2 className="text-3xl font-black">All Games</h2>
                <p className="text-sm text-muted-foreground">Showing {startItem}-{endItem} of {featuredForDisplay.length}</p>
              </div>

              <div className="flex items-center gap-3">
                <Button variant="outline" size="sm" onClick={() => { setRefreshKey((p) => p + 1); void loadGames(true); }}>
                  {refreshing ? "Refreshing..." : "Refresh"}
                </Button>
              </div>
            </div>

            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                {Array.from({ length: itemsPerPage }).map((_, i) => <GameCardSkeleton key={i} />)}
              </div>
            ) : (
              <>
                <div className={`grid ${viewMode === "grid" ? "grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5" : "grid-cols-1 sm:grid-cols-2 md:grid-cols-3"} gap-6`}>
                  {paginatedFeaturedGames.map((g) => {
                    const isFav = favorites.includes(g.appid);
                    const isPop = popularAppIds.has(g.appid);
                    return (
                      <div key={g.appid} className="relative group">
                        <div onClick={() => openGameModal(g)} role="button" tabIndex={0}>
                          {viewMode === "compact" ? <GameCardCompact game={{ appid: g.appid, name: g.name, image: g.image, genres: g.genres }} /> : <GameCard game={g} stats={gameStats[g.appid]} isPopular={isPop} />}
                        </div>

                        <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition flex gap-2">
                          <button aria-label={isFav ? "Remove favorite" : "Add favorite"} onClick={(e) => { e.stopPropagation(); toggleFavorite(g.appid); }} className="p-2 rounded-full bg-card/80 border">
                            <Heart className={`h-4 w-4 ${isFav ? "text-red-400" : "text-muted-foreground"}`} />
                          </button>
                          <button aria-label="Open" onClick={(e) => { e.stopPropagation(); goToGame(g.appid); }} className="p-2 rounded-full bg-card/80 border">
                            <ChevronUp className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-8 flex items-center justify-center gap-4">
                  <Pagination>
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious onClick={() => setCurrentPage(Math.max(1, currentPage - 1))} className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"} />
                      </PaginationItem>

                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        let pageNumber: number;
                        if (totalPages <= 5) pageNumber = i + 1;
                        else if (currentPage <= 3) pageNumber = i + 1;
                        else if (currentPage >= totalPages - 2) pageNumber = totalPages - 4 + i;
                        else pageNumber = currentPage - 2 + i;
                        return (
                          <PaginationItem key={pageNumber}>
                            <PaginationLink onClick={() => setCurrentPage(pageNumber)} isActive={currentPage === pageNumber} className="cursor-pointer">
                              {pageNumber}
                            </PaginationLink>
                          </PaginationItem>
                        );
                      })}

                      <PaginationItem>
                        <PaginationNext onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))} className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"} />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </div>

                {useHybridLoadMore && currentPage < totalPages && (
                  <div className="mt-6 text-center">
                    <Button onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}>Load more</Button>
                  </div>
                )}
              </>
            )}
          </section>
        </div>
      </main>

      {!isOnline && games.length === 0 && !loading && (
        <OfflineBanner onRetry={() => { setGamesError(null); setLoading(true); void loadGames(true); }} />
      )}

      {gamesError && isOnline && !loading && (
        <section className="py-6 px-4">
          <div className="container mx-auto max-w-4xl">
            <ErrorMessage title="Games Loading Issue" message={gamesError.message} errorCode={gamesError.code} retry={() => { setGamesError(null); setLoading(true); void loadGames(true); }} />
          </div>
        </section>
      )}

      {showBackToTop && (
        <button onClick={() => document.getElementById("hero")?.scrollIntoView({ behavior: "smooth" })} className="fixed bottom-6 right-6 z-50 p-3 rounded-full bg-primary text-white shadow-lg hover:scale-105 transition" aria-label="Back to top">
          <ChevronUp className="h-5 w-5" />
        </button>
      )}

      {modalOpen && modalGame && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setModalOpen(false)} />
          <div className="relative z-10 max-w-4xl w-full bg-card rounded-2xl p-6 border border-border/20 shadow-2xl">
            <div className="flex items-start justify-between gap-4 mb-4">
              <h3 className="text-xl font-bold">{modalGame.name}</h3>
              <button aria-label="Close" onClick={() => setModalOpen(false)} className="p-2 rounded-full border">✕</button>
            </div>

            <div className="grid md:grid-cols-3 gap-4">
              <div className="md:col-span-1">
                <img src={modalGame.image} alt={modalGame.name} className="w-full rounded-md object-cover" loading="lazy" />
              </div>

              <div className="md:col-span-2">
                <div className="text-sm text-muted-foreground mb-2">{modalGame.developer}</div>
                <div className="prose max-w-none mb-4" style={{ whiteSpace: "pre-wrap" }}>{modalGame.description}</div>

                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div><strong>Size:</strong> {modalGame.size || "?"}</div>
                  <div><strong>Release:</strong> {modalGame.release_date || "?"}</div>
                  <div><strong>Source:</strong> {modalGame.source || "?"}</div>
                  <div><strong>Downloads:</strong> {formatNumber(gameStats[modalGame.appid]?.downloads || 0)}</div>
                </div>

                <div className="mt-4 flex gap-2">
                  <Button onClick={() => goToGame(modalGame.appid)}>Open</Button>
                  <Button variant="outline" onClick={() => copyGameLink(modalGame.appid)}>Copy link</Button>
                  <Button variant="ghost" onClick={() => toggleFavorite(modalGame.appid)}>{favorites.includes(modalGame.appid) ? "Unfavorite" : "Favorite"}</Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default LauncherPage;