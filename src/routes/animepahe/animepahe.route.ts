import { Hono } from "hono";
import { AnimePaheScraper } from "../../engine/animepahe.engine.js";

const animepaheRouter = new Hono();
const animepahe = new AnimePaheScraper();

// 1. SEARCH ENDPOINT
animepaheRouter.get("/search", async (c) => {
    const query = c.req.query("q") || "";
    try {
        const res = await animepahe.search(query);
        return c.json({ data: res }, 200);
    } catch (error) {
        console.error("AnimePahe Search Error:", error);
        return c.json({ data: { animes: [] } }, 200);
    }
});

// 2. EPISODES LIST ENDPOINT
animepaheRouter.get("/anime/:animeSession/episodes", async (c) => {
    const animeSession = decodeURIComponent(c.req.param("animeSession"));
    const page = parseInt(c.req.query("page") || "1");
    try {
        const res = await animepahe.getEpisodes(animeSession, page);
        return c.json({ data: res }, 200);
    } catch (error) {
        console.error("AnimePahe Episodes Error:", error);
        return c.json({ error: "Failed to fetch episodes" }, 500);
    }
});

// 3. SOURCES ENDPOINT (Kwik Decryption)
animepaheRouter.get("/episode/sources", async (c) => {
    const episodeSession = decodeURIComponent(c.req.query("animeEpisodeId") || "");

    try {
        const res = await animepahe.getEpisodeSources(episodeSession);
        
        if (!res) return c.json({ error: "Sources not found" }, 404);

        return c.json({ data: res }, 200);
    } catch (error: any) {
        console.error("AnimePahe Sources Error:", error);
        return c.json({ error: "Failed to fetch sources", details: error.message }, 500);
    }
});

export { animepaheRouter };