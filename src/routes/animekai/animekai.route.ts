import { Hono } from "hono";
import { AnimeKaiScraper } from "../../engine/animekai.engine.js";

const animekaiRouter = new Hono();
const animekai = new AnimeKaiScraper();

// 🛠️ FIX 1: ADDED THE MISSING HOME ROUTE FOR SPOTLIGHT & ROWS
animekaiRouter.get("/home", async (c) => {
    try {
        const [spotlight, trending, latest, movies, popular] = await Promise.all([
            animekai.getSpotlight(),
            animekai.filter("sort=recently_updated", 1),
            animekai.filter("status=Current&sort=recently_updated", 1),
            animekai.filter("type=Movie&sort=recently_updated", 1),
            animekai.filter("sort=most_watched", 1)
        ]);
        return c.json({
            data: {
                spotlightAnimes: spotlight,
                trendingAnimes: trending.animes,
                latestEpisodeAnimes: latest.animes,
                topMovies: movies.animes,
                mostPopularAnimes: popular.animes
            }
        }, 200);
    } catch (e) {
        return c.json({ data: {} }, 500);
    }
});

animekaiRouter.get("/search", async (c) => {
    const q = c.req.query("q") || "";
    const page = parseInt(c.req.query("page") || "1");
    try { return c.json({ data: await animekai.search(q, page) }, 200); } 
    catch (e) { return c.json({ data: { animes: [] } }, 200); }
});

// 🛠️ FIX 2: FIXED ADVANCED SEARCH TO ACCEPT ALL PARAMS
animekaiRouter.get("/filter", async (c) => {
    const url = new URL(c.req.url);
    const searchParams = new URLSearchParams(url.search);
    const page = parseInt(searchParams.get("page") || "1");
    searchParams.delete("page"); // Remove page so we can pass the raw filter string
    
    try { return c.json({ data: await animekai.filter(searchParams.toString(), page) }, 200); } 
    catch (e) { return c.json({ data: { animes: [] } }, 200); }
});

animekaiRouter.get("/spotlight", async (c) => {
    try { return c.json({ data: await animekai.getSpotlight() }, 200); } 
    catch (e) { return c.json({ data: [] }, 200); }
});

animekaiRouter.get("/recent-episodes", async (c) => {
    const page = parseInt(c.req.query("page") || "1");
    try { return c.json({ data: await animekai.recentlyUpdated(page) }, 200); } 
    catch (e) { return c.json({ data: { animes: [] } }, 200); }
});

animekaiRouter.get("/movies", async (c) => {
    const page = parseInt(c.req.query("page") || "1");
    try { return c.json({ data: await animekai.movies(page) }, 200); } 
    catch (e) { return c.json({ data: { animes: [] } }, 200); }
});

// 🛠️ FIX 3: FORMATTED INFO ROUTE SO THE APP DOESN'T SAY "UNAVAILABLE"
animekaiRouter.get("/info/:animeId", async (c) => {
    const animeId = decodeURIComponent(c.req.param("animeId"));
    try { 
        const info = await animekai.getAnimeInfo(animeId);
        if (!info) return c.json({ data: null }, 404);
        
        return c.json({ 
            data: { 
                info: info,
                seasons: info.relations.filter((r: any) => r.relationType === "Season"),
                relatedAnimes: info.relations.filter((r: any) => r.relationType !== "Season")
            } 
        }, 200); 
    } 
    catch (e: any) { return c.json({ error: e.message }, 500); }
});

animekaiRouter.get("/anime/:animeId/episodes", async (c) => {
    const animeId = decodeURIComponent(c.req.param("animeId"));
    try { return c.json({ data: await animekai.getEpisodes(animeId) }, 200); } 
    catch (e: any) { return c.json({ error: e.message }, 500); }
});

animekaiRouter.get("/episode/servers", async (c) => {
    const episodeData = decodeURIComponent(c.req.query("animeEpisodeId") || "");
    try { return c.json({ data: await animekai.getEpisodeServers(episodeData) }, 200); } 
    catch (e: any) { return c.json({ error: e.message }, 500); }
});

animekaiRouter.get("/episode/sources", async (c) => {
    const episodeData = decodeURIComponent(c.req.query("animeEpisodeId") || "");
    const server = decodeURIComponent(c.req.query("server") || "megaup");
    const category = decodeURIComponent(c.req.query("category") || "softsub");
    try { return c.json({ data: await animekai.getEpisodeSources(episodeData, server, category) }, 200); } 
    catch (e: any) { return c.json({ error: e.message }, 500); }
});

animekaiRouter.get("/debug-iframe", async (c) => {
    const iframeUrl = c.req.query("url");
    if (!iframeUrl) return c.json({ error: "Provide a URL" }, 400);

    try {
        const response = await fetch(iframeUrl, {
            method: "GET",
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
                "Accept-Language": "en-US,en;q=0.9",
                "Referer": "https://animekai.la/",
                "Connection": "keep-alive",
                "Upgrade-Insecure-Requests": "1",
                "Sec-Fetch-Dest": "iframe",
                "Sec-Fetch-Mode": "navigate",
                "Sec-Fetch-Site": "same-origin"
            }
        });

        const status = response.status;
        const text = await response.text();

        return c.json({
            status: status,
            isCloudflareBlock: text.includes("Just a moment") || text.includes("cloudflare"),
            htmlSnippet: text.substring(0, 1000) // Print first 1000 chars to see what we got
        });

    } catch (e: any) {
        return c.json({ error: e.message }, 500);
    }
});

export { animekaiRouter };
