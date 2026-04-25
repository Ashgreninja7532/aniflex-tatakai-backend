import { Hono } from "hono";
import { AnimeKaiScraper } from "../../engine/animekai.engine.js";

const animekaiRouter = new Hono();
const animekai = new AnimeKaiScraper();

animekaiRouter.get("/search", async (c) => {
    const q = c.req.query("q") || "";
    const page = parseInt(c.req.query("page") || "1");
    try { return c.json({ data: await animekai.search(q, page) }, 200); } 
    catch (e) { return c.json({ data: { animes: [] } }, 200); }
});

animekaiRouter.get("/filter", async (c) => {
    const genre = c.req.query("genre") || "";
    const page = parseInt(c.req.query("page") || "1");
    try { return c.json({ data: await animekai.genreSearch(genre, page) }, 200); } 
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

animekaiRouter.get("/info/:animeId", async (c) => {
    const animeId = decodeURIComponent(c.req.param("animeId"));
    try { return c.json({ data: await animekai.getAnimeInfo(animeId) }, 200); } 
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

export { animekaiRouter };
