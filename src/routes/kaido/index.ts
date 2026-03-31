import { Hono } from "hono";
import { KaidoScraper } from "../../engine/kaido.engine.js";

const kaidoRouter = new Hono();
const kaido = new KaidoScraper();

// 1. SEARCH ENDPOINT (With Pagination & Filters)
kaidoRouter.get("/search", async (c) => {
    const query = c.req.query("q") || "";
    const page = parseInt(c.req.query("page") || "1");
    
    try {
        const res = await kaido.search(query, page, {});
        return c.json({ data: res }, 200);
    } catch (error) {
        console.error("Search Error:", error);
        return c.json({ data: { animes: [], hasNextPage: false } }, 200);
    }
});

// 2. EPISODES LIST ENDPOINT
kaidoRouter.get("/anime/:animeId/episodes", async (c) => {
    const animeId = decodeURIComponent(c.req.param("animeId"));
    try {
        const res = await kaido.getEpisodes(animeId);
        return c.json({ data: { episodes: res.episodes } }, 200);
    } catch (error) {
        console.error("Episodes Error:", error);
        return c.json({ error: "Failed to fetch episodes" }, 500);
    }
});

// 3. SERVERS ENDPOINT
kaidoRouter.get("/episode/servers", async (c) => {
    const episodeId = decodeURIComponent(c.req.query("animeEpisodeId") || "");
    try {
        const res = await kaido.getEpisodeServers(episodeId);
        return c.json({ data: { sub: res.sub, dub: res.dub } }, 200);
    } catch (error) {
        console.error("Servers Error:", error);
        // Silent fallback to prevent Flutter crashes
        return c.json({
            data: {
                sub: [{ serverName: "vidstreaming", serverId: "vidstreaming" }, { serverName: "megacloud", serverId: "megacloud" }],
                dub: [{ serverName: "vidstreaming", serverId: "vidstreaming" }, { serverName: "megacloud", serverId: "megacloud" }]
            }
        }, 200);
    }
});

// 4. SOURCES ENDPOINT (The Final Boss)
kaidoRouter.get("/episode/sources", async (c) => {
    const episodeId = decodeURIComponent(c.req.query("animeEpisodeId") || "");
    const server = decodeURIComponent(c.req.query("server") || "vidstreaming");
    const category = decodeURIComponent(c.req.query("category") || "sub");

    try {
        const res = await kaido.getEpisodeSources(episodeId, server, category);
        
        const formattedTracks = res.tracks?.map((sub: any) => ({
            file: sub.url,
            url: sub.url,
            label: sub.lang,
            kind: "captions"
        })) || [];

        return c.json({
            data: {
                sources: res.sources,
                tracks: formattedTracks,
                intro: res.intro,
                outro: res.outro,
                headers: res.headers
            }
        }, 200);
    } catch (error: any) {
        console.error("Sources Error:", error);
        return c.json({ error: "Failed to fetch sources", exact_reason: error.message }, 500);
    }
});

// 5. HOME PAGE ENDPOINT
kaidoRouter.get("/home", async (c) => {
    try {
        const res = await kaido.getHomePage();
        return c.json({ data: res }, 200);
    } catch (error: any) {
        return c.json({ error: "Failed to fetch home page", details: error.message }, 500);
    }
});

// 6. ANIME INFO ENDPOINT
kaidoRouter.get("/info/:animeId", async (c) => {
    const animeId = decodeURIComponent(c.req.param("animeId"));
    try {
        const res = await kaido.getAnimeInfo(animeId);
        return c.json({ data: res }, 200);
    } catch (error: any) {
        return c.json({ error: "Failed to fetch anime info", details: error.message }, 500);
    }
});

// 7. SCHEDULE ENDPOINT
kaidoRouter.get("/schedule", async (c) => {
    const date = c.req.query("date") || new Date().toISOString().split("T")[0]; 
    try {
        const res = await kaido.getEstimatedSchedule(date);
        return c.json({ data: res }, 200);
    } catch (error: any) {
        return c.json({ error: "Failed to fetch schedule" }, 500);
    }
});

// 8. ADVANCED SEARCH / FILTER ENDPOINT (For 'Similar' feature)
kaidoRouter.get("/filter", async (c) => {
    const genres = c.req.query("genres") || "";
    const page = parseInt(c.req.query("page") || "1");
    
    try {
        // 🛠️ FIX: We pass an empty keyword (""), but pass the genres in the filter object!
        const res = await kaido.search("", page, { genres: genres });
        return c.json({ data: res }, 200);
    } catch (error) {
        console.error("Filter Error:", error);
        return c.json({ data: { animes: [], hasNextPage: false } }, 200);
    }
});

export { kaidoRouter };
