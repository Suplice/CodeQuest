import { useMemo, useState, useEffect } from "react";
import { Task } from "@/lib/types/task";
import { User } from "@/lib/types/user";
import AsyncStorage from "@react-native-async-storage/async-storage";

const API_URL = "http://localhost:5000";

type StoredFilters = {
  type?: string;
  lang?: string;
  diff?: string;
  sort?: string;
  q?: string;
  hideCompleted?: boolean;
  show?: "all" | "recommended";
};

const saveFiltersToStorage = async (
  userId: number | undefined,
  filters: StoredFilters
) => {
  if (!userId) return;
  const key = `taskFilters_${userId}`;
  try {
    await AsyncStorage.setItem(key, JSON.stringify(filters));
  } catch (error) {
    console.error("Error saving filters:", error);
  }
};

export function useTaskFilters(tasks: Task[], user: User | null) {
  const userId = user?.ID;

  const [typeFilter, setTypeFilter] = useState("");
  const [langFilter, setLangFilter] = useState("");
  const [diffFilter, setDiffFilter] = useState("");
  const [sortBy, setSortBy] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [hideCompleted, setHideCompleted] = useState(false);

  const [recommendationFilter, setRecommendationFilter] = useState<
    "all" | "recommended"
  >("all");

  const [isLoaded, setIsLoaded] = useState(false);

  const [recommendedTasks, setRecommendedTasks] = useState<Task[]>([]);
  const [isLoadingRecs, setIsLoadingRecs] = useState(false);

  useEffect(() => {
    const loadFilters = async () => {
      if (!userId) return;
      try {
        const stored = await AsyncStorage.getItem(`taskFilters_${userId}`);
        if (stored) {
          const parsed = JSON.parse(stored) as StoredFilters;
          if (parsed.type) setTypeFilter(parsed.type);
          if (parsed.lang) setLangFilter(parsed.lang);
          if (parsed.diff) setDiffFilter(parsed.diff);
          if (parsed.sort) setSortBy(parsed.sort);
          if (parsed.q) setSearchQuery(parsed.q);
          if (parsed.hideCompleted !== undefined)
            setHideCompleted(parsed.hideCompleted);
          if (parsed.show) setRecommendationFilter(parsed.show);
        }
      } catch (e) {
        console.error("Failed to load filters", e);
      } finally {
        setIsLoaded(true);
      }
    };
    loadFilters();
  }, [userId]);

  useEffect(() => {
    if (!isLoaded || !userId) return;

    const currentFilters: StoredFilters = {
      type: typeFilter || undefined,
      lang: langFilter || undefined,
      diff: diffFilter || undefined,
      sort: sortBy || undefined,
      q: searchQuery || undefined,
      hideCompleted: hideCompleted || undefined,
      show: recommendationFilter === "recommended" ? "recommended" : undefined,
    };
    saveFiltersToStorage(userId, currentFilters);
  }, [
    typeFilter,
    langFilter,
    diffFilter,
    sortBy,
    searchQuery,
    hideCompleted,
    recommendationFilter,
    userId,
    isLoaded,
  ]);

  useEffect(() => {
    const fetchRecommendations = async () => {
      if (recommendationFilter === "recommended" && userId) {
        setIsLoadingRecs(true);
        try {
          const response = await fetch(`${API_URL}/tasks/recommended`, {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
            },
            credentials: "include",
          });

          if (!response.ok) {
            throw new Error(
              `Error fetching recommendations: ${response.statusText}`
            );
          }

          const data = await response.json();
          setRecommendedTasks(data);
        } catch (error) {
          console.error("Failed to fetch recommended tasks:", error);
          setRecommendedTasks([]);
        } finally {
          setIsLoadingRecs(false);
        }
      }
    };

    fetchRecommendations();
  }, [recommendationFilter, userId]);

  const clearFilters = async () => {
    setTypeFilter("");
    setLangFilter("");
    setDiffFilter("");
    setSortBy("");
    setSearchQuery("");
    setHideCompleted(false);
    setRecommendationFilter("all");
    if (userId) {
      await AsyncStorage.removeItem(`taskFilters_${userId}`);
    }
  };

  const filteredTasks = useMemo(() => {
    let result =
      recommendationFilter === "recommended"
        ? [...recommendedTasks]
        : [...tasks];

    if (typeFilter) result = result.filter((t) => t.type === typeFilter);
    if (langFilter) result = result.filter((t) => t.language === langFilter);

    if (diffFilter) result = result.filter((t) => t.difficulty === diffFilter);

    if (searchQuery)
      result = result.filter((t) =>
        t.title.toLowerCase().includes(searchQuery.toLowerCase())
      );

    if (hideCompleted) {
      result = result.filter((t) => !t.user_progress?.is_completed);
    }

    if (sortBy) {
      switch (sortBy) {
        case "xp_asc":
          result.sort((a, b) => a.xp - b.xp);
          break;
        case "xp_desc":
          result.sort((a, b) => b.xp - a.xp);
          break;
        case "points_asc":
          result.sort((a, b) => a.points - b.points);
          break;
        case "points_desc":
          result.sort((a, b) => b.points - a.points);
          break;
        case "created_asc":
          result.sort(
            (a, b) =>
              new Date(a.created_at).getTime() -
              new Date(b.created_at).getTime()
          );
          break;
        case "created_desc":
          result.sort(
            (a, b) =>
              new Date(b.created_at).getTime() -
              new Date(a.created_at).getTime()
          );
          break;
        case "alpha_asc":
          result.sort((a, b) => a.title.localeCompare(b.title));
          break;
        case "alpha_desc":
          result.sort((a, b) => b.title.localeCompare(a.title));
          break;
      }
    } else if (recommendationFilter === "all") {
      result.sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    }

    return result;
  }, [
    tasks,
    recommendedTasks,
    typeFilter,
    langFilter,
    diffFilter,
    sortBy,
    searchQuery,
    hideCompleted,
    recommendationFilter,
  ]);

  return {
    filteredTasks,
    filters: {
      typeFilter,
      langFilter,
      diffFilter,
      sortBy,
      searchQuery,
      hideCompleted,
      recommendationFilter,
    },
    setters: {
      setTypeFilter,
      setLangFilter,
      setDiffFilter,
      setSortBy,
      setSearchQuery,
      setHideCompleted: (checked: boolean | "indeterminate") =>
        setHideCompleted(checked === true),
      setRecommendationFilter,
    },
    clearFilters,
    isLoaded,
    isLoadingRecs,
  };
}
