// @ts-nocheck
import { Hono } from "hono";
import { Kaido } from "../../engine/kaido.engine.js";
import { cache } from "../../config/cache.js";
import type { ServerContext } from "../../config/context.js";

const kaido = new Kaido.Scraper();
const kaidoRouter = new Hono<ServerContext>();

// /api/v1/kaido
kaidoRouter.get("/", (c) => {
    return c.json({
        provider: "Tatakai",
        status: 200,
        message: "Kaido API endpoints",
        endpoints: {
            home: "/api/v1/kaido/home",
            azlist: "/api/v1/kaido/azlist/{sortOption}",
            qtip: "/api/v1/kaido/qtip/{animeId}",
            category: "/api/v1/kaido/category/{name}",
            genre: "/api/v1/kaido/genre/{name}",
            producer: "/api/v1/kaido/producer/{name}",
            schedule: "/api/v1/kaido/schedule",
            search: "/api/v1/kaido/search",
            "search/suggestion": "/api/v1/kaido/search/suggestion",
            anime: "/api/v1/kaido/anime/{animeId}",
            "episode/servers": "/api/v1/kaido/episode/servers",
            "episode/sources": "/api/v1/kaido/episode/sources",
            "anime/episodes": "/api/v1/kaido/anime/{animeId}/episodes",
            "anime/next-episode-schedule": "/api/v1/kaido/anime/{animeId}/next-episode-schedule"
        }
    });
});

// /api/v1/kaido/home
kaidoRouter.get("/home", async (c) => {
    const cacheConfig = c.get("CACHE_CONFIG");

    const data = await cache.getOrSet<Kaido.ScrapedHomePage>(
        kaido.getHomePage,
        cacheConfig.key,
        cacheConfig.duration
    );

    return c.json({ provider: "Tatakai", status: 200, data }, { status: 200 });
});

// /api/v1/kaido/azlist/{sortOption}?page={page}
kaidoRouter.get("/azlist/:sortOption", async (c) => {
    const cacheConfig = c.get("CACHE_CONFIG");

    const sortOption = decodeURIComponent(
        c.req.param("sortOption").trim().toLowerCase()
    ) as Kaido.AZListSortOptions;
    const page: number =
        Number(decodeURIComponent(c.req.query("page") || "")) || 1;

    const data = await cache.getOrSet<Kaido.ScrapedAnimeAZList>(
        async () => kaido.getAZList(sortOption, page),
        cacheConfig.key,
        cacheConfig.duration
    );

    return c.json({ provider: "Tatakai", status: 200, data }, { status: 200 });
});

// /api/v1/kaido/qtip/{animeId}
kaidoRouter.get("/qtip/:animeId", async (c) => {
    const cacheConfig = c.get("CACHE_CONFIG");
    const animeId = decodeURIComponent(c.req.param("animeId").trim());

    const data = await cache.getOrSet<Kaido.ScrapedAnimeQtipInfo>(
        async () => kaido.getQtipInfo(animeId),
        cacheConfig.key,
        cacheConfig.duration
    );

    return c.json({ provider: "Tatakai", status: 200, data }, { status: 200 });
});

// /api/v1/kaido/category/{name}?page={page}
kaidoRouter.get("/category/:name", async (c) => {
    const cacheConfig = c.get("CACHE_CONFIG");
    const categoryName = decodeURIComponent(
        c.req.param("name").trim()
    ) as Kaido.AnimeCategories;
    const page: number =
        Number(decodeURIComponent(c.req.query("page") || "")) || 1;

    const data = await cache.getOrSet<Kaido.ScrapedAnimeCategory>(
        async () => kaido.getCategoryAnime(categoryName, page),
        cacheConfig.key,
        cacheConfig.duration
    );

    return c.json({ provider: "Tatakai", status: 200, data }, { status: 200 });
});

// /api/v1/kaido/genre/{name}?page={page}
kaidoRouter.get("/genre/:name", async (c) => {
    const cacheConfig = c.get("CACHE_CONFIG");
    const genreName = decodeURIComponent(c.req.param("name").trim());
    const page: number =
        Number(decodeURIComponent(c.req.query("page") || "")) || 1;

    const data = await cache.getOrSet<Kaido.ScrapedGenreAnime>(
        async () => kaido.getGenreAnime(genreName, page),
        cacheConfig.key,
        cacheConfig.duration
    );

    return c.json({ provider: "Tatakai", status: 200, data }, { status: 200 });
});

// /api/v1/kaido/producer/{name}?page={page}
kaidoRouter.get("/producer/:name", async (c) => {
    const cacheConfig = c.get("CACHE_CONFIG");
    const producerName = decodeURIComponent(c.req.param("name").trim());
    const page: number =
        Number(decodeURIComponent(c.req.query("page") || "")) || 1;

    const data = await cache.getOrSet<Kaido.ScrapedProducerAnime>(
        async () => kaido.getProducerAnimes(producerName, page),
        cacheConfig.key,
        cacheConfig.duration
    );

    return c.json({ provider: "Tatakai", status: 200, data }, { status: 200 });
});

// /api/v1/kaido/schedule?date={date}&tzOffset={tzOffset}
kaidoRouter.get("/schedule", async (c) => {
    const cacheConfig = c.get("CACHE_CONFIG");

    const date = decodeURIComponent(c.req.query("date") || "");
    let tzOffset = Number(
        decodeURIComponent(c.req.query("tzOffset") || "-330")
    );
    tzOffset = isNaN(tzOffset) ? -330 : tzOffset;

    const data = await cache.getOrSet<Kaido.ScrapedEstimatedSchedule>(
        async () => kaido.getEstimatedSchedule(date, tzOffset),
        `${cacheConfig.key}_${tzOffset}`,
        cacheConfig.duration
    );

    return c.json({ provider: "Tatakai", status: 200, data }, { status: 200 });
});

// /api/v1/kaido/search?q={query}&page={page}&filters={...filters}
kaidoRouter.get("/search", async (c) => {
    const cacheConfig = c.get("CACHE_CONFIG");
    let { q: query, page, ...filters } = c.req.query();

    query = decodeURIComponent(query || "");
    const pageNo = Number(decodeURIComponent(page || "")) || 1;

    const data = await cache.getOrSet<Kaido.ScrapedAnimeSearchResult>(
        async () => kaido.search(query, pageNo, filters),
        cacheConfig.key,
        cacheConfig.duration
    );

    return c.json({ provider: "Tatakai", status: 200, data }, { status: 200 });
});

// /api/v1/kaido/search/suggestion?q={query}
kaidoRouter.get("/search/suggestion", async (c) => {
    const cacheConfig = c.get("CACHE_CONFIG");
    const query = decodeURIComponent(c.req.query("q") || "");

    const data = await cache.getOrSet<Kaido.ScrapedAnimeSearchSuggestion>(
        async () => kaido.searchSuggestions(query),
        cacheConfig.key,
        cacheConfig.duration
    );

    return c.json({ provider: "Tatakai", status: 200, data }, { status: 200 });
});

// /api/v1/kaido/anime/{animeId}
kaidoRouter.get("/anime/:animeId", async (c) => {
    const cacheConfig = c.get("CACHE_CONFIG");
    const animeId = decodeURIComponent(c.req.param("animeId").trim());

    const data = await cache.getOrSet<Kaido.ScrapedAnimeAboutInfo>(
        async () => kaido.getInfo(animeId),
        cacheConfig.key,
        cacheConfig.duration
    );

    return c.json({ provider: "Tatakai", status: 200, data }, { status: 200 });
});

// /api/v1/kaido/episode/servers?animeEpisodeId={id}
kaidoRouter.get("/episode/servers", async (c) => {
    const cacheConfig = c.get("CACHE_CONFIG");
    const animeEpisodeId = decodeURIComponent(
        c.req.query("animeEpisodeId") || ""
    );

    const data = await cache.getOrSet<Kaido.ScrapedEpisodeServers>(
        async () => kaido.getEpisodeServers(animeEpisodeId),
        `${cacheConfig.key}_${animeEpisodeId}`, 
        cacheConfig.duration
    );

    return c.json({ provider: "Tatakai", status: 200, data }, { status: 200 });
});

// /api/v1/kaido/episode/sources?animeEpisodeId={episodeId}&server={server}&category={category}
kaidoRouter.get("/episode/sources", async (c) => {
    const cacheConfig = c.get("CACHE_CONFIG");
    const animeEpisodeId = decodeURIComponent(
        c.req.query("animeEpisodeId") || ""
    );
    const server = decodeURIComponent(
        c.req.query("server") || Kaido.Servers.VidStreaming
    ) as Kaido.AnimeServers;
    const category = decodeURIComponent(c.req.query("category") || "sub") as
        | "sub"
        | "dub"
        | "raw";

    try {
        const data = await cache.getOrSet<Kaido.ScrapedAnimeEpisodesSources>(
            async () => kaido.getEpisodeSources(animeEpisodeId, server, category),
            `${cacheConfig.key}_${animeEpisodeId}_${server}_${category}`,
            cacheConfig.duration
        );
        return c.json({ provider: "Tatakai", status: 200, data }, { status: 200 });
    } catch (error: any) {
        console.error(`Kaido sources fetch failed for ${animeEpisodeId}:`, error.message);
        return c.json({ provider: "Tatakai", status: 404, message: "Sources not found or ID invalid", error: error.message }, { status: 404 });
    }
});

// /api/v1/kaido/anime/{anime-id}/episodes
kaidoRouter.get("/anime/:animeId/episodes", async (c) => {
    const cacheConfig = c.get("CACHE_CONFIG");
    const animeId = decodeURIComponent(c.req.param("animeId").trim());

    const data = await cache.getOrSet<Kaido.ScrapedAnimeEpisodes>(
        async () => kaido.getEpisodes(animeId),
        `${cacheConfig.key}_${animeId}`, 
        cacheConfig.duration
    );

    return c.json({ provider: "Tatakai", status: 200, data }, { status: 200 });
});

// /api/v1/kaido/anime/{anime-id}/next-episode-schedule
kaidoRouter.get("/anime/:animeId/next-episode-schedule", async (c) => {
    const cacheConfig = c.get("CACHE_CONFIG");
    const animeId = decodeURIComponent(c.req.param("animeId").trim());

    const data = await cache.getOrSet<Kaido.ScrapedNextEpisodeSchedule>(
        async () => kaido.getNextEpisodeSchedule(animeId),
        cacheConfig.key,
        cacheConfig.duration
    );

    return c.json({ provider: "Tatakai", status: 200, data }, { status: 200 });
});

export { kaidoRouter };
